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
