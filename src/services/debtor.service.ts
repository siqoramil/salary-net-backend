import { Types } from 'mongoose';
import { Debtor, type DebtorDoc } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw Errors.badRequest(ErrorMessages.DEBTOR_INVALID_ID, ErrorCodes.DEBTOR_INVALID_ID);
  }
  return new Types.ObjectId(id);
}

export interface CreateDebtorInput {
  type: 'lent' | 'borrowed';
  personName: string;
  amount: number;
  currency: 'UZS' | 'USD' | 'EUR' | 'RUB';
  date: Date;
  description?: string;
}

export interface UpdateDebtorInput {
  personName?: string;
  amount?: number;
  currency?: 'UZS' | 'USD' | 'EUR' | 'RUB';
  date?: Date;
  description?: string;
  isSettled?: boolean;
  settledAt?: Date | null;
}

export const debtorService = {
  async list(userId: string, filter?: { type?: 'lent' | 'borrowed'; isSettled?: boolean }) {
    const query: Record<string, unknown> = { userId: toObjectId(userId) };
    if (filter?.type) query.type = filter.type;
    if (filter?.isSettled !== undefined) query.isSettled = filter.isSettled;
    return Debtor.find(query).sort({ date: -1, _id: -1 }).lean();
  },

  async create(userId: string, input: CreateDebtorInput): Promise<DebtorDoc> {
    return Debtor.create({ ...input, userId: toObjectId(userId) });
  },

  async getOne(userId: string, id: string): Promise<DebtorDoc> {
    const doc = await Debtor.findOne({ _id: toObjectId(id), userId: toObjectId(userId) });
    if (!doc) throw Errors.notFound(ErrorMessages.DEBTOR_NOT_FOUND, ErrorCodes.DEBTOR_NOT_FOUND);
    return doc;
  },

  async update(userId: string, id: string, input: UpdateDebtorInput): Promise<DebtorDoc> {
    const doc = await Debtor.findOneAndUpdate(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      { $set: input },
      { new: true },
    );
    if (!doc) throw Errors.notFound(ErrorMessages.DEBTOR_NOT_FOUND, ErrorCodes.DEBTOR_NOT_FOUND);
    return doc;
  },

  async markSettled(userId: string, id: string): Promise<DebtorDoc> {
    const doc = await Debtor.findOneAndUpdate(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      { $set: { isSettled: true, settledAt: new Date() } },
      { new: true },
    );
    if (!doc) throw Errors.notFound(ErrorMessages.DEBTOR_NOT_FOUND, ErrorCodes.DEBTOR_NOT_FOUND);
    return doc;
  },

  async remove(userId: string, id: string): Promise<void> {
    const doc = await Debtor.findOneAndDelete({ _id: toObjectId(id), userId: toObjectId(userId) });
    if (!doc) throw Errors.notFound(ErrorMessages.DEBTOR_NOT_FOUND, ErrorCodes.DEBTOR_NOT_FOUND);
  },
};
