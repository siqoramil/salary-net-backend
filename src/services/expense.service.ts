import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { Types } from 'mongoose';
import { Expense, type ExpenseDoc } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
} from '../schemas/expense.schema.js';

function deleteUploadedFile(url: string) {
  try {
    const staticPath = new URL(url).pathname;
    if (staticPath.startsWith('/static/')) {
      const filePath = nodePath.join('./uploads', staticPath.replace('/static/', ''));
      fs.unlink(filePath).catch(() => {});
    }
  } catch { /* ignore malformed URLs */ }
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw Errors.badRequest(ErrorMessages.EXPENSE_INVALID_ID, ErrorCodes.EXPENSE_INVALID_ID);
  }
  return new Types.ObjectId(id);
}

export const expenseService = {
  async list(userId: string, query: ListExpensesQuery) {
    const filter: Record<string, unknown> = { userId: toObjectId(userId) };
    if (query.category) filter.category = query.category;
    if (query.from || query.to) {
      filter.expenseDate = {} as Record<string, Date>;
      if (query.from) (filter.expenseDate as Record<string, Date>).$gte = query.from;
      if (query.to) (filter.expenseDate as Record<string, Date>).$lte = query.to;
    }
    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        filter.expenseDate = {
          ...(filter.expenseDate as object),
          $lt: cursorDate,
        };
      }
    }

    const items = await Expense.find(filter)
      .sort({ expenseDate: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].expenseDate.toISOString() : null;

    return { items: page, nextCursor };
  },

  async create(userId: string, input: CreateExpenseInput): Promise<ExpenseDoc> {
    return Expense.create({ ...input, userId: toObjectId(userId) });
  },

  async getOne(userId: string, id: string): Promise<ExpenseDoc> {
    const doc = await Expense.findOne({ _id: toObjectId(id), userId: toObjectId(userId) });
    if (!doc) throw Errors.notFound(ErrorMessages.EXPENSE_NOT_FOUND, ErrorCodes.EXPENSE_NOT_FOUND);
    return doc;
  },

  async update(userId: string, id: string, input: UpdateExpenseInput): Promise<ExpenseDoc> {
    // Delete old receipt file if receiptUrl is changing
    if (input.receiptUrl !== undefined) {
      const old = await Expense.findOne({ _id: toObjectId(id), userId: toObjectId(userId) });
      if (old?.receiptUrl) deleteUploadedFile(old.receiptUrl);
    }

    const doc = await Expense.findOneAndUpdate(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      { $set: input },
      { new: true },
    );
    if (!doc) throw Errors.notFound(ErrorMessages.EXPENSE_NOT_FOUND, ErrorCodes.EXPENSE_NOT_FOUND);
    return doc;
  },

  async remove(userId: string, id: string): Promise<void> {
    const doc = await Expense.findOne({ _id: toObjectId(id), userId: toObjectId(userId) });
    if (!doc) throw Errors.notFound(ErrorMessages.EXPENSE_NOT_FOUND, ErrorCodes.EXPENSE_NOT_FOUND);
    if (doc.receiptUrl) deleteUploadedFile(doc.receiptUrl);
    await doc.deleteOne();
  },

  async summary(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    referenceDate: Date,
  ) {
    const { from, to } = computeRange(period, referenceDate);
    const result = await Expense.aggregate<{
      _id: null;
      total: number;
      count: number;
      byCurrency: Array<{ currency: string; total: number }>;
    }>([
      {
        $match: {
          userId: toObjectId(userId),
          expenseDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$currency',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byCurrency = result.map((r) => ({
      currency: (r as unknown as { _id: string })._id,
      total: r.total,
      count: r.count,
    }));

    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      byCurrency,
    };
  },

  async byCategory(userId: string, from: Date, to: Date) {
    const rows = await Expense.aggregate<{
      _id: string;
      total: number;
      count: number;
    }>([
      {
        $match: {
          userId: toObjectId(userId),
          expenseDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { category: '$category', currency: '$currency' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return rows.map((r) => {
      const id = r._id as unknown as { category: string; currency: string };
      return {
        category: id.category,
        currency: id.currency,
        total: r.total,
        count: r.count,
      };
    });
  },

  async trends(userId: string, from: Date, to: Date, granularity: 'day' | 'week' | 'month') {
    const dateFormat = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' }[granularity];

    const rows = await Expense.aggregate<{
      _id: string;
      total: number;
    }>([
      {
        $match: {
          userId: toObjectId(userId),
          expenseDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$expenseDate' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => ({ bucket: r._id, total: r.total }));
  },
};

function computeRange(period: 'daily' | 'weekly' | 'monthly' | 'yearly', ref: Date) {
  const from = new Date(ref);
  const to = new Date(ref);
  if (period === 'daily') {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = (from.getDay() + 6) % 7; // Monday=0
    from.setDate(from.getDate() - day);
    from.setHours(0, 0, 0, 0);
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(from.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
  } else {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(11, 31);
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}
