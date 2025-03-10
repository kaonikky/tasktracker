import { User, InsertUser, Contract, InsertContract, ContractHistoryEntry } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { addDays, parseISO, isAfter, differenceInDays } from "date-fns";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getContracts(): Promise<Contract[]>;
  getContract(id: number): Promise<Contract | undefined>;
  createContract(contract: InsertContract, userId: number): Promise<Contract>;
  updateContract(id: number, contract: Partial<InsertContract>, userId: number): Promise<Contract>;
  deleteContract(id: number): Promise<void>;
  
  sessionStore: session.Store;
}

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

  private calculateContractStatus(endDate: Date): "active" | "expiring_soon" | "expired" {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    
    if (isAfter(today, endDate)) {
      return "expired";
    } else if (isAfter(thirtyDaysFromNow, endDate)) {
      return "expiring_soon";
    }
    return "active";
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
    return contracts.map(contract => ({
      ...contract,
      status: this.calculateContractStatus(parseISO(contract.endDate.toString()))
    }));
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;
    
    return {
      ...contract,
      status: this.calculateContractStatus(parseISO(contract.endDate.toString()))
    };
  }

  async createContract(insertContract: InsertContract, userId: number): Promise<Contract> {
    const id = this.currentContractId++;
    const now = new Date();
    
    const contract: Contract = {
      ...insertContract,
      id,
      status: this.calculateContractStatus(parseISO(insertContract.endDate.toString())),
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
}

export const storage = new MemStorage();
