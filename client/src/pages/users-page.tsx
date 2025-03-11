import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useUsers, useCreateUser, useUpdateUserPassword } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

const newUserSchema = z.object({
  username: z.string().min(1, "Имя пользователя обязательно"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
  role: z.enum(["admin", "lawyer"]),
});

const changePasswordSchema = z.object({
  userId: z.number(),
  newPassword: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

export default function UsersPage() {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const updatePassword = useUpdateUserPassword();
  const { toast } = useToast();
  const [isNewUserFormOpen, setIsNewUserFormOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Если пользователь не админ, перенаправляем на главную
  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  const newUserForm = useForm({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "lawyer" as const,
    },
  });

  const changePasswordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      userId: 0,
      newPassword: "",
    },
  });

  const handleCreateUser = async (data: z.infer<typeof newUserSchema>) => {
    try {
      await createUser.mutateAsync(data);
      setIsNewUserFormOpen(false);
      newUserForm.reset();
      toast({
        title: "Успех",
        description: "Пользователь успешно создан",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async (data: z.infer<typeof changePasswordSchema>) => {
    try {
      await updatePassword.mutateAsync({
        userId: selectedUserId!,
        newPassword: data.newPassword,
      });
      setIsChangePasswordOpen(false);
      changePasswordForm.reset();
      toast({
        title: "Успех",
        description: "Пароль успешно изменен",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Управление пользователями</h1>
        <Sheet open={isNewUserFormOpen} onOpenChange={setIsNewUserFormOpen}>
          <SheetTrigger asChild>
            <Button>Добавить пользователя</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Новый пользователь</SheetTitle>
            </SheetHeader>
            <Form {...newUserForm}>
              <form onSubmit={newUserForm.handleSubmit(handleCreateUser)} className="space-y-4 mt-4">
                <FormField
                  control={newUserForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя пользователя</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Роль</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите роль" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lawyer">Юрист</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? "Создание..." : "Создать пользователя"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {users?.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle className="text-lg">{user.username}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Роль: </span>
                  <span className="font-medium">{user.role === "admin" ? "Администратор" : "Юрист"}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setIsChangePasswordOpen(true);
                  }}
                >
                  Сменить пароль
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Изменение пароля</SheetTitle>
          </SheetHeader>
          <Form {...changePasswordForm}>
            <form onSubmit={changePasswordForm.handleSubmit(handleChangePassword)} className="space-y-4 mt-4">
              <FormField
                control={changePasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Новый пароль</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
                {updatePassword.isPending ? "Изменение..." : "Изменить пароль"}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
