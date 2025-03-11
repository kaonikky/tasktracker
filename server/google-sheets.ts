import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';
import { User, Contract } from "@shared/schema";
import { hashPassword } from './auth';

export class GoogleSheetsStorage {
  private auth: JWT;
  private sheets: any;
  private spreadsheetId: string;

  constructor(credentials: any) {
    this.auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || process.env.VITE_GOOGLE_SHEETS_ID;

    if (!this.spreadsheetId) {
      throw new Error('Neither GOOGLE_SHEETS_ID nor VITE_GOOGLE_SHEETS_ID environment variable is set');
    }
    console.log('Initialized Google Sheets with spreadsheet ID:', this.spreadsheetId);
  }

  private async initializeSheets() {
    try {
      console.log('Initializing Google Sheets...');
      console.log('Using spreadsheet ID:', this.spreadsheetId);

      if (!this.spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_ID environment variable is not set');
      }

      // Проверяем существование листов и создаем их при необходимости
      const sheetsInfo = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      console.log('Successfully connected to Google Sheets');
      const sheets = sheetsInfo.data.sheets;
      const requiredSheets = ['users', 'contracts'];

      for (const sheetName of requiredSheets) {
        if (!sheets.find((s: any) => s.properties.title === sheetName)) {
          console.log(`Creating sheet: ${sheetName}`);
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: { title: sheetName }
                }
              }]
            }
          });

          // Добавляем заголовки для каждого листа
          const headers = sheetName === 'users'
            ? ['id', 'username', 'password', 'role']
            : ['id', 'companyName', 'inn', 'director', 'address', 'endDate', 'comments', 'hasND', 'lawyerId', 'status', 'history'];

          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers]
            }
          });
          console.log(`Created sheet ${sheetName} with headers`);
        }
      }
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      throw error;
    }
  }

  async initialize() {
    await this.initializeSheets();
  }

  // Методы для работы с пользователями
  async getAllUsers(): Promise<User[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'users!A2:D'
    });

    const values = response.data.values || [];
    return values.map((row: any[], index: number) => ({
      id: index + 1,
      username: row[0],
      password: row[1],
      role: row[2] as "admin" | "lawyer"
    }));
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const users = await this.getAllUsers();
    const newId = users.length + 1;

    const hashedPassword = await hashPassword(user.password);

    console.log('Creating new user:', {
      ...user,
      password: 'HASHED_PASSWORD' // Не выводим настоящий пароль в логи
    });

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'users!A2:D2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[user.username, hashedPassword, user.role]]
      }
    });

    return { ...user, id: newId };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await this.getAllUsers();
    return users.find(user => user.username === username);
  }

  async getUser(id: number): Promise<User | undefined> {
    const users = await this.getAllUsers();
    return users[id - 1];
  }

  // Методы для работы с контрактами
  async getAllContracts(): Promise<Contract[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'contracts!A2:J'
    });

    const values = response.data.values || [];
    return values.map((row: any[], index: number) => ({
      id: index + 1,
      companyName: row[0],
      inn: row[1],
      director: row[2],
      address: row[3],
      endDate: new Date(row[4]),
      comments: row[5] || null,
      hasND: row[6] === 'true',
      lawyerId: parseInt(row[7]),
      status: row[8] as "active" | "expiring_soon" | "expired",
      history: JSON.parse(row[9] || '[]'),
      createdAt: new Date()
    }));
  }

  async createContract(contract: Omit<Contract, 'id'>): Promise<Contract> {
    const contracts = await this.getAllContracts();
    const newId = contracts.length + 1;

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'contracts!A2:J2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          contract.companyName,
          contract.inn,
          contract.director,
          contract.address,
          contract.endDate.toISOString(),
          contract.comments || '',
          contract.hasND.toString(),
          contract.lawyerId.toString(),
          contract.status,
          JSON.stringify(contract.history)
        ]]
      }
    });

    return { ...contract, id: newId };
  }

  async updateContract(id: number, updates: Partial<Contract>): Promise<Contract> {
    const contracts = await this.getAllContracts();
    const contract = contracts[id - 1];
    if (!contract) throw new Error("Contract not found");

    const updatedContract = { ...contract, ...updates };
    const rowIndex = id + 1;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `contracts!A${rowIndex}:J${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          updatedContract.companyName,
          updatedContract.inn,
          updatedContract.director,
          updatedContract.address,
          updatedContract.endDate.toISOString(),
          updatedContract.comments || '',
          updatedContract.hasND.toString(),
          updatedContract.lawyerId.toString(),
          updatedContract.status,
          JSON.stringify(updatedContract.history)
        ]]
      }
    });

    return updatedContract;
  }

  async deleteContract(id: number): Promise<void> {
    const rowIndex = id + 1;
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `contracts!A${rowIndex}:J${rowIndex}`
    });
  }
}