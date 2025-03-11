import { useMutation, useQuery } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response.json();
    },
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (user: InsertUser) => {
      const res = await apiRequest("POST", "/api/users", user);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/password`, { password: newPassword });
      return res.json();
    },
  });
}
