import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { SheetsService } from './sheets';
import { parseExpenseMessage, formatExpense } from './parser';
import { BotConfig, EXPENSE_TYPES } from './types';

// Load environment variables
dotenv.config();

// Temporary storage for pending expenses (callbackId -> expense data)
const pendingExpenses = new Map<string, { amount: number; description: string; username?: string; date: string }>();

/**
 * Creates an inline keyboard with expense type buttons
 * @param callbackId Unique ID to identify this expense selection
 * @returns Inline keyboard markup
 */
function createTypeSelectionKeyboard(callbackId: string): TelegramBot.InlineKeyboardMarkup {
  const buttons: TelegramBot.InlineKeyboardButton[][] = [];
  
  // Arrange types in 3 columns
  for (let i = 0; i < EXPENSE_TYPES.length; i += 3) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
    for (let j = 0; j < 3 && i + j < EXPENSE_TYPES.length; j++) {
      const type = EXPENSE_TYPES[i + j];
      row.push({
        text: type,
        callback_data: `exp_type_${callbackId}_${type}`
      });
    }
    buttons.push(row);
  }
  
  // Add Skip button at the end
  buttons.push([{
    text: '⏭️ Skip',
    callback_data: `exp_type_${callbackId}_None`
  }]);
  
  return {
    inline_keyboard: buttons
  };
}

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

    // Register bot commands for autocomplete suggestions
    // Note: Clicking a command suggestion inserts it into the input field (doesn't send)
    // Users can then add parameters and press Enter to send
    const commands = [
      {
        command: 'expense',
        description: 'Log expense: /expense <amount> <description>'
      },
      {
        command: 'ex',
        description: 'Log expense (short): /ex <amount> <description>'
      },
      {
        command: 'total',
        description: 'Show current month total'
      },
      {
        command: 'total_all',
        description: 'Show all-time total'
      },
      {
        command: 'set_target',
        description: 'Set budget: /set_target <amount>'
      },
      {
        command: 'setup_sheet',
        description: 'Reset sheet (clears all data)'
      },
      {
        command: 'help',
        description: 'Show help with all commands'
      },
      {
        command: 'start',
        description: 'Show welcome message'
      }
    ];

    try {
      // Register commands for private chats (default)
      await bot.setMyCommands(commands);
      console.log('✓ Bot commands registered for private chats');
      
      // Also register commands for group chats
      await bot.setMyCommands(commands, { scope: { type: 'all_group_chats' } });
      console.log('✓ Bot commands registered for group chats');
    } catch (error: any) {
      console.warn('⚠️ Could not register bot commands:', error.message);
      console.warn('Commands will still work, but autocomplete may not be available');
    }

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const monthName = sheetsService.getCurrentMonthName();
      const welcomeMessage = `
Welcome to Expense Tracker Bot! 💰

To log an expense, use the following format:
/expense <amount> [description]
/ex <amount> [description] (short)

Examples:
• /ex 500
• /ex 500 food
• /expense 50 groceries

After sending, you'll be asked to select a type.

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

/expense <amount> [description]
/ex <amount> [description] (short)
Log a new expense to ${monthName} sheet
(Description is optional. Type will be selected via buttons.)

Examples:
• /ex 500
• /ex 500 food
• /expense 50 groceries

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

    // Handle callback queries for setup confirmation and type selection
    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId) return;

      // Handle expense type selection
      if (data?.startsWith('exp_type_')) {
        try {
          // Parse callback data: exp_type_<callbackId>_<type>
          // Find the last underscore to separate callbackId and type
          const dataWithoutPrefix = data.replace('exp_type_', '');
          const lastUnderscoreIndex = dataWithoutPrefix.lastIndexOf('_');
          
          if (lastUnderscoreIndex === -1) {
            throw new Error('Invalid callback data format');
          }
          
          const callbackId = dataWithoutPrefix.substring(0, lastUnderscoreIndex);
          const type = dataWithoutPrefix.substring(lastUnderscoreIndex + 1);

          // Get pending expense data
          const expenseData = pendingExpenses.get(callbackId);
          
          if (!expenseData) {
            await bot.answerCallbackQuery(query.id, { text: '❌ Expense data not found. Please try again.' });
            return;
          }

          // Create expense with selected type
          const expense = {
            date: expenseData.date,
            type: type === 'None' ? undefined : type,
            amount: expenseData.amount,
            description: expenseData.description,
            username: expenseData.username || query.from?.username || query.from?.first_name || 'Unknown'
          };

          // Log the expense
          await sheetsService.logExpense(expense);
          
          // Clear pending expense
          pendingExpenses.delete(callbackId);

          // Answer callback query
          await bot.answerCallbackQuery(query.id, { text: `✅ Expense logged${type === 'None' ? '' : ` with type: ${type}`}` });

          // Send confirmation message
          const typeText = type === 'None' ? '' : ` (${type})`;
          const descriptionText = expenseData.description 
            ? ` for ${expenseData.description}` 
            : '';
          bot.sendMessage(chatId, `✅ Expense logged: $${expenseData.amount.toFixed(2)}${descriptionText}${typeText}`);

          // Edit the original message to remove buttons
          if (query.message) {
            try {
              const descriptionText = expenseData.description 
                ? ` - ${expenseData.description}` 
                : '';
              await bot.editMessageText(
                `💰 Expense: $${expenseData.amount.toFixed(2)}${descriptionText}\n\n✅ Type selected: ${type === 'None' ? 'No type' : type}`,
                {
                  chat_id: chatId,
                  message_id: query.message.message_id
                }
              );
            } catch (editError) {
              // Ignore edit errors (message might be too old or already edited)
            }
          }
        } catch (error: any) {
          console.error('Error handling type selection:', error);
          await bot.answerCallbackQuery(query.id, { text: '❌ Error logging expense' });
          bot.sendMessage(chatId, '❌ Failed to log expense. Please try again.');
        }
        return;
      }

      // Handle setup sheet reset
      if (data?.startsWith('setup_reset_')) {
        // Extract sheet name (may contain spaces, so decode it)
        const sheetName = decodeURIComponent(data.replace('setup_reset_', ''));
        
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Resetting sheet...' });
          
          // Reset sheet with target expense of 150000
          const result = await sheetsService.resetSheetToInitialState(sheetName, 150000);
          
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

    /**
     * Handles expense command (both /expense and /ex)
     */
    const handleExpenseCommand = async (msg: TelegramBot.Message) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';

      // Check if only command was sent without parameters
      const trimmedText = text.trim();
      const isExpense = /^\/expense(@\w+)?$/.test(trimmedText);
      const isEx = /^\/ex(@\w+)?$/.test(trimmedText);
      
      if (isExpense || isEx) {
        bot.sendMessage(
          chatId,
          `💡 *Tip:* After selecting the command from suggestions, add your amount (and optional description) before sending.\n\n` +
          `*Format:* /expense <amount> [description]\n` +
          `*Short:* /ex <amount> [description]\n\n` +
          `*Examples:*\n` +
          `• /expense 50\n` +
          `• /ex 500 food\n` +
          `• /ex 25 transport taxi ride\n\n` +
          `After sending, you'll be asked to select a type.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Parse the expense message
      const parseResult = parseExpenseMessage(text, username);

      if (!parseResult.success) {
        bot.sendMessage(
          chatId,
          `❌ ${parseResult.error}\n\n` +
          `*Format:* /expense <amount> [description]\n` +
          `*Short:* /ex <amount> [description]\n\n` +
          `*Examples:*\n` +
          `• /ex 500\n` +
          `• /ex 500 food\n` +
          `• /expense 50 groceries`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const expense = parseResult.expense!;

      // Always show type selection (type is never parsed from command)
      const expenseData = {
        amount: expense.amount,
        description: expense.description,
        username: expense.username,
        date: expense.date
      };

      // Generate unique callback ID (chatId + timestamp)
      const callbackId = `${chatId}_${Date.now()}`;

      // Store pending expense
      pendingExpenses.set(callbackId, expenseData);

      // Show type selection buttons
      const descriptionText = expense.description 
        ? ` - ${expense.description}` 
        : '';
      bot.sendMessage(
        chatId,
        `💰 Expense: $${expense.amount.toFixed(2)}${descriptionText}\n\n` +
        `Select expense type:`,
        {
          reply_markup: createTypeSelectionKeyboard(callbackId)
        }
      );
    };

    // Handle /expense command
    bot.onText(/\/expense/, handleExpenseCommand);

    // Handle /ex command (short alias)
    bot.onText(/^\/ex(\s|$)/, handleExpenseCommand);

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
