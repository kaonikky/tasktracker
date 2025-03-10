import { Contract } from "@shared/schema";

export async function syncWithGoogleSheets(contracts: Contract[]) {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;

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
          contract.companyName,
          contract.inn,
          contract.director,
          contract.address,
          new Date(contract.endDate).toLocaleDateString(),
          contract.comments || "",
          contract.hasND ? "true" : "false"
        ])
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets API error:', errorText);
      throw new Error("Failed to sync with Google Sheets");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Sheets sync failed: ${error.message}`);
    }
    throw new Error("Google Sheets sync failed");
  }
}

export async function importFromGoogleSheets(): Promise<Partial<Contract>[]> {
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;

  console.log('Starting Google Sheets import');
  console.log('Spreadsheet ID present:', !!spreadsheetId);

  if (!spreadsheetId) {
    throw new Error("Google Sheets ID not configured");
  }

  // Используем CSV формат для доступа к таблице
  const endpoint = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  console.log('Fetching from endpoint:', endpoint);

  try {
    const response = await fetch(endpoint);
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets error response:', errorText);
      throw new Error(`Failed to fetch data from Google Sheets: ${errorText}`);
    }

    const text = await response.text();
    console.log('Received data:', text.substring(0, 100) + '...');

    // Разбираем CSV
    const rows = text.split('\n').map(row => row.split(',').map(cell => 
      cell.trim().replace(/^"(.*)"$/, '$1') // Убираем кавычки если они есть
    ));

    if (rows.length <= 1) {
      console.log('No data rows found in sheet');
      return [];
    }

    // Пропускаем заголовок
    const contracts = rows.slice(1).map((row, index) => {
      console.log(`Processing row ${index + 1}:`, row);

      const contract = {
        companyName: row[0] || "",
        inn: row[1] ? String(row[1]) : "",
        director: row[2] || "",
        address: row[3] || "",
        endDate: row[4] ? new Date(row[4]) : new Date(),
        comments: row[5] || "",
        hasND: row[6] === "true" || row[6] === "1",
        lawyerId: 1 // По умолчанию присваиваем первому юристу
      };

      console.log(`Processed contract:`, contract);
      return contract;
    });

    console.log(`Successfully processed ${contracts.length} contracts`);
    return contracts;
  } catch (error) {
    console.error("Google Sheets import error:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to import data from Google Sheets: ${error.message}`);
    }
    throw new Error("Failed to import data from Google Sheets");
  }
}