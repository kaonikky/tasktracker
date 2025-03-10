import { useQuery } from "@tanstack/react-query";

interface CompanyInfo {
  name: string;
  inn: string;
  director: string;
  address: string;
}

export async function searchCompanyByInn(inn: string): Promise<CompanyInfo> {
  const token = import.meta.env.VITE_DADATA_API_KEY;
  console.log('Using DADATA API with token:', token ? 'Present' : 'Missing');

  if (!token) {
    throw new Error("DADATA API key not configured");
  }

  console.log('Searching for company with INN:', inn);

  const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${token}`
    },
    body: JSON.stringify({ query: inn })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DADATA API error:', error);
    throw new Error("Failed to fetch company info");
  }

  const data = await response.json();
  console.log('DADATA API response:', data);

  if (!data.suggestions?.[0]) {
    throw new Error("Company not found");
  }

  const company = data.suggestions[0].data;
  const result = {
    name: company.name.short_with_opf || company.name.full_with_opf,
    inn: company.inn,
    director: company.management?.name || "Not specified",
    address: company.address.unrestricted_value || "Not specified"
  };

  console.log('Parsed company info:', result);
  return result;
}

export function useDadataSearch(inn: string) {
  return useQuery({
    queryKey: ["dadata", inn],
    queryFn: () => searchCompanyByInn(inn),
    enabled: Boolean(inn && inn.length >= 10),
  });
}