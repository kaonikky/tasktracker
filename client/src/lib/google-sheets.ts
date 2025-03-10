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

  console.log('Starting Google Sheets import');
  console.log('API Key present:', !!apiKey);
  console.log('Spreadsheet ID present:', !!spreadsheetId);

  if (!apiKey || !spreadsheetId) {
    throw new Error("Google Sheets API not configured. Please check your environment variables.");
  }

  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000`;
  console.log('Fetching from endpoint:', endpoint);

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Origin': window.location.origin
      }
    });
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets API error response:', errorText);

      if (response.status === 403) {
        throw new Error("API ключ не имеет доступа к Google Sheets API. Проверьте настройки в Google Cloud Console.");
      } else if (response.status === 404) {
        throw new Error("Таблица не найдена. Проверьте ID таблицы и права доступа.");
      }

      throw new Error(`Ошибка при получении данных из Google Sheets: ${errorText}`);
    }

    const data = await response.json();
    console.log('Received data structure:', {
      hasValues: !!data.values,
      rowCount: data.values?.length || 0,
      headers: data.values?.[0] || []
    });

    const rows = data.values || [];

    if (rows.length <= 1) {
      console.log('No data rows found in sheet');
      throw new Error("Таблица пуста или содержит только заголовки");
    }

    // Пропускаем заголовок
    const contracts = rows.slice(1).map((row, index) => {
      console.log(`Processing row ${index + 1}:`, row);

      try {
        let endDate = new Date();
        if (row[4]) {
          // Пробуем разные форматы даты
          const dateParts = row[4].split('.');
          if (dateParts.length === 3) {
            // Формат ДД.ММ.ГГГГ
            endDate = new Date(
              parseInt(dateParts[2]), 
              parseInt(dateParts[1]) - 1, 
              parseInt(dateParts[0])
            );
          } else {
            endDate = new Date(row[4]);
          }
        }

        const contract = {
          companyName: row[0] || "",
          inn: row[1] || "",
          director: row[2] || "",
          address: row[3] || "",
          endDate: endDate,
          comments: row[5] || "",
          hasND: row[6]?.toLowerCase() === "true",
          lawyerId: 1 // По умолчанию присваиваем первому юристу
        };

        console.log(`Processed contract:`, contract);
        return contract;
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
        throw new Error(`Ошибка при обработке строки ${index + 1}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    });

    console.log(`Successfully processed ${contracts.length} contracts`);
    return contracts;
  } catch (error) {
    console.error("Google Sheets import error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Не удалось импортировать данные из Google Sheets");
  }
}