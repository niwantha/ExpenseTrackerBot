import { Expense, ParseResult } from './types';

/**
 * Parses an expense message in the format: /expense <amount> [description]
 * Type is selected via buttons, not from the command text.
 * @param text The message text to parse
 * @param username Optional username of the person who sent the message
 * @returns ParseResult with either the parsed expense or an error message
 */
export function parseExpenseMessage(text: string, username?: string): ParseResult {
  // Remove leading/trailing whitespace
  const trimmed = text.trim();

  // Check if message starts with /expense or /ex
  let commandLength = 0;
  if (trimmed.startsWith('/expense')) {
    commandLength = 8; // '/expense'.length
  } else if (trimmed.startsWith('/ex ')) {
    commandLength = 3; // '/ex '.length
  } else if (trimmed.startsWith('/ex@')) {
    // Handle /ex@botname format
    const match = trimmed.match(/^\/ex@\w+\s/);
    if (match) {
      commandLength = match[0].length;
    } else {
      return {
        success: false,
        error: 'Message must start with /expense or /ex'
      };
    }
  } else {
    return {
      success: false,
      error: 'Message must start with /expense or /ex'
    };
  }

  // Remove the command and split the rest
  const parts = trimmed.slice(commandLength).trim().split(/\s+/);

  // Need at least amount
  if (parts.length < 1 || parts[0].trim().length === 0) {
    return {
      success: false,
      error: 'Invalid format. Use: /expense <amount> [description]'
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

  // Description is optional - if provided, use it
  // Format: /expense <amount> [description]
  // Note: We don't parse type from command anymore - type is selected via buttons
  let description: string = '';

  if (parts.length >= 2) {
    // Format: /expense <amount> <description>
    description = parts.slice(1).join(' ').trim();
  }

  // Get current date in YYYY-MM-DD format
  const date = new Date().toISOString().split('T')[0];

  const expense: Expense = {
    date,
    type: undefined, // Type is always selected via buttons, not from command
    amount,
    description: description || '', // Description is optional
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
  const descriptionText = expense.description 
    ? ` for ${expense.description}` 
    : '';
  return `$${expense.amount.toFixed(2)}${descriptionText}`;
}
