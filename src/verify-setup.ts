#!/usr/bin/env node
/**
 * Setup verification script
 * Run this to check if all configuration is correct before starting the bot
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function addCheck(name: string, passed: boolean, message: string) {
  checks.push({ name, passed, message });
}

console.log('🔍 Verifying Telegram Expense Tracker Bot Setup\n');

// Check 1: Environment file exists
const envExists = fs.existsSync('.env');
addCheck(
  'Environment file',
  envExists,
  envExists ? '✓ .env file found' : '✗ .env file not found. Copy env.example to .env'
);

// Check 2: Telegram bot token
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const hasToken = !!telegramToken && telegramToken !== 'your_bot_token_here';
addCheck(
  'Telegram bot token',
  hasToken,
  hasToken ? '✓ Telegram bot token configured' : '✗ TELEGRAM_BOT_TOKEN not set or still has default value'
);

// Check 3: Google credentials path
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
const credentialsExist = fs.existsSync(credentialsPath);
addCheck(
  'Google credentials file',
  credentialsExist,
  credentialsExist 
    ? `✓ Credentials file found at ${credentialsPath}` 
    : `✗ Credentials file not found at ${credentialsPath}`
);

// Check 4: Validate credentials JSON
let serviceAccountEmail = '';
if (credentialsExist) {
  try {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const credentials = JSON.parse(credentialsContent);
    
    const hasRequiredFields = credentials.client_email && credentials.private_key;
    serviceAccountEmail = credentials.client_email || '';
    
    addCheck(
      'Credentials format',
      hasRequiredFields,
      hasRequiredFields 
        ? '✓ Credentials file is valid' 
        : '✗ Credentials file is missing required fields'
    );
  } catch (error) {
    addCheck('Credentials format', false, '✗ Credentials file is not valid JSON');
  }
}

// Check 5: Google Sheet ID
const sheetId = process.env.GOOGLE_SHEET_ID;
const hasSheetId = !!sheetId && sheetId !== 'your_google_sheet_id_here';
addCheck(
  'Google Sheet ID',
  hasSheetId,
  hasSheetId ? '✓ Google Sheet ID configured' : '✗ GOOGLE_SHEET_ID not set or still has default value'
);

// Check 6: Sheet name
const sheetName = process.env.SHEET_NAME || 'Expenses';
addCheck(
  'Sheet name',
  true,
  `✓ Sheet name: ${sheetName}`
);

// Print results
console.log('Configuration Checks:\n');
checks.forEach(check => {
  console.log(`${check.passed ? '✓' : '✗'} ${check.name}`);
  console.log(`  ${check.message}\n`);
});

// Summary
const passedChecks = checks.filter(c => c.passed).length;
const totalChecks = checks.length;
const allPassed = passedChecks === totalChecks;

console.log('\n' + '='.repeat(50));
console.log(`Summary: ${passedChecks}/${totalChecks} checks passed`);
console.log('='.repeat(50) + '\n');

if (allPassed) {
  console.log('🎉 All checks passed! Your bot is ready to run.');
  console.log('\nNext steps:');
  console.log('1. Build the project: npm run build');
  console.log('2. Start the bot: npm start');
  
  if (serviceAccountEmail) {
    console.log(`\n⚠️  IMPORTANT: Make sure you shared your Google Sheet with:`);
    console.log(`   ${serviceAccountEmail}`);
  }
  
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  console.log('\nFor detailed setup instructions, see:');
  console.log('- QUICKSTART.md (quick guide)');
  console.log('- README.md (detailed guide)');
  process.exit(1);
}
