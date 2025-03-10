import { useState } from "react";
import { useContracts, useUpdateContract } from "@/lib/contracts";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Edit, MoreVertical, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";


interface ContractTableProps {
  onEdit: (contract: Contract) => void;
}

type EditingCell = {
  id: number;
  field: keyof Contract;
  value: string;
};

export function ContractTable({ onEdit }: ContractTableProps) {
  const { user } = useAuth();
  const { data: contracts, isLoading } = useContracts();
  const updateContract = useUpdateContract();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const deleteContract = useDeleteContract();


  if (isLoading) {
    return <div>Loading contracts...</div>;
  }

  const filteredContracts = contracts?.filter(contract =>
    contract.companyName.toLowerCase().includes(search.toLowerCase()) ||
    contract.inn.includes(search) ||
    contract.director.toLowerCase().includes(search.toLowerCase()) ||
    contract.contractNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleDoubleClick = (contract: Contract, field: keyof Contract) => {
    if (field === 'status' || field === 'createdAt' || field === 'history') return;
    setEditingCell({
      id: contract.id,
      field,
      value: String(contract[field] || ''),
    });
  };

  const handleCellChange = async (contract: Contract) => {
    if (!editingCell) return;

    try {
      const updates = {
        [editingCell.field]: editingCell.field === 'endDate'
          ? new Date(editingCell.value)
          : editingCell.field === 'hasND'
          ? editingCell.value === 'true'
          : editingCell.value
      };

      await updateContract.mutateAsync({
        id: contract.id,
        contract: updates,
      });

      toast({
        title: "Успех",
        description: "Данные обновлены",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при обновлении",
        variant: "destructive",
      });
    }

    setEditingCell(null);
  };

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
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'companyName')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'companyName' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    contract.companyName
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'inn')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'inn' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    contract.inn
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'director')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'director' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    contract.director
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'address')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'address' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    contract.address
                  )}
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'endDate')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'endDate' ? (
                    <Input
                      type="date"
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    format(new Date(contract.endDate), "dd.MM.yyyy")
                  )}
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
                <TableCell
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingCell({
                      id: contract.id,
                      field: 'hasND',
                      value: (!contract.hasND).toString()
                    });
                    handleCellChange({
                      ...contract,
                      hasND: !contract.hasND
                    });
                  }}
                >
                  <div className={`w-4 h-4 rounded ${contract.hasND ? 'bg-red-500' : 'border border-gray-300'}`} />
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(contract, 'comments')}
                >
                  {editingCell?.id === contract.id && editingCell.field === 'comments' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellChange(contract)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                      autoFocus
                    />
                  ) : (
                    contract.comments
                  )}
                </TableCell>
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