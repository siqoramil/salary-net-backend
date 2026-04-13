import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

messageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type MessageDoc = InferSchemaType<typeof messageSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const Message: Model<MessageDoc> = model<MessageDoc>('Message', messageSchema);
