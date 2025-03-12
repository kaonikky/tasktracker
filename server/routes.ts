import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";

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

  // Check if INN exists
  app.get("/api/contracts/check-inn/:inn", requireAuth, async (req, res) => {
    const { inn } = req.params;
    const contract = await storage.getContractByInn(inn);
    res.json(contract !== undefined);
  });

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

  const httpServer = createServer(app);
  return httpServer;
}