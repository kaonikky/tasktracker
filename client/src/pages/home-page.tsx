import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Stats } from "@/components/dashboard/stats";
import { ContractTable } from "@/components/contracts/contract-table";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContractForm } from "@/components/contracts/contract-form";
import { Contract } from "@shared/schema";
import { PlusCircle } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    setIsFormOpen(true);
  };

  const handleCreateContract = () => {
    setSelectedContract(null);
    setIsFormOpen(true);
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

        <Stats />

        <div className="mt-8">
          <ContractTable onEdit={handleEditContract} />
        </div>
      </main>
    </div>
  );
}