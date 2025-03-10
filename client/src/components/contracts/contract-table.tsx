import { useState } from "react";
import { useContracts, useDeleteContract } from "@/lib/contracts";
import { Contract } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Edit, MoreVertical, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContractTableProps {
  onEdit: (contract: Contract) => void;
}

export function ContractTable({ onEdit }: ContractTableProps) {
  const { user } = useAuth();
  const { data: contracts, isLoading } = useContracts();
  const deleteContract = useDeleteContract();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  if (isLoading) {
    return <div>Loading contracts...</div>;
  }

  const filteredContracts = contracts?.filter(contract =>
    contract.companyName.toLowerCase().includes(search.toLowerCase()) ||
    contract.inn.includes(search) ||
    contract.director.toLowerCase().includes(search.toLowerCase()) ||
    contract.contractNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    try {
      await deleteContract.mutateAsync(id);
      toast({
        title: "Success",
        description: "Contract deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contract",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Поиск договоров..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Компания</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Руководитель</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Дата окончания</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>НД</TableHead>
              <TableHead>Комментарии</TableHead>
              <TableHead>Юрист</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts?.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.companyName}</TableCell>
                <TableCell>{contract.inn}</TableCell>
                <TableCell>{contract.director}</TableCell>
                <TableCell>{contract.address}</TableCell>
                <TableCell>
                  {format(new Date(contract.endDate), "dd.MM.yyyy")}
                </TableCell>
                <TableCell>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                      ${contract.status === "expired" ? "bg-red-100 text-red-800" :
                      contract.status === "expiring_soon" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"}`}
                  >
                    {contract.status === "expired" ? "Истёк" :
                     contract.status === "expiring_soon" ? "Истекает" :
                     "Активен"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={`w-4 h-4 rounded ${contract.hasND ? 'bg-red-500' : 'border border-gray-300'}`} />
                </TableCell>
                <TableCell>{contract.comments}</TableCell>
                <TableCell>{contract.history[0]?.username}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(contract)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Редактировать
                      </DropdownMenuItem>
                      {user?.role === "admin" && (
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteConfirm(contract.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Удалить
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Договор будет удален безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600"
              onClick={() => {
                if (deleteConfirm) {
                  handleDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}