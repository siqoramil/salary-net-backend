import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const budgetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['UZS', 'USD', 'EUR', 'RUB'], required: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, category: 1, period: 1 }, { unique: true });

budgetSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type BudgetDoc = InferSchemaType<typeof budgetSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const Budget: Model<BudgetDoc> = model<BudgetDoc>('Budget', budgetSchema);
