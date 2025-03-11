import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateContract, useUpdateContract } from "@/lib/contracts";
import { Contract, InsertContract, insertContractSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useDadataSearch } from "@/lib/dadata";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ContractFormProps {
  contract?: Contract | null;
  onClose: () => void;
}

export function ContractForm({ contract, onClose }: ContractFormProps) {
  const { toast } = useToast();
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();

  const form = useForm<InsertContract>({
    resolver: zodResolver(insertContractSchema),
    defaultValues: contract ? {
      ...contract,
      endDate: contract.endDate instanceof Date 
        ? format(contract.endDate, "yyyy-MM-dd") 
        : format(new Date(contract.endDate), "yyyy-MM-dd"),
    } : {
      companyName: "",
      inn: "",
      director: "",
      address: "",
      endDate: "",
      comments: "",
      lawyerId: 0,
      hasND: false
    }
  });

  const inn = form.watch("inn");
  const { data: dadataResult, isLoading: isLoadingDadata, error: dadataError } = useDadataSearch(inn);

  // Check for existing INN when INN field changes
  useEffect(() => {
    const checkExistingInn = async () => {
      if (!inn || inn.length < 3) return; // Don't check if INN is too short

      try {
        const response = await apiRequest("GET", `/api/contracts/check-inn/${inn}`);
        const exists = await response.json();

        if (exists) {
          form.setError("inn", {
            type: "manual",
            message: "Контракт с таким ИНН уже существует"
          });
        } else {
          form.clearErrors("inn");
        }
      } catch (error) {
        console.error('Error checking INN:', error);
      }
    };

    checkExistingInn();
  }, [inn, form]);

  useEffect(() => {
    if (dadataError) {
      console.error('DADATA search error:', dadataError);
      toast({
        title: "Ошибка поиска",
        description: "Не удалось получить данные о компании",
        variant: "destructive",
      });
    }
  }, [dadataError, toast]);

  const handleAutofill = () => {
    if (dadataResult) {
      form.setValue("companyName", dadataResult.name);
      form.setValue("director", dadataResult.director);
      form.setValue("address", dadataResult.address);
    }
  };

  const onSubmit = async (data: InsertContract) => {
    try {
      const formattedData = {
        ...data,
        endDate: new Date(data.endDate),
      };

      if (contract) {
        await updateContract.mutateAsync({ id: contract.id, contract: formattedData });
        toast({
          title: "Успех",
          description: "Договор успешно обновлен",
        });
      } else {
        await createContract.mutateAsync(formattedData);
        toast({
          title: "Успех",
          description: "Договор успешно создан",
        });
      }
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Произошла ошибка";
      console.error('Contract operation error:', error);

      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="inn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ИНН</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutofill}
                  disabled={!dadataResult || isLoadingDadata}
                >
                  {isLoadingDadata ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Заполнить"
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название компании</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="director"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Руководитель</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Адрес</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дата окончания</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hasND"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </FormControl>
              <FormLabel>НД</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарии</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={createContract.isPending || updateContract.isPending}
          >
            {createContract.isPending || updateContract.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {contract ? "Обновить договор" : "Создать договор"}
          </Button>
        </div>
      </form>
    </Form>
  );
}