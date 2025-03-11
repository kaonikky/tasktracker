import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

async function getGoogleSheetsClient() {
  const serviceAccountStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountStr) {
    throw new Error("Ключ сервисного аккаунта не настроен");
  }

  try {
    // Заменяем возможные экранированные кавычки и переносы строк
    const cleanedStr = serviceAccountStr
      .replace(/\\"/g, '"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    console.log('Attempting to parse service account key...');
    const serviceAccount = JSON.parse(cleanedStr);

    console.log('Service account email:', serviceAccount.client_email);
    const auth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error details:', error);
    if (error instanceof SyntaxError) {
      console.error('JSON parsing error. Key format is invalid.');
      throw new Error("Неверный формат ключа сервисного аккаунта. Убедитесь, что это корректный JSON.");
    }
    throw new Error("Ошибка при создании клиента Google Sheets: " + (error instanceof Error ? error.message : 'неизвестная ошибка'));
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
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
      const contract = await storage.createContract(data, req.user.id);
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
        req.user.id
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

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A1:Z1000',
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return res.status(400).json({ message: "Таблица пуста или содержит только заголовки" });
      }

      // Проверяем заголовки
      const expectedHeaders = ['Название компании', 'ИНН', 'Директор', 'Адрес', 'Дата окончания', 'Комментарии', 'НД'];
      const headers = rows[0];

      if (!headers || headers.length < expectedHeaders.length) {
        return res.status(400).json({
          message: `Неверная структура таблицы. Ожидаемые столбцы: ${expectedHeaders.join(', ')}`
        });
      }

      const contracts = rows.slice(1)
        .filter(row => row[0] || row[1]) // Пропускаем пустые строки
        .map(row => ({
          companyName: row[0] || "",
          inn: row[1] || "",
          director: row[2] || "",
          address: row[3] || "",
          endDate: new Date(row[4]),
          comments: row[5] || "",
          hasND: row[6]?.toLowerCase() === "true",
          lawyerId: req.user.id
        }));

      if (contracts.length === 0) {
        return res.status(400).json({ message: "Не найдено данных для импорта" });
      }

      const importedContracts = await Promise.all(
        contracts.map(contract => storage.createContract(contract, req.user.id))
      );

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