export const EXPENSE_CATEGORIES = [
  { id: 'food', icon: '🍔', color: '#FF6B6B' },
  { id: 'transport', icon: '🚕', color: '#4ECDC4' },
  { id: 'grocery', icon: '🛒', color: '#45B7D1' },
  { id: 'health', icon: '💊', color: '#96CEB4' },
  { id: 'entertainment', icon: '🎮', color: '#FFEAA7' },
  { id: 'education', icon: '📚', color: '#DDA0DD' },
  { id: 'clothing', icon: '👕', color: '#98D8C8' },
  { id: 'housing', icon: '🏠', color: '#F7DC6F' },
  { id: 'utilities', icon: '💡', color: '#82E0AA' },
  { id: 'phone', icon: '📱', color: '#85C1E9' },
  { id: 'subscriptions', icon: '💳', color: '#BB8FCE' },
  { id: 'other', icon: '📦', color: '#AEB6BF' },
] as const;

export const CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id);
export type CategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

export const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LOCALES = ['en', 'ru', 'uz', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
