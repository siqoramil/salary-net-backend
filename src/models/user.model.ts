import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, minlength: 2, maxlength: 100, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    defaultCurrency: {
      type: String,
      enum: ['UZS', 'USD', 'EUR', 'RUB'],
      default: 'UZS',
    },
    locale: {
      type: String,
      enum: ['en', 'ru', 'fr', 'es', 'ar', 'zh', 'ko', 'ja'],
      default: 'en',
    },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import('mongoose').Types.ObjectId };
export const User: Model<UserDoc> = model<UserDoc>('User', userSchema);
