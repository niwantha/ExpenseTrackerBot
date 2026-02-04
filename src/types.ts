/**
 * Represents a single expense entry
 */
export interface Expense {
  date: string;
  type?: string;
  amount: number;
  description: string;
  username?: string;
}

/**
 * Configuration for the bot
 */
export interface BotConfig {
  telegramToken: string;
  googleCredentialsPath: string;
  googleSheetId: string;
  sheetName: string;
  targetExpense?: number;
  adminUserId?: number;
}

/**
 * Predefined expense types
 */
export const EXPENSE_TYPES = [
  'Super Market',
  'Fuel',
  'Car Repair',
  'Pharmacy',
  'Rent',
  'Other',
  'None',
  'Salon',
  'Hospital',
  'Bruno',
  'Bills',
  'Car'
] as const;

/**
 * Result of parsing an expense message
 */
export interface ParseResult {
  success: boolean;
  expense?: Expense;
  error?: string;
}
