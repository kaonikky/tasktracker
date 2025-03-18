import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "lawyer"] }).notNull().default("lawyer"),
});

// Исправляем тип для истории контракта
export type ContractHistoryEntry = {
  userId: number;
  username: string;
  action: string;
  changes: Record<string, { old: any; new: any; }>;
  timestamp: string;
};

// В определении таблицы contracts
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  inn: text("inn").notNull(),
  director: text("director").notNull(),
  address: text("address").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status", { 
    enum: ["active", "expiring_soon", "expired"] 
  }).notNull(),
  comments: text("comments"),
  lawyerId: integer("lawyer_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  history: json("history").$type<ContractHistoryEntry[]>().notNull().default([]),
  hasND: boolean("has_nd").notNull().default(false),
});

// Добавляем daysLeft в тип Contract
export type Contract = typeof contracts.$inferSelect & {
  daysLeft: number;
};

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

// Модифицируем схему для вставки контракта, преобразуя строку даты в Date
export const insertContractSchema = createInsertSchema(contracts)
  .pick({
    companyName: true,
    inn: true,
    director: true,
    address: true,
    endDate: true,
    comments: true,
    lawyerId: true,
    hasND: true,
  })
  .extend({
    endDate: z.string().transform((str) => new Date(str)),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;