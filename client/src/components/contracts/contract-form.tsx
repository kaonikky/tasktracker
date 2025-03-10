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
    defaultValues: contract || {
      contractNumber: "",
      companyName: "",
      inn: "",
      director: "",
      address: "",
      endDate: format(new Date(), "yyyy-MM-dd"),
      comments: "",
      lawyerId: 0
    }
  });

  const inn = form.watch("inn");
  const { data: dadataResult, isLoading: isLoadingDadata } = useDadataSearch(inn);

  const onSubmit = async (data: InsertContract) => {
    try {
      if (contract) {
        await updateContract.mutateAsync({ id: contract.id, contract: data });
        toast({
          title: "Success",
          description: "Contract updated successfully",
        });
      } else {
        await createContract.mutateAsync(data);
        toast({
          title: "Success",
          description: "Contract created successfully",
        });
      }
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAutofill = () => {
    if (dadataResult) {
      form.setValue("companyName", dadataResult.name);
      form.setValue("director", dadataResult.director);
      form.setValue("address", dadataResult.address);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="contractNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract Number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="inn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>INN</FormLabel>
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
                    "Autofill"
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
              <FormLabel>Company Name</FormLabel>
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
              <FormLabel>Director</FormLabel>
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
              <FormLabel>Address</FormLabel>
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
              <FormLabel>End Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comments</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createContract.isPending || updateContract.isPending}
          >
            {createContract.isPending || updateContract.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {contract ? "Update Contract" : "Create Contract"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
