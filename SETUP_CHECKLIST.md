# Setup Checklist ✅

Use this checklist to ensure you complete all setup steps.

## Pre-Setup
- [ ] Node.js installed (v16+)
- [ ] Telegram account
- [ ] Google account

## Installation
- [ ] Navigate to project directory
- [ ] Run `npm install`
- [ ] Verify installation completed without errors

## Telegram Bot Setup
- [ ] Open Telegram
- [ ] Find @BotFather
- [ ] Send `/newbot` command
- [ ] Enter bot name
- [ ] Enter bot username (must end with 'bot')
- [ ] Save bot token somewhere safe
- [ ] Send `/setprivacy` to @BotFather
- [ ] Select your bot
- [ ] Choose "Disable" privacy mode

## Google Cloud Setup
- [ ] Go to Google Cloud Console
- [ ] Create new project (or select existing)
- [ ] Enable Google Sheets API
- [ ] Go to "APIs & Services" → "Credentials"
- [ ] Create Service Account
- [ ] Name the service account
- [ ] Click through to complete creation
- [ ] Click on service account
- [ ] Go to "Keys" tab
- [ ] Add Key → Create new key
- [ ] Choose JSON format
- [ ] Download the JSON file
- [ ] Rename file to `credentials.json`
- [ ] Move to project root directory

## Google Sheet Setup
- [ ] Create new Google Sheet
- [ ] Copy Sheet ID from URL
- [ ] Open `credentials.json`
- [ ] Find `client_email` field
- [ ] Copy the email address
- [ ] Click "Share" on your Google Sheet
- [ ] Paste the service account email
- [ ] Give "Editor" permissions
- [ ] Click "Send"

## Configuration
- [ ] Copy `env.example` to `.env`
- [ ] Open `.env` in text editor
- [ ] Paste Telegram bot token
- [ ] Paste Google Sheet ID
- [ ] Verify credentials path: `./credentials.json`
- [ ] Optionally change sheet name (default: "Expenses")
- [ ] Save `.env` file

## Verification
- [ ] Run `npm run verify` to check setup
- [ ] All checks should pass
- [ ] Fix any failed checks

## Build and Run
- [ ] Run `npm run build`
- [ ] Build completes without errors
- [ ] Run `npm start`
- [ ] Bot starts successfully
- [ ] See confirmation messages

## Telegram Group Setup
- [ ] Open Telegram group
- [ ] Click group name
- [ ] Click "Add Members"
- [ ] Search for bot username
- [ ] Add bot to group

## Testing
- [ ] Send `/start` in group - bot should respond
- [ ] Send `/expense 50 test` - bot should confirm
- [ ] Check Google Sheet - expense should appear
- [ ] Send `/total` - bot should show total
- [ ] Send `/help` - bot should show commands

## Security Check
- [ ] `.env` is in `.gitignore`
- [ ] `credentials.json` is in `.gitignore`
- [ ] Don't share bot token publicly
- [ ] Don't commit credentials to git

## Done! 🎉

Your expense tracker bot is now ready to use!

---

**Need help?** Check these files:
- `QUICKSTART.md` - Quick setup guide
- `README.md` - Comprehensive documentation
