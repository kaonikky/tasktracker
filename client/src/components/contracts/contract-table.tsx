import { useState } from "react";
import { useContracts, useUpdateContract, useDeleteContract } from "@/lib/contracts";
import { Contract } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/lib/users";
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
import { Edit, MoreVertical, Trash, ArrowUpDown, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ContractHistory } from "./contract-history";

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
  const { data: users } = useUsers();
  const updateContract = useUpdateContract();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const deleteContract = useDeleteContract();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'endDate', 
    direction: 'asc' 
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  // Sorting logic
  if (sortConfig.key) {
    filteredContracts.sort((a, b) => {
      if (sortConfig.key === null) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Специальная обработка для сортировки по юристу
      if (sortConfig.key === 'lawyerId') {
        const lawyerA = users?.find(u => u.id === a.lawyerId)?.username || '';
        const lawyerB = users?.find(u => u.id === b.lawyerId)?.username || '';
        aValue = lawyerA.toLowerCase();
        bValue = lawyerB.toLowerCase();
      } else if (sortConfig.key === 'endDate') {
        // Convert dates to timestamps for comparison
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (aValue instanceof Date) {
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

    // Only make API call if value actually changed
    if (String(contract[editingCell.field]) === editingCell.value) {
      setEditingCell(null);
      return;
    }

    try {
      const updates = {
        [editingCell.field]: editingCell.value
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

  const handleLawyerChange = async (contractId: number, lawyerId: number) => {
    try {
      await updateContract.mutateAsync({
        id: contractId,
        contract: { lawyerId },
      });

      toast({
        title: "Успех",
        description: "Юрист назначен",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при назначении юриста",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Поиск договоров..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant="outline"
          onClick={() => setIsHistoryOpen(true)}
          className="ml-2"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
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
              <TableHead onClick={() => handleSort('lawyerId')} className="cursor-pointer">
                Юрист <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
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
                    onDoubleClick={() => {
                      const dateStr = format(new Date(contract.endDate), "yyyy-MM-dd");
                      setEditingCell({
                        id: contract.id,
                        field: 'endDate',
                        value: dateStr
                      });
                    }}
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
                      className={`w-full py-2 px-3 text-center text-sm font-medium
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
                    className={`cursor-text transition-colors ${!editingCell || editingCell.id !== contract.id || editingCell.field !== 'comments'
                      ? 'hover:bg-muted/50 min-h-[40px] rounded-md border border-dashed border-muted-foreground/25'
                      : ''}`}
                    onClick={() => {
                      if (!editingCell || editingCell.id !== contract.id || editingCell.field !== 'comments') {
                        setEditingCell({
                          id: contract.id,
                          field: 'comments',
                          value: String(contract.comments || ''),
                        });
                      }
                    }}
                  >
                    {editingCell?.id === contract.id && editingCell.field === 'comments' ? (
                      <Input
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => handleCellChange(contract)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                        autoFocus
                        className="w-full"
                      />
                    ) : (
                      <span className="px-2 py-1 block min-h-[28px]">
                        {contract.comments || ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onDoubleClick={() => handleDoubleClick(contract, 'lawyerId')}
                  >
                    {editingCell?.id === contract.id && editingCell.field === 'lawyerId' ? (
                      <Input
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => handleCellChange(contract)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellChange(contract)}
                        autoFocus
                      />
                    ) : (
                      <span className="px-2 py-1 block min-h-[28px]">
                        {users?.find(u => u.id === contract.lawyerId)?.username || 'Не назначен'}
                      </span>
                    )}
                  </TableCell>
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
      <ContractHistory
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />
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