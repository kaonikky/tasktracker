import { User, InsertUser, Contract, InsertContract, ContractHistoryEntry } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { addDays, parseISO, isAfter, differenceInDays } from "date-fns";
import { GoogleSheetsStorage } from "./google-sheets";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;

  getContracts(): Promise<Contract[]>;
  getContract(id: number): Promise<Contract | undefined>;
  createContract(contract: InsertContract, userId: number): Promise<Contract>;
  updateContract(id: number, contract: Partial<InsertContract>, userId: number): Promise<Contract>;
  deleteContract(id: number): Promise<void>;

  sessionStore: session.Store;
  initialize(): Promise<void>;
}

export class GoogleSheetsStorageAdapter implements IStorage {
  private googleSheets: GoogleSheetsStorage;
  sessionStore: session.Store;

  constructor(credentials: any) {
    this.googleSheets = new GoogleSheetsStorage(credentials);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async initialize(): Promise<void> {
    await this.googleSheets.initialize();
  }

  private calculateContractStatus(endDate: Date): { status: "active" | "expiring_soon" | "expired"; daysLeft: number } {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const daysLeft = differenceInDays(new Date(endDate), today);

    if (isAfter(today, endDate)) {
      return { status: "expired", daysLeft };
    } else if (isAfter(thirtyDaysFromNow, endDate)) {
      return { status: "expiring_soon", daysLeft };
    }
    return { status: "active", daysLeft };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.googleSheets.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.googleSheets.getUserByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.googleSheets.createUser(insertUser);
  }

  async getContracts(): Promise<Contract[]> {
    const contracts = await this.googleSheets.getAllContracts();
    return contracts.map(contract => {
      const { status, daysLeft } = this.calculateContractStatus(parseISO(contract.endDate.toString()));
      return {
        ...contract,
        status,
        daysLeft
      };
    });
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const contracts = await this.getContracts();
    return contracts.find(c => c.id === id);
  }

  async createContract(insertContract: InsertContract, userId: number): Promise<Contract> {
    const now = new Date();
    const contract: Contract = {
      ...insertContract,
      id: 0, // ID будет назначен в GoogleSheetsStorage
      status: this.calculateContractStatus(parseISO(insertContract.endDate.toString())).status,
      createdAt: now,
      history: [{
        userId,
        username: (await this.getUser(userId))?.username || "Unknown",
        action: "created",
        changes: {},
        timestamp: now.toISOString()
      }]
    };

    return this.googleSheets.createContract(contract);
  }

  async updateContract(
    id: number,
    updates: Partial<InsertContract>,
    userId: number
  ): Promise<Contract> {
    const existing = await this.getContract(id);
    if (!existing) {
      throw new Error("Contract not found");
    }

    const changes: Record<string, { old: any; new: any }> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (existing[key as keyof Contract] !== value) {
        changes[key] = {
          old: existing[key as keyof Contract],
          new: value
        };
      }
    });

    const historyEntry: ContractHistoryEntry = {
      userId,
      username: (await this.getUser(userId))?.username || "Unknown",
      action: "updated",
      changes,
      timestamp: new Date().toISOString()
    };

    const updated: Contract = {
      ...existing,
      ...updates,
      history: [...existing.history, historyEntry]
    };

    return this.googleSheets.updateContract(id, updated);
  }

  async deleteContract(id: number): Promise<void> {
    await this.googleSheets.deleteContract(id);
  }
  async getAllUsers(): Promise<User[]> {
    return this.googleSheets.getAllUsers();
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await this.googleSheets.updateUserPassword(id, hashedPassword);
  }
}

// Заменяем объект credentials на данные из переменной окружения
const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS!);

export const storage = new GoogleSheetsStorageAdapter(credentials);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contracts: Map<number, Contract>;
  private currentUserId: number;
  private currentContractId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.contracts = new Map();
    this.currentUserId = 1;
    this.currentContractId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  private calculateContractStatus(endDate: Date): { status: "active" | "expiring_soon" | "expired"; daysLeft: number } {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const daysLeft = differenceInDays(new Date(endDate), today);

    if (isAfter(today, endDate)) {
      return { status: "expired", daysLeft };
    } else if (isAfter(thirtyDaysFromNow, endDate)) {
      return { status: "expiring_soon", daysLeft };
    }
    return { status: "active", daysLeft };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getContracts(): Promise<Contract[]> {
    const contracts = Array.from(this.contracts.values());
    return contracts.map(contract => {
      const { status, daysLeft } = this.calculateContractStatus(parseISO(contract.endDate.toString()));
      return {
        ...contract,
        status,
        daysLeft
      };
    });
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;

    const { status, daysLeft } = this.calculateContractStatus(parseISO(contract.endDate.toString()));
    return {
      ...contract,
      status,
      daysLeft
    };
  }

  async createContract(insertContract: InsertContract, userId: number): Promise<Contract> {
    const id = this.currentContractId++;
    const now = new Date();

    const contract: Contract = {
      ...insertContract,
      id,
      status: this.calculateContractStatus(parseISO(insertContract.endDate.toString())).status,
      createdAt: now,
      history: [{
        userId,
        username: (await this.getUser(userId))?.username || "Unknown",
        action: "created",
        changes: {},
        timestamp: now.toISOString()
      }]
    };

    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(
    id: number,
    updates: Partial<InsertContract>,
    userId: number
  ): Promise<Contract> {
    const existing = await this.getContract(id);
    if (!existing) {
      throw new Error("Contract not found");
    }

    const changes: Record<string, { old: any; new: any }> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (existing[key as keyof Contract] !== value) {
        changes[key] = {
          old: existing[key as keyof Contract],
          new: value
        };
      }
    });

    const historyEntry: ContractHistoryEntry = {
      userId,
      username: (await this.getUser(userId))?.username || "Unknown",
      action: "updated",
      changes,
      timestamp: new Date().toISOString()
    };

    const updated: Contract = {
      ...existing,
      ...updates,
      history: [...existing.history, historyEntry]
    };

    this.contracts.set(id, updated);
    return updated;
  }

  async deleteContract(id: number): Promise<void> {
    this.contracts.delete(id);
  }
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");

    this.users.set(id, {
      ...user,
      password: hashedPassword
    });
  }
  async initialize(): Promise<void> {
    return;
  }
}