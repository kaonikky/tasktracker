import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "lawyer"] }).notNull().default("lawyer"),
});

export type ContractHistoryEntry = {
  userId: number;
  username: string;
  action: string;
  changes: Record<string, { old: any; new: any; }>;
  timestamp: string;
};

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
  lawyerId: text("lawyer_id"), // Changed from integer to text and removed reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
  history: json("history").$type<ContractHistoryEntry[]>().notNull().default([]),
  hasND: boolean("has_nd").notNull().default(false),
});

export type Contract = typeof contracts.$inferSelect & {
  daysLeft: number;
};

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

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