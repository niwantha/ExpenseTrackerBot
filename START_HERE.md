# 🚀 Start Here!

Welcome to your Telegram Expense Tracker Bot!

## What is this?

This bot lets you track daily expenses by simply sending messages in a Telegram group. All expenses are automatically saved to a Google Sheet.

**Example:**
```
You: /expense 50 groceries
Bot: ✅ Expense logged: $50.00 for groceries
```

Your Google Sheet automatically updates with:
| Date | Amount | Description |
|------|--------|-------------|
| 2026-01-22 | 50 | groceries |

## Quick Navigation

### 📖 Choose Your Path:

1. **Fast Setup (15 minutes)** → Read [QUICKSTART.md](QUICKSTART.md)
   - Step-by-step guide
   - Get running quickly
   
2. **Detailed Setup** → Read [README.md](README.md)
   - Complete documentation
   - All features explained
   - Troubleshooting guide

3. **Checklist Format** → Read [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)
   - Box-ticking format
   - Ensure nothing is missed

## What You'll Need

- ⏱️ **Time:** 15 minutes
- 📱 **Telegram** account
- 📊 **Google** account
- 💻 **Node.js** installed

## The 3 Main Steps

### 1️⃣ Create Telegram Bot
Talk to @BotFather on Telegram to get a bot token

### 2️⃣ Setup Google Sheets
Create a sheet and get API credentials

### 3️⃣ Configure & Run
Copy your tokens to `.env` file and start the bot

## Commands You'll Use

```bash
# Install dependencies
npm install

# Verify setup is correct
npm run verify

# Build the project
npm run build

# Start the bot
npm start
```

## Need Help?

- ❓ **Setup questions** → See [QUICKSTART.md](QUICKSTART.md)
- 🔧 **Issues** → See README.md troubleshooting section
- 📋 **Checklist** → See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)

## Ready?

👉 Open [QUICKSTART.md](QUICKSTART.md) and follow the steps!

---

**Pro tip:** Run `npm run verify` after setup to check if everything is configured correctly.
