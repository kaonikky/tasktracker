interface CompanyInfo {
  name: string;
  inn: string;
  director: string;
  address: string;
}

export async function searchCompanyByInn(inn: string): Promise<CompanyInfo> {
  const token = process.env.VITE_DADATA_API_KEY;
  if (!token) {
    throw new Error("DADATA API key not configured");
  }

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
    throw new Error("Failed to fetch company info");
  }

  const data = await response.json();
  
  if (!data.suggestions?.[0]) {
    throw new Error("Company not found");
  }

  const company = data.suggestions[0].data;
  return {
    name: company.name.short_with_opf || company.name.full_with_opf,
    inn: company.inn,
    director: company.management?.name || "Not specified",
    address: company.address.unrestricted_value || "Not specified"
  };
}

export function useDadataSearch(inn: string) {
  return useQuery({
    queryKey: ["dadata", inn],
    queryFn: () => searchCompanyByInn(inn),
    enabled: Boolean(inn && inn.length >= 10),
  });
}
