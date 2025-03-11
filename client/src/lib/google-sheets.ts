import { Contract } from "@shared/schema";

function parseSheetDate(dateStr: string): Date {
  // Попытка парсинга даты в формате ДД.ММ.ГГГГ
  const dateParts = dateStr.split('.');
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // месяцы в JS начинаются с 0
    const year = parseInt(dateParts[2]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Попытка парсинга ISO формата
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  throw new Error(`Неверный формат даты: ${dateStr}. Используйте формат ДД.ММ.ГГГГ`);
}

export async function importFromGoogleSheets(): Promise<Partial<Contract>[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;

  console.log('Starting Google Sheets import');
  console.log('API Key present:', !!apiKey);
  console.log('API Key length:', apiKey?.length);
  console.log('Spreadsheet ID present:', !!spreadsheetId);

  if (!apiKey || !spreadsheetId) {
    throw new Error("API ключ или ID таблицы не настроены. Проверьте переменные окружения.");
  }

  const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const endpoint = `${baseUrl}/${spreadsheetId}/values/A1:Z1000`;
  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;

  console.log('Using endpoint:', endpoint);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Raw response:', responseText);

    if (!response.ok) {
      let errorMessage = 'Ошибка при получении данных из Google Sheets';
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error) {
          errorMessage = `${errorMessage}: ${errorJson.error.message}`;
          console.error('Detailed error:', errorJson.error);
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    console.log('Parsed data structure:', {
      hasValues: !!data.values,
      rowCount: data.values?.length || 0,
      headers: data.values?.[0] || []
    });

    if (!data.values || data.values.length <= 1) {
      throw new Error("Таблица пуста или содержит только заголовки");
    }

    // Проверяем заголовки
    const expectedHeaders = ['Название компании', 'ИНН', 'Директор', 'Адрес', 'Дата окончания', 'Комментарии', 'НД'];
    const headers = data.values[0];

    if (!headers || headers.length < expectedHeaders.length) {
      throw new Error(`Неверная структура таблицы. Ожидаемые столбцы: ${expectedHeaders.join(', ')}`);
    }

    // Пропускаем заголовок
    const contracts = data.values.slice(1).map((row, index) => {
      console.log(`Processing row ${index + 1}:`, row);

      try {
        if (!row[0] && !row[1]) {
          console.log(`Skipping empty row ${index + 1}`);
          return null;
        }

        let endDate: Date;
        try {
          endDate = parseSheetDate(row[4] || '');
        } catch (error) {
          console.error(`Date parsing error in row ${index + 1}:`, error);
          throw new Error(`Ошибка в строке ${index + 1}: ${error instanceof Error ? error.message : 'Неверный формат даты'}`);
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
    }).filter(Boolean); // Удаляем пустые строки

    if (contracts.length === 0) {
      throw new Error("Не найдено данных для импорта в таблице");
    }

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

export async function syncWithGoogleSheets(contracts: Contract[]) {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID;
  console.log('Using Google Sheets API with key:', apiKey ? 'Present' : 'Missing');

  if (!apiKey || !spreadsheetId) {
    throw new Error("API ключ или ID таблицы не настроены");
  }

  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000`;

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
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
      throw new Error("Не удалось синхронизировать с Google Sheets");
    }

    return await response.json();
  } catch (error) {
    console.error('Sync error:', error);
    throw new Error(`Ошибка синхронизации с Google Sheets: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}