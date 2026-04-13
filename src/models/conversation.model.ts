import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, maxlength: 200, default: null },
  },
  { timestamps: true },
);

conversationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const Conversation: Model<ConversationDoc> = model<ConversationDoc>(
  'Conversation',
  conversationSchema,
);
