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
  const targetExpense = process.env.TARGET_EXPENSE ? parseFloat(process.env.TARGET_EXPENSE) : undefined;

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
    sheetName,
    targetExpense
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
      config.sheetName,
      config.targetExpense || 0
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
/expense <amount> [<type>] <description>

Examples:
• /expense 50 groceries
• /expense 20.5 lunch at cafe
• /expense 100 food electricity bill
• /expense 50 transport taxi

Expenses are organized by month (currently: ${monthName})

Other commands:
• /total - Get current month's total
• /total_all - Get all-time total
• /set_target <amount> - Set target expense for current month
• /setup_sheet - Initialize or migrate sheet to new format
• /help - Show this help message
      `.trim();

      bot.sendMessage(chatId, welcomeMessage);
    });

    // Handle /help command
    bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const monthName = sheetsService.getCurrentMonthName();
      const helpMessage = `
📊 Expense Tracker Bot - All Commands

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Expense Management:

/expense <amount> [<type>] <description>
Log a new expense to ${monthName} sheet

Examples:
• /expense 50 groceries
• /expense 100 food lunch at restaurant
• /expense 25 transport taxi ride
• /expense 1500 utilities electricity bill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 View Totals:

/total
Show current month's total expenses (${monthName})
Example: /total

/total_all
Show total expenses across all months
Example: /total_all

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Budget Management:

/set_target <amount>
Set target expense (budget) for current month

Examples:
• /set_target 150000
• /set_target 50000
• /set_target 200000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ Sheet Setup:

/setup_sheet
Reset sheet to initial state (clears all data)
⚠️ Warning: This will delete all existing expenses!
Example: /setup_sheet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️ General:

/help
Show this help message
Example: /help

/start
Show welcome message
Example: /start

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tips:
• Expenses are organized by month (${monthName})
• Type is optional - you can skip it
• Use /setup_sheet to reset if needed
• Target expense helps track your budget
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

    // Handle /set_target command
    bot.onText(/\/set_target/, async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';

      // Parse the target amount
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        bot.sendMessage(chatId, '❌ Invalid format. Use: /set_target <amount>\nExample: /set_target 150000');
        return;
      }

      const targetAmount = parseFloat(parts[1]);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        bot.sendMessage(chatId, '❌ Invalid amount. Must be a positive number.');
        return;
      }

      try {
        const monthName = sheetsService.getCurrentMonthName();
        await sheetsService.setTargetExpense(monthName, targetAmount);
        bot.sendMessage(chatId, `✅ Target expense set to $${targetAmount.toFixed(2)} for ${monthName}`);
      } catch (error: any) {
        console.error('Error setting target expense:', error);
        bot.sendMessage(chatId, '❌ Failed to set target expense. Please check the bot logs.');
      }
    });

    // Handle /setup_sheet command
    bot.onText(/\/setup_sheet/, async (msg) => {
      const chatId = msg.chat.id;
      const monthName = sheetsService.getCurrentMonthName();

      // Always ask for confirmation - this will clear ALL data
      bot.sendMessage(
        chatId,
        `⚠️ This will reset sheet "${monthName}" to initial state.\n\n` +
        `⚠️ ALL existing data will be cleared!\n\n` +
        `Click a button below to confirm or cancel:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ OK - Reset Sheet', callback_data: `setup_reset_${encodeURIComponent(monthName)}` }],
              [{ text: '❌ Cancel', callback_data: 'setup_cancel' }]
            ]
          }
        }
      );
    });

    // Handle callback queries for setup confirmation
    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId) return;

      if (data?.startsWith('setup_reset_')) {
        // Extract sheet name (may contain spaces, so decode it)
        const sheetName = decodeURIComponent(data.replace('setup_reset_', ''));
        
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Resetting sheet...' });
          
          const result = await sheetsService.resetSheetToInitialState(sheetName);
          
          if (result.success) {
            bot.sendMessage(chatId, `✅ ${result.message}`);
          } else {
            bot.sendMessage(chatId, `❌ ${result.message}`);
          }
        } catch (error: any) {
          console.error('Error during reset:', error);
          bot.sendMessage(chatId, `❌ Failed to reset sheet: ${error.message}`);
        }
      } else if (data === 'setup_cancel') {
        await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
        bot.sendMessage(chatId, '❌ Sheet reset cancelled.');
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
