import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Contract, ContractHistoryEntry } from "@shared/schema";
import { useContracts } from "@/lib/contracts";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface ContractHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractHistory({ open, onOpenChange }: ContractHistoryProps) {
  const { data: contracts } = useContracts();
  const [search, setSearch] = useState("");

  // Собираем всю историю из всех контрактов
  const allHistory = contracts?.flatMap(contract => 
    contract.history.map(entry => ({
      ...entry,
      contractId: contract.id,
      contractName: contract.companyName
    }))
  ) || [];

  // Сортируем по дате (самые новые сверху)
  const sortedHistory = [...allHistory].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Фильтруем по поиску
  const filteredHistory = sortedHistory.filter(entry =>
    entry.contractName.toLowerCase().includes(search.toLowerCase()) ||
    entry.username.toLowerCase().includes(search.toLowerCase()) ||
    Object.keys(entry.changes).some(field => 
      field.toLowerCase().includes(search.toLowerCase())
    )
  );

  // Форматирование изменений для отображения
  const formatChanges = (changes: Record<string, { old: any; new: any }>) => {
    return Object.entries(changes).map(([field, { old, new: newValue }]) => {
      // Форматируем даты если это поле с датой
      if (field === 'endDate') {
        old = old ? format(new Date(old), 'dd.MM.yyyy') : '';
        newValue = newValue ? format(new Date(newValue), 'dd.MM.yyyy') : '';
      }
      
      return `${field}: ${old || '(пусто)'} → ${newValue || '(пусто)'}`;
    }).join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>История изменений договоров</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <Input
            placeholder="Поиск по истории..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Договор</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Изменения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((entry, index) => (
                <TableRow key={`${entry.contractId}-${entry.timestamp}-${index}`}>
                  <TableCell>
                    {format(new Date(entry.timestamp), 'dd.MM.yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>{entry.contractName}</TableCell>
                  <TableCell>{entry.username}</TableCell>
                  <TableCell>
                    {entry.action === 'created' ? 'Создан' : 'Изменен'}
                  </TableCell>
                  <TableCell className="whitespace-pre-line">
                    {entry.action === 'created' 
                      ? 'Создан новый договор' 
                      : formatChanges(entry.changes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
