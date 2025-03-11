import { useMutation, useQuery } from "@tanstack/react-query";
import { Contract, InsertContract } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    staleTime: 5 * 60 * 1000, // Кэш на 5 минут
  });
}

export function useContract(id: number) {
  return useQuery<Contract>({
    queryKey: ["/api/contracts", id],
    staleTime: 5 * 60 * 1000, // Кэш на 5 минут
  });
}

export function useCreateContract() {
  return useMutation({
    mutationFn: async (contract: InsertContract) => {
      const res = await apiRequest("POST", "/api/contracts", contract);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    },
  });
}

export function useUpdateContract() {
  return useMutation({
    mutationFn: async ({
      id,
      contract,
    }: {
      id: number;
      contract: Partial<InsertContract>;
    }) => {
      const res = await apiRequest("PUT", `/api/contracts/${id}`, contract);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    },
  });
}