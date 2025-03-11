import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { parse, isValid } from 'date-fns';

async function getGoogleSheetsClient() {
  const serviceAccountStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountStr) {
    throw new Error("Ключ сервисного аккаунта не настроен");
  }

  try {
    let serviceAccountData: string = serviceAccountStr;

    // Проверяем длину ключа и его формат
    console.log('Service account key length:', serviceAccountData.length);
    console.log('Key starts with:', serviceAccountData.substring(0, 10));
    console.log('Key ends with:', serviceAccountData.substring(serviceAccountData.length - 10));

    // Если строка обёрнута в дополнительные кавычки, убираем их
    if (serviceAccountData.startsWith('"') && serviceAccountData.endsWith('"')) {
      console.log('Removing outer quotes');
      serviceAccountData = serviceAccountData.slice(1, -1);
    }

    // Заменяем экранированные кавычки и переносы строк
    serviceAccountData = serviceAccountData
      .replace(/\\\\n/g, '\\n')  // Исправляем двойное экранирование \n
      .replace(/\\"/g, '"')      // Заменяем \" на "
      .replace(/\r\n/g, '\n')    // Нормализуем переносы строк
      .replace(/\r/g, '\n');     // Нормализуем переносы строк

    console.log('Attempting to parse service account key...');
    const serviceAccount = JSON.parse(serviceAccountData);

    // Проверяем обязательные поля
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);

    if (missingFields.length > 0) {
      throw new Error(`В ключе сервисного аккаунта отсутствуют обязательные поля: ${missingFields.join(', ')}`);
    }

    if (serviceAccount.type !== 'service_account') {
      throw new Error('Неверный тип аккаунта. Требуется service_account');
    }

    console.log('Service account email:', serviceAccount.client_email);
    console.log('Private key format OK:', Boolean(serviceAccount.private_key.includes('BEGIN PRIVATE KEY')));

    // Правильно обрабатываем private_key
    const privateKey = serviceAccount.private_key
      .replace(/\\n/g, '\n')
      .replace(/\\"/, '"');

    const auth = new JWT({
      email: serviceAccount.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // Проверяем авторизацию
    try {
      await auth.authorize();
      console.log('Successfully authorized with service account');
    } catch (authError) {
      console.error('Authorization error:', authError);
      throw new Error("Ошибка авторизации с сервисным аккаунтом. Проверьте корректность ключа и настройки проекта.");
    }

    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;

  } catch (error) {
    console.error('Google Sheets client error:', error);

    if (error instanceof SyntaxError) {
      console.error('JSON parsing error. Key format is invalid.');
      throw new Error("Неверный формат JSON в ключе сервисного аккаунта. Пожалуйста, проверьте формат ключа.");
    }

    throw error instanceof Error ? error : new Error("Неизвестная ошибка при создании клиента Google Sheets");
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user!.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

function parseDate(dateStr: string): Date {
  // Пробуем разные форматы даты
  const formats = ['dd.MM.yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];

  for (const format of formats) {
    const parsed = parse(dateStr.trim(), format, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Неверный формат даты: ${dateStr}. Поддерживаемые форматы: ДД.ММ.ГГГГ, ГГГГ-ММ-ДД, ММ/ДД/ГГГГ`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Get all contracts
  app.get("/api/contracts", requireAuth, async (_req, res) => {
    const contracts = await storage.getContracts();
    res.json(contracts);
  });

  // Get single contract
  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }
    res.json(contract);
  });

  // Create contract
  app.post("/api/contracts", requireAuth, async (req, res) => {
    try {
      const data = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(data, req.user!.id);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      throw error;
    }
  });

  // Update contract
  app.put("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContract(Number(req.params.id));
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const data = insertContractSchema.partial().parse(req.body);
      const updated = await storage.updateContract(
        Number(req.params.id),
        data,
        req.user!.id
      );
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      throw error;
    }
  });

  // Delete contract (admin only)
  app.delete("/api/contracts/:id", requireAdmin, async (req, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    await storage.deleteContract(Number(req.params.id));
    res.status(204).end();
  });

  // Import from Google Sheets
  app.get("/api/sheets/import", requireAuth, async (req, res) => {
    try {
      const sheets = await getGoogleSheetsClient();
      const spreadsheetId = process.env.VITE_GOOGLE_SHEETS_ID;

      if (!spreadsheetId) {
        return res.status(400).json({ message: "ID таблицы не настроен" });
      }

      console.log('Attempting to fetch spreadsheet data...');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A1:Z1000',
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return res.status(400).json({ message: "Таблица пуста или содержит только заголовки" });
      }

      console.log('Received rows:', rows.length);

      // Проверяем заголовки
      const expectedHeaders = ['Название компании', 'ИНН', 'Директор', 'Адрес', 'Дата окончания', 'Комментарии', 'НД'];
      const headers = rows[0];

      if (!headers || headers.length < expectedHeaders.length) {
        return res.status(400).json({
          message: `Неверная структура таблицы. Ожидаемые столбцы: ${expectedHeaders.join(', ')}`
        });
      }

      // Фильтруем и преобразуем данные
      const processedRows = new Set(); // Для отслеживания уникальных ИНН
      const validContracts = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        try {
          // Проверяем наличие всех необходимых данных
          if (!row[0]?.trim() || !row[1]?.trim() || !row[2]?.trim() || 
              !row[3]?.trim() || !row[4]?.trim()) {
            console.log(`Пропуск неполной строки ${i + 1}:`, row);
            continue;
          }

          // Проверяем уникальность ИНН
          const inn = row[1].trim();
          if (processedRows.has(inn)) {
            console.log(`Пропуск дубликата ИНН в строке ${i + 1}:`, inn);
            continue;
          }

          // Парсим дату
          let endDate;
          try {
            endDate = parseDate(row[4]);
          } catch (error) {
            console.log(`Ошибка парсинга даты в строке ${i + 1}:`, error);
            continue;
          }

          // Если все проверки пройдены, добавляем контракт
          processedRows.add(inn);
          validContracts.push({
            companyName: row[0].trim(),
            inn: inn,
            director: row[2].trim(),
            address: row[3].trim(),
            endDate: endDate,
            comments: row[5]?.trim() || "",
            hasND: row[6]?.toLowerCase() === "true",
            lawyerId: req.user!.id
          });

        } catch (error) {
          console.error(`Ошибка обработки строки ${i + 1}:`, error);
          continue;
        }
      }

      console.log(`Валидных контрактов для импорта:`, validContracts.length);

      if (validContracts.length === 0) {
        return res.status(400).json({ message: "Не найдено валидных данных для импорта" });
      }

      // Импортируем контракты последовательно
      const importedContracts = [];
      for (const contract of validContracts) {
        try {
          const imported = await storage.createContract(contract, req.user!.id);
          importedContracts.push(imported);
        } catch (error) {
          console.error('Ошибка импорта контракта:', error);
          // Продолжаем импорт остальных контрактов
        }
      }

      console.log('Успешно импортировано контрактов:', importedContracts.length);
      res.json(importedContracts);
    } catch (error) {
      console.error('Google Sheets import error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Ошибка при импорте из Google Sheets"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}