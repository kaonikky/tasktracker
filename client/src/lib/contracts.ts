import { useMutation, useQuery } from "@tanstack/react-query";
import { Contract, InsertContract } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/contracts");
      const data = await response.json();
      console.log("Contracts from API:", data);
      return data;
    }
  });
}

export function useContract(id: number) {
  return useQuery<Contract>({
    queryKey: ["/api/contracts", id],
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

export function useDeleteContract() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    },
  });
}