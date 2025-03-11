import { useState, useMemo, useCallback } from "react";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Edit, MoreVertical, Trash, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { data: contracts = [], isLoading } = useContracts();
  const { data: users } = useUsers();
  const updateContract = useUpdateContract();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const deleteContract = useDeleteContract();

  // Memoize filtered contracts
  const filteredContracts = useMemo(() => {
    let result = contracts.filter(contract =>
      contract.companyName.toLowerCase().includes(search.toLowerCase()) ||
      contract.inn.includes(search) ||
      contract.director.toLowerCase().includes(search.toLowerCase())
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === null) return 0;

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'lawyerId') {
          const lawyerA = users?.find(u => u.id === a.lawyerId)?.username || '';
          const lawyerB = users?.find(u => u.id === b.lawyerId)?.username || '';
          aValue = lawyerA.toLowerCase();
          bValue = lawyerB.toLowerCase();
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

    return result;
  }, [contracts, search, sortConfig, users]);

  const handleSort = useCallback((key: keyof Contract) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleCellChange = useCallback(async (contract: Contract) => {
    if (!editingCell) return;

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
  }, [editingCell, updateContract, toast]);

  const handleLawyerChange = useCallback(async (contractId: number, lawyerId: number) => {
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
  }, [updateContract, toast]);

  if (isLoading) {
    return <div>Loading contracts...</div>;
  }

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
              <TableHead onClick={() => handleSort('lawyerId')} className="cursor-pointer">
                Юрист <ArrowUpDown className="inline h-4 w-4" />
              </TableHead>
              <TableHead className="w-[100px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.companyName}</TableCell>
                <TableCell>{contract.inn}</TableCell>
                <TableCell>{contract.director}</TableCell>
                <TableCell>{contract.address}</TableCell>
                <TableCell>{format(new Date(contract.endDate), "dd.MM.yyyy")}</TableCell>
                <TableCell>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                      ${contract.status === "expired" ? "bg-red-100 text-red-800" :
                      contract.status === "expiring_soon" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"}`}
                  >
                    {contract.status === "expired"
                      ? `Истек ${Math.abs(contract.daysLeft)} дней назад`
                      : `Истекает через ${contract.daysLeft} дней`}
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
                <TableCell>
                  <Select
                    value={contract.lawyerId?.toString()}
                    onValueChange={(value) => handleLawyerChange(contract.id, Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {users?.find(u => u.id === contract.lawyerId)?.username || 'Не назначен'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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