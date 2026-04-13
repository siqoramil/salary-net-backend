import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const expenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['UZS', 'USD', 'EUR', 'RUB'], required: true },
    category: { type: String, required: true },
    description: { type: String, maxlength: 500, default: '' },
    receiptUrl: { type: String, default: null },
    expenseDate: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

expenseSchema.index({ userId: 1, expenseDate: -1 });

expenseSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const Expense: Model<ExpenseDoc> = model<ExpenseDoc>('Expense', expenseSchema);
