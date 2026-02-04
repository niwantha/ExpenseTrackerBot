# Telegram Expense Tracker Bot 💰

A Telegram bot that helps you track daily expenses by logging them to Google Sheets. Simply send expense messages in your Telegram group, and the bot automatically records them in a spreadsheet.

## Features

- 📝 Log expenses with simple commands
- 📊 Automatic Google Sheets integration
- 💵 View total expenses
- 👥 Works in groups and private chats
- ⚡ Real-time updates
- 🔒 Secure with service account authentication

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Telegram account
- A Google account

## Setup Instructions

### 1. Clone and Install

```bash
# Navigate to the project directory
cd spendTrakerBot

# Install dependencies
npm install
```

### 2. Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to:
   - Choose a name for your bot (e.g., "My Expense Tracker")
   - Choose a username (must end in 'bot', e.g., "myexpense_tracker_bot")
4. Copy the **API token** you receive (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. **Important:** Disable privacy mode to allow the bot to read all messages:
   - Send `/setprivacy` to @BotFather
   - Select your bot
   - Choose "Disable"

### 3. Set Up Google Sheets

#### 3.1 Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it (e.g., "Expense Tracker")
4. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```

#### 3.2 Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

#### 3.3 Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Enter a name (e.g., "expense-tracker-bot")
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

#### 3.4 Generate Credentials

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON" format
5. Click "Create" - a JSON file will be downloaded
6. **Rename this file to `credentials.json`**
7. **Move it to your project root directory** (same level as `package.json`)

#### 3.5 Share Sheet with Service Account

1. Open your Google Sheet
2. Click the "Share" button
3. Copy the **email address** from `credentials.json` (looks like `your-service-account@project-id.iam.gserviceaccount.com`)
4. Paste it in the share dialog
5. Give it "Editor" permissions
6. Click "Send"

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   GOOGLE_CREDENTIALS_PATH=./credentials.json
   GOOGLE_SHEET_ID=your_google_sheet_id_here
   SHEET_NAME=Expenses
   ```

### 5. Build and Run

```bash
# Build the TypeScript code
npm run build

# Start the bot
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

You should see:
```
🚀 Starting Telegram Expense Tracker Bot...
✓ Configuration loaded
✓ Google Sheets service initialized
✓ Sheet initialized
✓ Telegram bot initialized
✓ Bot is running! Waiting for messages...
```

### 6. Add Bot to Your Group

1. Open your Telegram group
2. Click on the group name → "Add Members"
3. Search for your bot username
4. Add the bot to the group
5. The bot can now listen to messages and log expenses!

## Usage

### Log an Expense

```
/expense 50 groceries
/expense 20.5 lunch at cafe
/expense 100 electricity bill
```

The bot will respond:
```
✅ Expense logged: $50.00 for groceries
```

### View Total Expenses

```
/total
```

Response:
```
💵 Total expenses: $170.50
```

### Get Help

```
/help
```

### Commands Summary

| Command | Description | Example |
|---------|-------------|---------|
| `/expense <amount> <description>` | Log a new expense | `/expense 50 groceries` |
| `/total` | Show total of all expenses | `/total` |
| `/help` | Show help message | `/help` |
| `/start` | Show welcome message | `/start` |

## Google Sheet Format

The bot automatically creates a sheet with the following columns:

| Date | Amount | Description |
|------|--------|-------------|
| 2026-01-22 | 50 | groceries |
| 2026-01-22 | 20.5 | lunch at cafe |
| 2026-01-22 | 100 | electricity bill |

## Project Structure

```
spendTrakerBot/
├── src/
│   ├── bot.ts           # Main bot logic
│   ├── sheets.ts        # Google Sheets integration
│   ├── parser.ts        # Message parsing and validation
│   └── types.ts         # TypeScript interfaces
├── dist/                # Compiled JavaScript (generated)
├── credentials.json     # Google service account credentials (not committed)
├── .env                 # Environment variables (not committed)
├── env.example          # Environment variables template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Troubleshooting

### Bot doesn't respond to messages

- Make sure you disabled privacy mode in @BotFather
- Check that the bot is added to the group
- Verify the bot token in `.env` is correct

### "Permission denied" error

- Ensure you shared the Google Sheet with the service account email
- The email is in your `credentials.json` file
- Give "Editor" permissions

### "Spreadsheet not found" error

- Verify the `GOOGLE_SHEET_ID` in `.env` matches your sheet
- The ID is in the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### Bot crashes on startup

- Check that `credentials.json` exists in the project root
- Verify all environment variables are set in `.env`
- Make sure Google Sheets API is enabled in Google Cloud Console

## Security Notes

- Never commit `.env` or `credentials.json` to version control
- Keep your Telegram bot token secret
- Restrict Google Sheet access to only the service account
- Run the bot in a secure environment

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled bot
- `npm run dev` - Run with ts-node for development
- `npm run watch` - Watch for changes and recompile

### Making Changes

1. Edit files in the `src/` directory
2. Run `npm run build` to compile
3. Restart the bot with `npm start`

## License

MIT

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify all setup steps were completed
3. Check the console logs for error messages
4. Ensure your Node.js version is 16 or higher

---

Happy expense tracking! 💰📊
