import { Contract } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function importFromGoogleSheets(): Promise<Contract[]> {
  console.log('Starting Google Sheets import');

  try {
    const response = await apiRequest('GET', '/api/sheets/import');
    const contracts = await response.json();
    console.log(`Successfully imported ${contracts.length} contracts`);
    return contracts;
  } catch (error) {
    console.error('Import error:', error);
    throw error instanceof Error ? error : new Error('Ошибка при импорте из Google Sheets');
  }
}