import { Expense, ParseResult } from './types';

/**
 * Parses an expense message in the format: /expense <amount> <description>
 * @param text The message text to parse
 * @param username Optional username of the person who sent the message
 * @returns ParseResult with either the parsed expense or an error message
 */
export function parseExpenseMessage(text: string, username?: string): ParseResult {
  // Remove leading/trailing whitespace
  const trimmed = text.trim();

  // Check if message starts with /expense
  if (!trimmed.startsWith('/expense')) {
    return {
      success: false,
      error: 'Message must start with /expense'
    };
  }

  // Remove the /expense command and split the rest
  const parts = trimmed.slice(8).trim().split(/\s+/);

  // Need at least amount and description
  if (parts.length < 2) {
    return {
      success: false,
      error: 'Invalid format. Use: /expense <amount> <description>'
    };
  }

  // Parse the amount (first part)
  const amountStr = parts[0];
  const amount = parseFloat(amountStr);

  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      error: 'Invalid amount. Must be a positive number.'
    };
  }

  // Get description (rest of the parts)
  const description = parts.slice(1).join(' ');

  if (!description || description.trim().length === 0) {
    return {
      success: false,
      error: 'Description cannot be empty.'
    };
  }

  // Get current date in YYYY-MM-DD format
  const date = new Date().toISOString().split('T')[0];

  const expense: Expense = {
    date,
    amount,
    description: description.trim(),
    username
  };

  return {
    success: true,
    expense
  };
}

/**
 * Formats an expense for display
 * @param expense The expense to format
 * @returns Formatted string representation
 */
export function formatExpense(expense: Expense): string {
  return `$${expense.amount.toFixed(2)} for ${expense.description}`;
}
