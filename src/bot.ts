import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { SheetsService } from './sheets';
import { parseExpenseMessage, formatExpense } from './parser';
import { BotConfig } from './types';

// Load environment variables
dotenv.config();

/**
 * Loads configuration from environment variables
 */
function loadConfig(): BotConfig {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const googleCredentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Expenses';

  if (!telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  if (!googleCredentialsPath) {
    throw new Error('GOOGLE_CREDENTIALS_PATH is not set in environment variables');
  }

  if (!googleSheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in environment variables');
  }

  return {
    telegramToken,
    googleCredentialsPath,
    googleSheetId,
    sheetName
  };
}

/**
 * Main function to initialize and run the bot
 */
async function main() {
  try {
    console.log('🚀 Starting Telegram Expense Tracker Bot...');

    // Load configuration
    const config = loadConfig();
    console.log('✓ Configuration loaded');

    // Initialize Google Sheets service
    const sheetsService = new SheetsService(
      config.googleCredentialsPath,
      config.googleSheetId,
      config.sheetName
    );
    console.log('✓ Google Sheets service initialized');

    // Initialize the sheet with headers
    await sheetsService.initializeSheet();
    console.log('✓ Sheet initialized');

    // Create bot instance
    const bot = new TelegramBot(config.telegramToken, { polling: true });
    console.log('✓ Telegram bot initialized');

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const monthName = sheetsService.getCurrentMonthName();
      const welcomeMessage = `
Welcome to Expense Tracker Bot! 💰

To log an expense, use the following format:
/expense <amount> <description>

Examples:
• /expense 50 groceries
• /expense 20.5 lunch at cafe
• /expense 100 electricity bill

Expenses are organized by month (currently: ${monthName})

Other commands:
• /total - Get current month's total
• /total_all - Get all-time total
• /help - Show this help message
      `.trim();

      bot.sendMessage(chatId, welcomeMessage);
    });

    // Handle /help command
    bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const monthName = sheetsService.getCurrentMonthName();
      const helpMessage = `
📊 Expense Tracker Bot Commands:

/expense <amount> <description>
  Log a new expense (saved to ${monthName} tab)
  Example: /expense 50 groceries

/total
  Show current month's total (${monthName})

/total_all
  Show total across all months

/help
  Show this help message

/start
  Show welcome message
      `.trim();

      bot.sendMessage(chatId, helpMessage);
    });

    // Handle /total command (current month)
    bot.onText(/\/total$/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const total = await sheetsService.getTotalExpenses();
        const monthName = sheetsService.getCurrentMonthName();
        bot.sendMessage(chatId, `💵 Total expenses for ${monthName}: $${total.toFixed(2)}`);
      } catch (error: any) {
        console.error('Error getting total:', error);
        bot.sendMessage(chatId, '❌ Error calculating total expenses. Please try again.');
      }
    });

    // Handle /total_all command (all months)
    bot.onText(/\/total_all/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const total = await sheetsService.getTotalAllExpenses();
        bot.sendMessage(chatId, `💵 Total expenses (all months): $${total.toFixed(2)}`);
      } catch (error: any) {
        console.error('Error getting total:', error);
        bot.sendMessage(chatId, '❌ Error calculating total expenses. Please try again.');
      }
    });

    // Handle /expense command
    bot.onText(/\/expense/, async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';

      // Parse the expense message
      const parseResult = parseExpenseMessage(text, username);

      if (!parseResult.success) {
        bot.sendMessage(chatId, `❌ ${parseResult.error}\n\nUse: /expense <amount> <description>`);
        return;
      }

      // Log the expense to Google Sheets
      try {
        await sheetsService.logExpense(parseResult.expense!);
        const formattedExpense = formatExpense(parseResult.expense!);
        bot.sendMessage(chatId, `✅ Expense logged: ${formattedExpense}`);
      } catch (error: any) {
        console.error('Error logging expense:', error);
        bot.sendMessage(chatId, '❌ Failed to log expense. Please check the bot logs.');
      }
    });

    // Handle polling errors
    bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    // Log successful startup
    console.log('✓ Bot is running! Waiting for messages...');
    console.log('Press Ctrl+C to stop the bot');

  } catch (error: any) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down bot...');
  process.exit(0);
});

// Start the bot
main();
