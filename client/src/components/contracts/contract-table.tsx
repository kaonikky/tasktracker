import { useState } from "react";
import { useContracts, useUpdateContract, useDeleteContract } from "@/lib/contracts";
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
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Edit, MoreVertical, Trash, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type SortConfig = {
  key: keyof Contract | null;
  direction: 'asc' | 'desc';
};

type EditingCell = {
  id: number;
  field: keyof Contract;
  value: string;
};

export function ContractTable({ onEdit }: { onEdit: (contract: Contract) => void }) {
  const { user } = useAuth();
  const { data: contracts, isLoading } = useContracts();
  const updateContract = useUpdateContract();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const deleteContract = useDeleteContract();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  if (isLoading) {
    return <div>Loading contracts...</div>;
  }

  const handleSort = (key: keyof Contract) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  let filteredContracts = contracts?.filter(contract =>
    contract.companyName.toLowerCase().includes(search.toLowerCase()) ||
    contract.inn.includes(search) ||
    contract.director.toLowerCase().includes(search.toLowerCase())
  ) || [];

  if (sortConfig.key) {
    filteredContracts.sort((a, b) => {
      if (sortConfig.key === null) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Приведение к строке для сравнения
      if (aValue instanceof Date) {
        aValue = aValue.getTime();
        bValue = (bValue as Date).getTime();
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleDoubleClick = (contract: Contract, field: keyof Contract) => {
    if (field === 'status' || field === 'createdAt' || field === 'history' || field === 'daysLeft' || field === 'hasND') return;
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
              <TableHead onClick={() => handleSort('companyName')} className="cursor-pointer">
                Компания <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead onClick={() => handleSort('inn')} className="cursor-pointer">
                ИНН <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead onClick={() => handleSort('director')} className="cursor-pointer">
                Руководитель <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead onClick={() => handleSort('address')} className="cursor-pointer">
                Адрес <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead onClick={() => handleSort('endDate')} className="cursor-pointer">
                Дата окончания <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead>Статус</TableHead>
              <TableHead onClick={() => handleSort('hasND')} className="cursor-pointer">
                НД <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead onClick={() => handleSort('comments')} className="cursor-pointer">
                Комментарии <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead>Юрист</TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts.map((contract) => {
              const endDate = new Date(contract.endDate);
              const today = new Date();
              const daysLeft = -differenceInDays(today, endDate);

              return (
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
                      format(endDate, "dd.MM.yyyy")
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                        ${daysLeft < 0 ? "bg-red-100 text-red-800" :
                        daysLeft <= 30 ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"}`}
                    >
                      {daysLeft < 0
                        ? `Истек ${Math.abs(daysLeft)} дней назад`
                        : `Истекает через ${daysLeft} дней`}
                    </div>
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => {
                      updateContract.mutate({
                        id: contract.id,
                        contract: { hasND: !contract.hasND },
                      });
                    }}
                  >
                    <div className={`w-6 h-6 rounded ${contract.hasND ? 'bg-red-500' : 'border-2 border-gray-300'}`} />
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
                  <TableCell>{contract.history[0]?.username || 'Не указан'}</TableCell>
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
              );
            })}
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
                  deleteContract.mutate(deleteConfirm);
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