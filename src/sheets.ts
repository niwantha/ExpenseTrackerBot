import { google } from 'googleapis';
import { Expense, EXPENSE_TYPES } from './types';
import * as fs from 'fs';

/**
 * Google Sheets service for managing expense logging
 */
export class SheetsService {
  private sheets;
  private auth;
  private spreadsheetId: string;
  private sheetName: string;
  private targetExpense: number;

  constructor(credentialsPath: string, spreadsheetId: string, sheetName: string = 'Expenses', targetExpense: number = 0) {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.targetExpense = targetExpense;

    // Load credentials
    let credentials;
    try {
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Credentials file not found at: ${credentialsPath}`);
      }
      const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Credentials file not found at: ${credentialsPath}. Please check GOOGLE_CREDENTIALS_PATH in your .env file.`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in credentials file: ${error.message}`);
      }
      throw new Error(`Error reading credentials file: ${error.message}`);
    }

    // Validate required fields
    if (!credentials.client_email) {
      throw new Error('Credentials file is missing "client_email" field');
    }
    if (!credentials.private_key) {
      throw new Error('Credentials file is missing "private_key" field');
    }

    // Fix private key if it has escaped newlines
    const privateKey = credentials.private_key.replace(/\\n/g, '\n');

    // Validate private key format (should start with -----BEGIN PRIVATE KEY-----)
    if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
      console.warn('Warning: Private key format may be incorrect. Expected to contain "BEGIN PRIVATE KEY"');
    }

    // Create JWT auth client
    this.auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    // Initialize sheets API
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Generates a monthly sheet name based on the date
   * @param date The date to generate the sheet name for (defaults to current date)
   * @returns Sheet name in format "Feb 2026"
   */
  private getMonthlySheetName(date: Date = new Date()): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  /**
   * Ensures a monthly sheet tab exists, creates it if not
   * @param sheetName The name of the sheet to ensure exists
   */
  async ensureMonthlySheetExists(sheetName: string): Promise<void> {
    try {
      // First, try to get the sheet to see if it exists
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheetExists = spreadsheet.data.sheets?.some(
        (sheet: any) => sheet.properties?.title === sheetName
      );

      if (!sheetExists) {
        // Create the new sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });
        console.log(`Created new sheet tab: ${sheetName}`);

        // Initialize the new sheet with headers and summary
        await this.initializeSheetStructure(sheetName);
        console.log(`Initialized sheet structure: ${sheetName}`);
      }
    } catch (error: any) {
      console.error('Error ensuring monthly sheet exists:', error.message);
      throw error;
    }
  }

  /**
   * Initializes sheet structure with headers in row 5 and summary section
   * @param sheetName The name of the sheet to initialize
   */
  private async initializeSheetStructure(sheetName: string): Promise<void> {
    try {
      // Set summary headers in row 4 (columns F-H, with column E as spacer)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!F4:H4`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Target Expense', 'Total Expenses', 'Remain']],
        },
      });

      // Set summary values in row 5 (columns F-H)
      // F5: Target Expense value, G5: Total Expenses formula, H5: Remain formula
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!F5:H5`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            this.targetExpense,
            '=SUM(C6:C)',
            '=F5-G5'
          ]],
        },
      });

      // Apply number formatting to summary values (Rs currency format)
      try {
        const spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
        });
        const sheet = spreadsheet.data.sheets?.find(
          (s: any) => s.properties?.title === sheetName
        );
        if (sheet) {
          const sheetId = sheet.properties?.sheetId;
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [{
                repeatCell: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: 4, // Row 5
                    endRowIndex: 5,
                    startColumnIndex: 5, // Column F
                    endColumnIndex: 8, // Column H (exclusive)
                  },
                  cell: {
                    userEnteredFormat: {
                      numberFormat: {
                        type: 'CURRENCY',
                        pattern: '"Rs"#,##0.00',
                      },
                    },
                  },
                  fields: 'userEnteredFormat.numberFormat',
                },
              }],
            },
          });
        }
      } catch (error: any) {
        // Don't fail if formatting fails
        console.warn('Could not apply currency formatting:', error.message);
      }

      // Set expense headers in row 5 (columns A-D)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A5:D5`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Date', 'Type', 'Amount', 'Description']],
        },
      });

      // Add type breakdown section (columns E-F, starting at row 14)
      await this.initializeTypeBreakdown(sheetName);

      // Apply formatting
      await this.applySheetFormatting(sheetName);
    } catch (error: any) {
      console.error('Error initializing sheet structure:', error.message);
      throw error;
    }
  }

  /**
   * Initializes the type breakdown section (columns F-G, starting at row 14)
   * @param sheetName The name of the sheet
   */
  private async initializeTypeBreakdown(sheetName: string): Promise<void> {
    try {
      // Filter out 'None' from the types list for the breakdown
      const typesForBreakdown = EXPENSE_TYPES.filter(type => type !== 'None');
      
      // Create the breakdown data: type names in column F, SUMIF formulas in column G
      const breakdownData = typesForBreakdown.map(type => [
        type,
        `=SUMIF(B6:B, "${type}", C6:C)`
      ]);

      // Write the breakdown starting at row 14 (F14:G14, F15:G15, etc.)
      const startRow = 14;
      const endRow = startRow + breakdownData.length - 1;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!F${startRow}:G${endRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: breakdownData,
        },
      });

      // Apply currency formatting to column G (amounts)
      try {
        const spreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
        });
        const sheet = spreadsheet.data.sheets?.find(
          (s: any) => s.properties?.title === sheetName
        );
        if (sheet) {
          const sheetId = sheet.properties?.sheetId;
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [{
                repeatCell: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: startRow - 1, // Row 14 (0-indexed, inclusive)
                    endRowIndex: endRow + 1, // Row endRow+1 (0-indexed, exclusive) to include all rows
                    startColumnIndex: 6, // Column G (0-indexed) - amounts only
                    endColumnIndex: 7, // Column H (exclusive)
                  },
                  cell: {
                    userEnteredFormat: {
                      numberFormat: {
                        type: 'CURRENCY',
                        pattern: '"Rs"#,##0.00',
                      },
                    },
                  },
                  fields: 'userEnteredFormat.numberFormat',
                },
              }],
            },
          });
        }
      } catch (error: any) {
        // Don't fail if formatting fails
        console.warn('Could not apply currency formatting to type breakdown:', error.message);
      }
    } catch (error: any) {
      console.error('Error initializing type breakdown:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Applies formatting to the sheet (colors for headers and summary)
   * @param sheetName The name of the sheet to format
   */
  private async applySheetFormatting(sheetName: string): Promise<void> {
    try {
      // Get the sheet ID
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheet = spreadsheet.data.sheets?.find(
        (s: any) => s.properties?.title === sheetName
      );

      if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
      }

      const sheetId = sheet.properties?.sheetId;

      const requests = [
        // Format row 4 summary headers F4 and G4 - red/salmon background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 3, // Row 4 (0-indexed)
              endRowIndex: 4,
              startColumnIndex: 5, // Column F (0-indexed)
              endColumnIndex: 7, // Column G (exclusive)
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.9,
                  green: 0.6,
                  blue: 0.6,
                },
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        // Format row 4 summary header H4 - green background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 3, // Row 4 (0-indexed)
              endRowIndex: 4,
              startColumnIndex: 7, // Column H (0-indexed)
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.6,
                  green: 0.8,
                  blue: 0.6,
                },
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        // Format row 5 expense headers (A5, B5, C5, D5) - light red/salmon background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 4, // Row 5 (0-indexed)
              endRowIndex: 5,
              startColumnIndex: 0, // Column A (0-indexed)
              endColumnIndex: 4, // Column D (exclusive) - includes Date, Type, Amount, Description
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.96,
                  green: 0.8,
                  blue: 0.8,
                },
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        // Format row 5 summary values F5 and G5 - light red/salmon background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 4, // Row 5 (0-indexed)
              endRowIndex: 5,
              startColumnIndex: 5, // Column F (0-indexed)
              endColumnIndex: 7, // Column G (exclusive)
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.96,
                  green: 0.8,
                  blue: 0.8,
                },
                textFormat: {
                  bold: true,
                },
                numberFormat: {
                  type: 'CURRENCY',
                  pattern: '"Rs"#,##0.00',
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat)',
          },
        },
        // Format row 5 summary value H5 - light green background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 4, // Row 5 (0-indexed)
              endRowIndex: 5,
              startColumnIndex: 7, // Column H (0-indexed)
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.85,
                  green: 0.95,
                  blue: 0.85,
                },
                textFormat: {
                  bold: true,
                },
                numberFormat: {
                  type: 'CURRENCY',
                  pattern: '"Rs"#,##0.00',
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat)',
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });
    } catch (error: any) {
      console.error('Error applying formatting:', error.message);
      // Don't throw - formatting is not critical
    }
  }

  /**
   * Gets all sheet tab names in the spreadsheet
   * @returns Array of sheet names
   */
  async getAllSheetNames(): Promise<string[]> {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return spreadsheet.data.sheets?.map(
        (sheet: any) => sheet.properties?.title
      ).filter(Boolean) || [];
    } catch (error: any) {
      console.error('Error getting sheet names:', error.message);
      throw error;
    }
  }

  /**
   * Initializes the sheet with headers if they don't exist
   */
  async initializeSheet(): Promise<void> {
    try {
      // Check if sheet exists and has headers in row 5
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A5:D5`,
      });

      // If no data or headers don't match, initialize structure
      if (!response.data.values || response.data.values.length === 0) {
        await this.initializeSheetStructure(this.sheetName);
        console.log('Sheet initialized with headers and summary');
      } else {
        // Check if summary section exists
        const summaryResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!F4:H5`,
        });

        if (!summaryResponse.data.values || summaryResponse.data.values.length === 0) {
          // Add summary section if missing
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!F4:H4`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [['Target Expense', 'Total Expenses', 'Remain']],
            },
          });

          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!F5:H5`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                this.targetExpense,
                '=SUM(C6:C)',
                '=F5-G5'
              ]],
            },
          });

          await this.applySheetFormatting(this.sheetName);
          console.log('Added summary section to existing sheet');
        }

        // Check if type breakdown section exists
        const breakdownResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!F14:G14`,
        });

        if (!breakdownResponse.data.values || breakdownResponse.data.values.length === 0) {
          // Add type breakdown section if missing
          await this.initializeTypeBreakdown(this.sheetName);
          console.log('Added type breakdown section to existing sheet');
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.error('Spreadsheet not found. Please check the GOOGLE_SHEET_ID in your .env file');
      } else if (error.code === 403) {
        console.error('Permission denied. Please share the spreadsheet with the service account email');
      } else if (error.message && error.message.includes('Invalid JWT Signature')) {
        console.error('❌ Invalid JWT Signature Error - This usually means:');
        console.error('   1. The service account was deleted or disabled in Google Cloud Console');
        console.error('   2. Google Sheets API is not enabled for your project');
        console.error('   3. The credentials are from a different Google Cloud project');
        console.error('   4. The service account key was regenerated (old key is invalid)');
        console.error('\n   To fix:');
        console.error('   - Go to Google Cloud Console → IAM & Admin → Service Accounts');
        console.error('   - Find your service account and verify it exists and is enabled');
        console.error('   - Go to APIs & Services → Library → Enable "Google Sheets API"');
        console.error('   - If needed, create a new service account key and download it');
        console.error('   - Replace your credentials.json with the new key file');
      } else {
        console.error('Error initializing sheet:', error.message);
      }
      throw error;
    }
  }

  /**
   * Appends an expense to the Google Sheet (monthly tab)
   * @param expense The expense to log
   * @returns Promise that resolves when the expense is logged
   */
  async logExpense(expense: Expense): Promise<void> {
    try {
      // Get the current month's sheet name
      const monthlySheetName = this.getMonthlySheetName();
      
      // Ensure the monthly sheet exists
      await this.ensureMonthlySheetExists(monthlySheetName);

      const row = [
        expense.date,
        expense.type || '',
        expense.amount,
        expense.description
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${monthlySheetName}!A:D`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      // Update summary section formulas (they should auto-update, but ensure they exist)
      await this.updateSummarySection(monthlySheetName);

      console.log(`Expense logged to ${monthlySheetName}: ${expense.date} - $${expense.amount} - ${expense.description}`);
    } catch (error: any) {
      console.error('Error logging expense to sheet:', error.message);
      throw error;
    }
  }

  /**
   * Updates the summary section with formulas
   * @param sheetName The name of the sheet to update
   */
  async updateSummarySection(sheetName: string): Promise<void> {
    try {
      // Ensure formulas are in place (G5: Total Expenses, H5: Remain)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!G5:H5`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            '=SUM(C6:C)',
            '=F5-G5'
          ]],
        },
      });
    } catch (error: any) {
      console.error('Error updating summary section:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Sets the target expense for a sheet
   * @param sheetName The name of the sheet to update
   * @param targetExpense The target expense amount
   */
  async setTargetExpense(sheetName: string, targetExpense: number): Promise<void> {
    try {
      this.targetExpense = targetExpense;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!F5`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[targetExpense]],
        },
      });

      // Update the remain formula
      await this.updateSummarySection(sheetName);
      
      console.log(`Target expense set to ${targetExpense} for ${sheetName}`);
    } catch (error: any) {
      console.error('Error setting target expense:', error.message);
      throw error;
    }
  }

  /**
   * Gets all expenses from the current month's sheet
   * @returns Array of expenses
   */
  async getAllExpenses(): Promise<Expense[]> {
    try {
      const monthlySheetName = this.getMonthlySheetName();
      
      // Check if the monthly sheet exists first
      const sheetNames = await this.getAllSheetNames();
      if (!sheetNames.includes(monthlySheetName)) {
        return []; // No expenses for this month yet
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${monthlySheetName}!A6:D`, // Skip header row (row 5)
      });

      const rows = response.data.values || [];
      return rows.map(row => ({
        date: row[0] || '',
        type: row[1] || undefined,
        amount: parseFloat(row[2]) || 0,
        description: row[3] || ''
      }));
    } catch (error: any) {
      console.error('Error fetching expenses:', error.message);
      throw error;
    }
  }

  /**
   * Gets expenses from a specific sheet
   * @param sheetName The name of the sheet to get expenses from
   * @returns Array of expenses
   */
  async getExpensesFromSheet(sheetName: string): Promise<Expense[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A6:D`, // Skip header row (row 5)
      });

      const rows = response.data.values || [];
      return rows.map(row => ({
        date: row[0] || '',
        type: row[1] || undefined,
        amount: parseFloat(row[2]) || 0,
        description: row[3] || ''
      }));
    } catch (error: any) {
      console.error(`Error fetching expenses from ${sheetName}:`, error.message);
      return [];
    }
  }

  /**
   * Gets all expenses from all monthly sheets
   * @returns Array of expenses from all months
   */
  async getAllMonthlyExpenses(): Promise<Expense[]> {
    try {
      const sheetNames = await this.getAllSheetNames();
      const allExpenses: Expense[] = [];

      // Filter to only monthly sheets (format: "Mon YYYY")
      const monthlySheetPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
      const monthlySheets = sheetNames.filter(name => monthlySheetPattern.test(name));

      for (const sheetName of monthlySheets) {
        const expenses = await this.getExpensesFromSheet(sheetName);
        allExpenses.push(...expenses);
      }

      return allExpenses;
    } catch (error: any) {
      console.error('Error fetching all monthly expenses:', error.message);
      throw error;
    }
  }

  /**
   * Gets the total of current month's expenses
   * @returns Total amount for current month
   */
  async getTotalExpenses(): Promise<number> {
    const expenses = await this.getAllExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  /**
   * Gets the total of all expenses across all months
   * @returns Total amount across all months
   */
  async getTotalAllExpenses(): Promise<number> {
    const expenses = await this.getAllMonthlyExpenses();
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  /**
   * Gets the current month's sheet name
   * @returns Current month sheet name (e.g., "Feb 2026")
   */
  getCurrentMonthName(): string {
    return this.getMonthlySheetName();
  }

  /**
   * Detects the format of a sheet (old format with headers in row 1, or new format with headers in row 5)
   * @param sheetName The name of the sheet to check
   * @returns 'old' if headers are in row 1, 'new' if headers are in row 5, 'unknown' if neither
   */
  async detectSheetFormat(sheetName: string): Promise<'old' | 'new' | 'unknown'> {
    try {
      // Check for new format (headers in row 5)
      const newFormatResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A5:D5`,
      });

      if (newFormatResponse.data.values && newFormatResponse.data.values.length > 0) {
        const headers = newFormatResponse.data.values[0];
        if (headers && headers.length >= 3) {
          const headerStr = headers.join(' ').toLowerCase();
          if (headerStr.includes('date') && headerStr.includes('type') && headerStr.includes('amount') && headerStr.includes('description')) {
            return 'new';
          }
        }
      }

      // Check for old format (headers in row 1)
      const oldFormatResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:C1`,
      });

      if (oldFormatResponse.data.values && oldFormatResponse.data.values.length > 0) {
        const headers = oldFormatResponse.data.values[0];
        if (headers && headers.length >= 3) {
          const headerStr = headers.join(' ').toLowerCase();
          if (headerStr.includes('date') && headerStr.includes('amount') && headerStr.includes('description')) {
            return 'old';
          }
        }
      }

      return 'unknown';
    } catch (error: any) {
      // If sheet doesn't exist or error reading, return unknown
      return 'unknown';
    }
  }

  /**
   * Migrates existing data from old format to new format
   * @param sheetName The name of the sheet to migrate
   * @returns Array of migrated expense data in new format
   */
  async migrateExistingData(sheetName: string): Promise<Array<[string, string, number, string]>> {
    try {
      // Read all data from row 2 onwards (skip header row 1)
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:C`,
      });

      const rows = response.data.values || [];
      const migratedData: Array<[string, string, number, string]> = [];

      for (const row of rows) {
        // Skip empty rows
        if (!row || row.length === 0) continue;

        const date = row[0] || '';
        const amount = parseFloat(row[1]) || 0;
        const description = row[2] || '';

        // Skip if essential data is missing
        if (!date || amount === 0 || !description) continue;

        // Transform to new format: [Date, Type (empty), Amount, Description]
        migratedData.push([date, '', amount, description]);
      }

      return migratedData;
    } catch (error: any) {
      console.error('Error migrating existing data:', error.message);
      return [];
    }
  }

  /**
   * Resets a sheet to initial state - clears all data and sets up new structure
   * @param sheetName The name of the sheet to reset
   * @param targetExpense Optional target expense value (defaults to 150000)
   * @returns Object with reset result information
   */
  async resetSheetToInitialState(sheetName: string, targetExpense: number = 150000): Promise<{ success: boolean; message: string }> {
    try {
      // Temporarily store the original target expense
      const originalTargetExpense = this.targetExpense;
      
      // Set the target expense for this reset
      this.targetExpense = targetExpense;
      
      // Check if sheet exists, create if not
      const sheetNames = await this.getAllSheetNames();
      if (!sheetNames.includes(sheetName)) {
        await this.ensureMonthlySheetExists(sheetName);
        // Restore original target expense
        this.targetExpense = originalTargetExpense;
        return {
          success: true,
          message: `Sheet "${sheetName}" created and initialized with target expense Rs${targetExpense.toLocaleString()}.`
        };
      }

      // Clear ALL data from the sheet (all rows and columns)
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`, // Clear a wide range to ensure all data is removed
      });

      // Set up new structure from scratch with the specified target expense
      await this.initializeSheetStructure(sheetName);
      
      // Restore original target expense
      this.targetExpense = originalTargetExpense;

      return {
        success: true,
        message: `Sheet "${sheetName}" has been reset to initial state. Target expense set to Rs${targetExpense.toLocaleString()}. All data cleared.`
      };
    } catch (error: any) {
      console.error('Error resetting sheet:', error.message);
      return {
        success: false,
        message: `Failed to reset sheet: ${error.message}`
      };
    }
  }

  /**
   * Migrates a sheet from old format to new format
   * @param sheetName The name of the sheet to migrate
   * @param hasExistingData Whether the sheet has existing data that needs to be migrated
   * @returns Object with migration result information
   * @deprecated Use resetSheetToInitialState instead
   */
  async migrateSheetToNewFormat(sheetName: string, hasExistingData: boolean = false): Promise<{ success: boolean; message: string; dataMigrated: number }> {
    try {
      // Check if sheet exists
      const sheetNames = await this.getAllSheetNames();
      if (!sheetNames.includes(sheetName)) {
        // Sheet doesn't exist, initialize as new
        await this.ensureMonthlySheetExists(sheetName);
        return {
          success: true,
          message: `Sheet "${sheetName}" created and initialized with new format.`,
          dataMigrated: 0
        };
      }

      // Detect current format
      const format = await this.detectSheetFormat(sheetName);

      if (format === 'new') {
        return {
          success: true,
          message: `Sheet "${sheetName}" is already in the new format.`,
          dataMigrated: 0
        };
      }

      if (format === 'unknown') {
        // Empty or unknown format, initialize as new
        await this.initializeSheetStructure(sheetName);
        return {
          success: true,
          message: `Sheet "${sheetName}" initialized with new format.`,
          dataMigrated: 0
        };
      }

      // Old format detected - migrate
      let migratedData: Array<[string, string, number, string]> = [];
      let dataCount = 0;

      if (hasExistingData) {
        // Read and transform existing data
        migratedData = await this.migrateExistingData(sheetName);
        dataCount = migratedData.length;
      }

      // Clear rows 1-5 to make room for new structure (including column H)
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:H5`,
      });

      // Set up new structure
      await this.initializeSheetStructure(sheetName);

      // Write migrated data to row 6+
      if (migratedData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A6:D${5 + migratedData.length}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: migratedData,
          },
        });

        // Update summary formulas after data is written
        await this.updateSummarySection(sheetName);
      }

      return {
        success: true,
        message: `Sheet "${sheetName}" migrated to new format${dataCount > 0 ? ` with ${dataCount} expense(s) preserved` : ''}.`,
        dataMigrated: dataCount
      };
    } catch (error: any) {
      console.error('Error migrating sheet:', error.message);
      return {
        success: false,
        message: `Failed to migrate sheet: ${error.message}`,
        dataMigrated: 0
      };
    }
  }
}
