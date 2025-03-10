import { Contract } from "@shared/schema";

export async function syncWithGoogleSheets(contracts: Contract[]) {
  const apiKey = process.env.VITE_GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.VITE_GOOGLE_SHEETS_ID;
  
  if (!apiKey || !spreadsheetId) {
    throw new Error("Google Sheets API not configured");
  }
  
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000`;
  
  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: contracts.map(contract => [
          contract.contractNumber,
          contract.companyName,
          contract.inn,
          contract.director,
          contract.address,
          new Date(contract.endDate).toLocaleDateString(),
          contract.status,
          contract.comments || ""
        ])
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to sync with Google Sheets");
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Google Sheets sync failed: ${error.message}`);
  }
}

export async function importFromGoogleSheets(): Promise<Partial<Contract>[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;

  if (!apiKey || !spreadsheetId) {
    throw new Error("Google Sheets API not configured");
  }

  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000`;

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`);

    if (!response.ok) {
      throw new Error("Failed to fetch data from Google Sheets");
    }

    const data = await response.json();
    const rows = data.values || [];

    // Пропускаем заголовок
    const contracts = rows.slice(1).map(row => ({
      companyName: row[0] || "",
      inn: row[1] || "",
      director: row[2] || "",
      address: row[3] || "",
      endDate: row[4] ? new Date(row[4]) : new Date(),
      comments: row[5] || "",
      hasND: row[6] === "true",
      lawyerId: 1 // По умолчанию присваиваем первому юристу
    }));

    return contracts;
  } catch (error) {
    console.error("Google Sheets import error:", error);
    throw new Error("Failed to import data from Google Sheets");
  }
}