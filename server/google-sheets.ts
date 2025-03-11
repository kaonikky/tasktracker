import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';
import { User, Contract } from "@shared/schema";
import { differenceInDays, parse, isValid, format } from 'date-fns';

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
    this.spreadsheetId = process.env.VITE_GOOGLE_SHEETS_ID!;
  }

  private async initializeSheets() {
    const sheetsInfo = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const sheets = sheetsInfo.data.sheets;
    const requiredSheets = ['users', 'contracts'];

    for (const sheetName of requiredSheets) {
      if (!sheets.find((s: any) => s.properties.title === sheetName)) {
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

        const headers = sheetName === 'users'
          ? ['username', 'password', 'role']
          : ['companyName', 'inn', 'director', 'address', 'endDate', 'comments', 'hasND', 'lawyerId', 'status', 'history'];

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });
      }
    }
  }

  async initialize() {
    await this.initializeSheets();
  }

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

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'users!A2:D2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[user.username, user.password, user.role]]
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

  async getAllContracts(): Promise<Contract[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'contracts!A2:J'
    });

    const values = response.data.values || [];
    const today = new Date();
    console.log('Current date:', {
      raw: today,
      formatted: format(today, 'dd.MM.yyyy')
    });

    return values.map((row: any[], index: number) => {
      const dateStr = row[4] || '';
      console.log(`\nProcessing contract ${index + 1}:`, { dateString: dateStr });

      const endDate = parse(dateStr, 'dd.MM.yyyy', new Date());

      if (!isValid(endDate)) {
        console.error('Invalid date:', dateStr);
        return null;
      }

      endDate.setHours(23, 59, 59, 999);

      console.log('Parsed date:', {
        raw: endDate,
        formatted: format(endDate, 'dd.MM.yyyy HH:mm:ss'),
        timestamp: endDate.getTime()
      });

      // Изменяем порядок аргументов - сначала текущая дата, потом конечная
      // Это даст положительное значение для будущих дат
      const daysLeft = -differenceInDays(today, endDate);

      console.log('Days calculation:', {
        endDate: format(endDate, 'dd.MM.yyyy HH:mm:ss'),
        today: format(today, 'dd.MM.yyyy HH:mm:ss'),
        daysLeft: daysLeft
      });

      const contract: Contract = {
        id: index + 1,
        companyName: row[0],
        inn: row[1],
        director: row[2],
        address: row[3],
        endDate: endDate,
        comments: row[5] || null,
        hasND: row[6] === 'true',
        lawyerId: parseInt(row[7]) || 0,
        status: row[8] as "active" | "expiring_soon" | "expired",
        history: JSON.parse(row[9] || '[]'),
        createdAt: new Date(),
        daysLeft: daysLeft
      };

      console.log('Created contract:', {
        id: contract.id,
        endDate: format(contract.endDate, 'dd.MM.yyyy'),
        daysLeft: contract.daysLeft
      });

      return contract;
    }).filter(Boolean) as Contract[];
  }

  async createContract(contract: Omit<Contract, 'id'>): Promise<Contract> {
    const contracts = await this.getAllContracts();
    const newId = contracts.length + 1;

    // Check for existing INN before creating
    const existingContract = contracts.find(c => c.inn === contract.inn);
    if (existingContract) {
      throw new Error("Контракт с таким ИНН уже существует");
    }

    // Форматируем дату в строку DD.MM.YYYY
    const endDate = new Date(contract.endDate);
    const endDateStr = `${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

    console.log('Creating contract with date:', {
      originalDate: contract.endDate,
      formattedDate: endDateStr
    });

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
          endDateStr,
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

    // Форматируем дату в строку DD.MM.YYYY
    const endDate = new Date(updatedContract.endDate);
    const endDateStr = `${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${endDate.getFullYear()}`;

    console.log('Updating contract with date:', {
      originalDate: updatedContract.endDate,
      formattedDate: endDateStr
    });

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
          endDateStr,
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

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    const users = await this.getAllUsers();
    const userIndex = users.findIndex(user => user.id === id);

    if (userIndex === -1) throw new Error("User not found");

    const rowIndex = userIndex + 2; // Add 2 because row 1 is headers and sheets are 1-indexed

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `users!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[hashedPassword]]
      }
    });
  }
}