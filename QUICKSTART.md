# Quick Start Guide

Get your Telegram Expense Tracker Bot running in 15 minutes!

## Step-by-Step Checklist

### ☐ 1. Install Dependencies (2 minutes)
```bash
npm install
```

### ☐ 2. Create Telegram Bot (3 minutes)
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Choose a name: `My Expense Tracker`
4. Choose a username: `myexpense_tracker_bot` (must end with 'bot')
5. **Copy the API token** (you'll need this!)
6. Send `/setprivacy` to @BotFather → Select your bot → Choose "Disable"

### ☐ 3. Set Up Google Sheet (5 minutes)
1. Create a new [Google Sheet](https://sheets.google.com)
2. Copy the Sheet ID from URL (between `/d/` and `/edit`)
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Create new project or select existing
5. Enable "Google Sheets API" (APIs & Services → Library)
6. Create Service Account (APIs & Services → Credentials → Create Credentials)
7. Download JSON key file
8. **Rename it to `credentials.json`**
9. **Move it to project folder** (same level as package.json)
10. Open the JSON file and copy the `client_email`
11. **Share your Google Sheet with this email** (Editor access)

### ☐ 4. Configure Environment (2 minutes)
```bash
# Copy the example file
cp env.example .env

# Edit .env with your values:
# - Add your Telegram bot token
# - Add your Google Sheet ID
# - Verify credentials path: ./credentials.json
```

Your `.env` should look like:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_SHEET_ID=1a2b3c4d5e6f7g8h9i0j
SHEET_NAME=Expenses
```

### ☐ 5. Build and Run (1 minute)
```bash
# Build the project
npm run build

# Start the bot
npm start
```

You should see:
```
✓ Configuration loaded
✓ Google Sheets service initialized
✓ Sheet initialized
✓ Telegram bot initialized
✓ Bot is running!
```

### ☐ 6. Add Bot to Group (1 minute)
1. Open your Telegram group
2. Add Members → Search for your bot
3. Add it to the group

### ☐ 7. Test It! (1 minute)
In your Telegram group, send:
```
/expense 50 test expense
```

You should receive:
```
✅ Expense logged: $50.00 for test expense
```

Check your Google Sheet - you should see the expense!

## Common Issues

**Bot doesn't respond?**
- Did you disable privacy mode in @BotFather? (`/setprivacy`)
- Is the bot in the group?

**Permission denied?**
- Did you share the Google Sheet with the service account email?
- Check the email in `credentials.json` → `client_email`

**Can't find credentials.json?**
- Make sure it's in the project root folder
- Same directory as `package.json`

## Next Steps

Once everything works:
- Read the full [README.md](README.md) for all features
- Try `/total` to see your total expenses
- Try `/help` for all commands

## Need Help?

Check the detailed [README.md](README.md) troubleshooting section.

---

🎉 Happy tracking!
