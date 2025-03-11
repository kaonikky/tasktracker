import { useContracts } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, CheckCircle, XCircle } from "lucide-react";
import { differenceInDays } from "date-fns";

export function Stats() {
  const { data: contracts } = useContracts();

  // Вычисляем статистику, используя daysLeft
  const calculateStats = () => {
    if (!contracts) return { total: 0, expiringSoon: 0, expired: 0 };

    return contracts.reduce((acc, contract) => {
      const endDate = new Date(contract.endDate);
      const today = new Date();
      const daysLeft = -differenceInDays(today, endDate);

      return {
        total: acc.total + 1,
        expiringSoon: acc.expiringSoon + (daysLeft > 0 && daysLeft <= 30 ? 1 : 0),
        expired: acc.expired + (daysLeft < 0 ? 1 : 0),
      };
    }, { total: 0, expiringSoon: 0, expired: 0 });
  };

  const stats = calculateStats();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего договоров</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Истекают</CardTitle>
          <CalendarClock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.expiringSoon}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Истекли</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.expired}</div>
        </CardContent>
      </Card>
    </div>
  );
}