import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDown, Check, X } from "lucide-react"
import { api, type PaginatedResponse } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { User } from "@/stores/auth"

interface RoleOption {
  id: number
  name: string
  code: string
}

interface UserOption {
  id: number
  username: string
  email: string
}

function createCreateSchema(t: (key: string) => string) {
  return z.object({
    username: z.string().min(1, t("users:validation.usernameRequired")).max(64),
    password: z.string().min(1, t("users:validation.passwordRequired")),
    email: z.string().email(t("users:validation.emailInvalid")).or(z.literal("")).optional(),
    phone: z.string().max(32).optional(),
    roleId: z.coerce.number().min(1, t("users:validation.roleRequired")),
    managerId: z.number().nullable().optional(),
  })
}

function createEditSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("users:validation.emailInvalid")).or(z.literal("")).optional(),
    phone: z.string().max(32).optional(),
    roleId: z.coerce.number().min(1, t("users:validation.roleRequired")),
    managerId: z.number().nullable().optional(),
  })
}

type CreateValues = z.infer<ReturnType<typeof createCreateSchema>>
type EditValues = z.infer<ReturnType<typeof createEditSchema>>

interface UserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function UserSheet({ open, onOpenChange, user }: UserSheetProps) {
  const { t } = useTranslation(["users", "common"])
  const queryClient = useQueryClient()
  const isEditing = user !== null

  const [managerComboOpen, setManagerComboOpen] = useState(false)
  const [managerKeyword, setManagerKeyword] = useState("")
  // Track the selected manager display info separately from the form managerId
  // Use a stable key to avoid effect-based resets
  const [managerDisplay, setManagerDisplay] = useState<UserOption | null>(null)
  const [lastUserId, setLastUserId] = useState<number | undefined>(user?.id)

  // Reset manager display when editing a different user (render-time setState pattern)
  if (lastUserId !== user?.id) {
    setLastUserId(user?.id)
    const userAny = user as (User & { manager?: { id: number; username: string } | null }) | null
    setManagerDisplay(userAny?.manager ? { id: userAny.manager.id, username: userAny.manager.username, email: "" } : null)
  }

  const { data: rolesData } = useQuery({
    queryKey: ["roles", "all"],
    queryFn: () =>
      api.get<PaginatedResponse<RoleOption>>("/api/v1/roles?page=1&pageSize=100"),
    enabled: open,
  })

  const { data: usersData } = useQuery({
    queryKey: ["users", "search", managerKeyword],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "50" })
      if (managerKeyword) params.set("keyword", managerKeyword)
      const res = await api.get<PaginatedResponse<UserOption>>(`/api/v1/users?${params}`)
      return res.items
    },
    enabled: open && managerComboOpen,
  })

  const roles = rolesData?.items ?? []
  // Filter out the current user being edited from manager options
  const managerOptions = (usersData ?? []).filter((u) => !isEditing || u.id !== user?.id)

  const form = useForm<CreateValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver((isEditing ? createEditSchema(t) : createCreateSchema(t)) as any),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      phone: "",
      roleId: 0,
      managerId: null,
    },
  })

  useEffect(() => {
    if (open) {
      const userAny = user as (User & { manager?: { id: number; username: string } | null }) | null
      if (userAny) {
        form.reset({
          username: userAny.username,
          password: "",
          email: userAny.email || "",
          phone: userAny.phone || "",
          roleId: userAny.role?.id || 0,
          managerId: userAny.manager?.id ?? null,
        })
      } else {
        form.reset({
          username: "",
          password: "",
          email: "",
          phone: "",
          roleId: 0,
          managerId: null,
        })
      }
    }
  }, [open, user, form])

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      api.post("/api/v1/users", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: EditValues) =>
      api.put(`/api/v1/users/${user!.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
  })

  function onSubmit(values: CreateValues) {
    if (isEditing) {
      updateMutation.mutate({
        email: values.email,
        phone: values.phone,
        roleId: values.roleId,
        managerId: values.managerId,
      })
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error || updateMutation.error

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? t("users:editUser") : t("users:createUser")}</SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing ? t("users:editDescription") : t("users:createDescription")}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 px-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users:username")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("users:usernamePlaceholder")} disabled={isEditing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users:password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("users:passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users:email")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("users:emailPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users:phone")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("users:phonePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users:role")}</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("users:selectRole")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Direct Manager selector */}
            <FormField
              control={form.control}
              name="managerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users:manager")}</FormLabel>
                  <div className="flex gap-2">
                    <Popover open={managerComboOpen} onOpenChange={(v) => { setManagerComboOpen(v); if (!v) setManagerKeyword("") }}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("flex-1 justify-between font-normal", !managerDisplay && "text-muted-foreground")}
                          >
                            {managerDisplay ? managerDisplay.username : t("users:selectManager")}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="border-b p-2">
                          <Input
                            placeholder={t("users:searchPlaceholder")}
                            value={managerKeyword}
                            onChange={(e) => setManagerKeyword(e.target.value)}
                            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <div className="max-h-52 overflow-auto p-1">
                          {(!managerOptions || managerOptions.length === 0) ? (
                            <p className="py-3 text-center text-sm text-muted-foreground">{t("common:noData")}</p>
                          ) : managerOptions.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setManagerDisplay(u)
                                field.onChange(u.id)
                                setManagerComboOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                                field.value === u.id && "bg-accent"
                              )}
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] shrink-0">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <span>{u.username}</span>
                              {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                              {field.value === u.id && <Check className="ml-auto h-4 w-4 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {managerDisplay && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setManagerDisplay(null)
                          field.onChange(null)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}

            <SheetFooter>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? t("common:saving") : t("common:save")}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
