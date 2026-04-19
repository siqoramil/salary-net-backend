import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const otpCodeSchema = new Schema(
  {
    target: { type: String, required: true, index: true }, // phone or email
    channel: { type: String, enum: ['phone', 'email'], required: true },
    code: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['signup', 'reset_password', 'email_change', 'account_delete'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    payload: { type: Schema.Types.Mixed, default: null }, // pending signup data
  },
  { timestamps: true },
);

// Auto-delete expired OTPs
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpCodeDoc = InferSchemaType<typeof otpCodeSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const OtpCode: Model<OtpCodeDoc> = model<OtpCodeDoc>('OtpCode', otpCodeSchema);
