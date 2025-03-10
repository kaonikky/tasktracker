import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Stats } from "@/components/dashboard/stats";
import { ContractTable } from "@/components/contracts/contract-table";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContractForm } from "@/components/contracts/contract-form";
import { Contract } from "@shared/schema";
import { PlusCircle, Download } from "lucide-react";
import { importFromGoogleSheets } from "@/lib/google-sheets";
import { useCreateContract } from "@/lib/contracts";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const createContract = useCreateContract();
  const { toast } = useToast();

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    setIsFormOpen(true);
  };

  const handleCreateContract = () => {
    setSelectedContract(null);
    setIsFormOpen(true);
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      const contracts = await importFromGoogleSheets();

      // Последовательно создаем контракты
      for (const contract of contracts) {
        await createContract.mutateAsync(contract);
      }

      toast({
        title: "Успех",
        description: `Импортировано ${contracts.length} контрактов`,
      });
    } catch (error) {
      toast({
        title: "Ошибка импорта",
        description: error instanceof Error ? error.message : "Произошла ошибка при импорте",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Contract Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              {user?.username} ({user?.role})
            </span>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Выход..." : "Выйти"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleImport}
              disabled={isImporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isImporting ? "Импорт..." : "Импорт из Google Sheets"}
            </Button>
            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
              <SheetTrigger asChild>
                <Button onClick={handleCreateContract}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Новый договор
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>
                    {selectedContract ? "Редактировать договор" : "Новый договор"}
                  </SheetTitle>
                </SheetHeader>
                <ContractForm
                  contract={selectedContract}
                  onClose={() => setIsFormOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Stats />

        <div className="mt-8">
          <ContractTable onEdit={handleEditContract} />
        </div>
      </main>
    </div>
  );
}