import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const debtorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['lent', 'borrowed'], required: true, default: 'lent' },
    personName: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['UZS', 'USD', 'EUR', 'RUB'], required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, maxlength: 500, default: '' },
    isSettled: { type: Boolean, default: false },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

debtorSchema.index({ userId: 1, date: -1 });

debtorSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type DebtorDoc = InferSchemaType<typeof debtorSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const Debtor: Model<DebtorDoc> = model<DebtorDoc>('Debtor', debtorSchema);
