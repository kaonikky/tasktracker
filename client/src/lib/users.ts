import { useMutation, useQuery } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/users");
        const users = await response.json();
        console.log('Fetched users:', users); // Debug log
        return users;
      } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
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
      await apiRequest("PUT", `/api/users/${userId}/password`, { password: newPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}