import { GoogleGenerativeAI } from '@google/generative-ai';
import { Conversation, Message, Expense, type MessageDoc } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { ErrorCodes, ErrorMessages } from '../utils/messages.js';
import { env } from '../config/env.js';
import { Types } from 'mongoose';

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;

const SYSTEM_PROMPT = `You are SalaryBot, a friendly and smart financial assistant inside the SalaryNet expense tracking app.

Your capabilities:
1. LOG EXPENSES: When a user tells you about spending (e.g., "I spent 50,000 on lunch"), extract: amount, category, description, and date/time. Confirm with user, then return a structured action.
2. FINANCIAL ADVICE: Analyze user's spending patterns and give personalized tips to save money.
3. SPENDING SUMMARIES: When asked "How much did I spend today/this week/this month?", use the provided context to respond with clear breakdowns.
4. CATEGORY ANALYSIS: "What am I spending the most on?" → analyze and answer.

Rules:
- Always respond in the user's preferred language (detect from message or use app locale).
- Keep responses concise (max 3-4 sentences unless detailed analysis requested).
- Use currency formatting appropriate to user's locale.
- When you decide to log an expense, end your reply with a JSON code block on its own line:
\`\`\`json
{"action":"create_expense","data":{"amount":50000,"currency":"UZS","category":"food","description":"Lunch","date":"<ISO datetime>"}}
\`\`\`
  Valid categories: food, transport, grocery, health, entertainment, education, clothing, housing, utilities, phone, subscriptions, other.
- Be encouraging about saving habits, not judgmental about spending.
- If user asks non-financial questions, gently redirect: "I'm best at helping with your finances! 😊"`;

interface UserContext {
  locale: string;
  defaultCurrency: string;
  recentExpensesSummary: string;
}

async function buildContext(userId: string): Promise<UserContext> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await Expense.aggregate<{ _id: string; total: number; count: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        expenseDate: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const summary = rows.length
    ? rows.map((r) => `- ${r._id}: ${r.total} (${r.count} txns)`).join('\n')
    : 'No expenses in the last 30 days yet.';

  return {
    locale: 'en',
    defaultCurrency: 'UZS',
    recentExpensesSummary: summary,
  };
}

function mockReply(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (/(spent|sarfladim|потратил|ausgegeben)/i.test(lower)) {
    const numMatch = userMessage.match(/(\d[\d\s,]*)/);
    const amount = numMatch ? Number(numMatch[1].replace(/[\s,]/g, '')) : 50000;
    return `Got it! Logging ${amount} UZS as a food expense.\n\n\`\`\`json\n{"action":"create_expense","data":{"amount":${amount},"currency":"UZS","category":"food","description":"From chat","date":"${new Date().toISOString()}"}}\n\`\`\``;
  }
  if (/(how much|qancha|сколько|wie viel)/i.test(lower)) {
    return 'Based on your recent expenses, you are tracking your spending well! Add GEMINI_API_KEY to enable detailed analysis.';
  }
  return "Hi! I'm SalaryBot. GEMINI_API_KEY is not set, so I'm running in mock mode. Try saying 'I spent 50000 on lunch'.";
}

export const chatService = {
  async listConversations(userId: string) {
    return Conversation.find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .lean();
  },

  async createConversation(userId: string, title?: string) {
    return Conversation.create({
      userId: new Types.ObjectId(userId),
      title: title ?? null,
    });
  },

  async getOrCreateLatest(userId: string) {
    const existing = await Conversation.findOne({
      userId: new Types.ObjectId(userId),
    }).sort({ updatedAt: -1 });
    if (existing) return existing;
    return Conversation.create({
      userId: new Types.ObjectId(userId),
      title: 'New chat',
    });
  },

  async listMessages(conversationId: string, userId: string, limit = 50, beforeId?: string) {
    const conv = await Conversation.findOne({
      _id: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });
    if (!conv) throw Errors.notFound(ErrorMessages.CONVERSATION_NOT_FOUND, ErrorCodes.CONVERSATION_NOT_FOUND);

    const filter: Record<string, unknown> = { conversationId: conv._id };
    if (beforeId) filter._id = { $lt: new Types.ObjectId(beforeId) };

    const items = await Message.find(filter).sort({ _id: -1 }).limit(limit).lean();
    return items.reverse();
  },

  async sendMessage(conversationId: string, userId: string, content: string): Promise<MessageDoc> {
    const conv = await Conversation.findOne({
      _id: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });
    if (!conv) throw Errors.notFound(ErrorMessages.CONVERSATION_NOT_FOUND, ErrorCodes.CONVERSATION_NOT_FOUND);

    // Save user message
    await Message.create({
      conversationId: conv._id,
      role: 'user',
      content,
    });

    // Build context + previous messages
    const ctx = await buildContext(userId);
    const previous = await Message.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    let assistantText: string;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: env.GEMINI_MODEL,
          systemInstruction:
            SYSTEM_PROMPT +
            `\n\n=== USER CONTEXT ===\nLocale: ${ctx.locale}\nDefault currency: ${ctx.defaultCurrency}\nRecent expenses (last 30 days):\n${ctx.recentExpensesSummary}`,
        });

        const history = previous.slice(0, -1).map((m) => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content }],
        }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(content);
        assistantText = result.response.text() || '(empty response)';
      } catch (err) {
        assistantText = `Sorry, I had trouble reaching the AI service. (${(err as Error).message})`;
      }
    } else {
      assistantText = mockReply(content);
    }

    // Parse optional action JSON from assistant text
    const actionMatch = assistantText.match(/```json\s*([\s\S]*?)```/);
    let metadata: unknown = null;
    if (actionMatch) {
      try {
        metadata = JSON.parse(actionMatch[1]);
      } catch {
        /* ignore malformed JSON */
      }
    }

    const assistantMsg = await Message.create({
      conversationId: conv._id,
      role: 'assistant',
      content: assistantText,
      metadata,
    });

    // Touch conversation updatedAt
    conv.set('updatedAt', new Date());
    await conv.save();

    return assistantMsg;
  },

  async deleteConversation(conversationId: string, userId: string) {
    const conv = await Conversation.findOneAndDelete({
      _id: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    });
    if (!conv) throw Errors.notFound(ErrorMessages.CONVERSATION_NOT_FOUND, ErrorCodes.CONVERSATION_NOT_FOUND);
    await Message.deleteMany({ conversationId: conv._id });
  },
};
