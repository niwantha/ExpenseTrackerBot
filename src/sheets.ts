import { google } from 'googleapis';
import { Expense } from './types';
import * as fs from 'fs';

/**
 * Google Sheets service for managing expense logging
 */
export class SheetsService {
  private sheets;
  private auth;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(credentialsPath: string, spreadsheetId: string, sheetName: string = 'Expenses') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    // Create JWT auth client
    this.auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
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

        // Add headers to the new sheet
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:C1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Date', 'Amount', 'Description']],
          },
        });
        console.log(`Added headers to sheet: ${sheetName}`);
      }
    } catch (error: any) {
      console.error('Error ensuring monthly sheet exists:', error.message);
      throw error;
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
      // Check if sheet exists and has headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:C1`,
      });

      // If no data or headers don't match, set headers
      if (!response.data.values || response.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:C1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Date', 'Amount', 'Description']],
          },
        });
        console.log('Sheet initialized with headers');
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.error('Spreadsheet not found. Please check the GOOGLE_SHEET_ID in your .env file');
      } else if (error.code === 403) {
        console.error('Permission denied. Please share the spreadsheet with the service account email');
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
        expense.amount,
        expense.description
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${monthlySheetName}!A:C`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      console.log(`Expense logged to ${monthlySheetName}: ${expense.date} - $${expense.amount} - ${expense.description}`);
    } catch (error: any) {
      console.error('Error logging expense to sheet:', error.message);
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
        range: `${monthlySheetName}!A2:C`, // Skip header row
      });

      const rows = response.data.values || [];
      return rows.map(row => ({
        date: row[0],
        amount: parseFloat(row[1]) || 0,
        description: row[2]
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
        range: `${sheetName}!A2:C`, // Skip header row
      });

      const rows = response.data.values || [];
      return rows.map(row => ({
        date: row[0],
        amount: parseFloat(row[1]) || 0,
        description: row[2]
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
}
