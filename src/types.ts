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
}

/**
 * Result of parsing an expense message
 */
export interface ParseResult {
  success: boolean;
  expense?: Expense;
  error?: string;
}
