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

export async function syncWithGoogleSheets(contracts: Contract[]) {
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    throw new Error("ID таблицы не настроен");
  }

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:Z1000',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: contracts.map(contract => [
          contract.companyName,
          contract.inn,
          contract.director,
          contract.address,
          new Date(contract.endDate).toLocaleDateString(),
          contract.comments || "",
          contract.hasND ? "true" : "false"
        ])
      }
    });

    if (response.status !== 200) {
      throw new Error("Не удалось синхронизировать с Google Sheets");
    }

    return response.data;
  } catch (error) {
    console.error('Sync error:', error);
    throw new Error(`Ошибка синхронизации с Google Sheets: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}