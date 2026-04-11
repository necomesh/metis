import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type PaginatedResponse } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { KnowledgeBaseItem } from "../index"

interface ModelOption {
  id: number
  displayName: string
  modelId: string
}

function useKnowledgeBaseSchema() {
  const { t } = useTranslation("ai")
  return z.object({
    name: z.string().min(1, t("validation.nameRequired")).max(128),
    description: z.string().max(512).optional(),
    compileModelId: z.coerce.number().optional(),
    autoCompile: z.boolean(),
    crawlEnabled: z.boolean(),
    crawlSchedule: z.string().max(128).optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof useKnowledgeBaseSchema>>

interface KnowledgeBaseFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  knowledgeBase: KnowledgeBaseItem | null
}

export function KnowledgeBaseForm({ open, onOpenChange, knowledgeBase }: KnowledgeBaseFormProps) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const isEditing = knowledgeBase !== null
  const schema = useKnowledgeBaseSchema()

  const { data: modelsData } = useQuery({
    queryKey: ["ai-models-llm"],
    queryFn: () => api.get<PaginatedResponse<ModelOption>>("/api/v1/ai/models?type=llm&pageSize=100"),
    enabled: open,
  })
  const llmModels = modelsData?.items ?? []

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      compileModelId: undefined,
      autoCompile: false,
      crawlEnabled: false,
      crawlSchedule: "",
    },
  })

  const watchCrawlEnabled = form.watch("crawlEnabled")

  useEffect(() => {
    if (open) {
      if (knowledgeBase) {
        form.reset({
          name: knowledgeBase.name,
          description: knowledgeBase.description ?? "",
          compileModelId: knowledgeBase.compileModelId || undefined,
          autoCompile: knowledgeBase.autoCompile,
          crawlEnabled: knowledgeBase.crawlEnabled,
          crawlSchedule: knowledgeBase.crawlSchedule ?? "",
        })
      } else {
        form.reset({
          name: "",
          description: "",
          compileModelId: undefined,
          autoCompile: false,
          crawlEnabled: false,
          crawlSchedule: "",
        })
      }
    }
  }, [open, knowledgeBase, form])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/api/v1/ai/knowledge-bases", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-bases"] })
      onOpenChange(false)
      toast.success(t("ai:knowledge.createSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.put(`/api/v1/ai/knowledge-bases/${knowledgeBase!.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-bases"] })
      onOpenChange(false)
      toast.success(t("ai:knowledge.updateSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  function onSubmit(values: FormValues) {
    if (isEditing) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t("ai:knowledge.edit") : t("ai:knowledge.create")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing ? t("ai:knowledge.edit") : t("ai:knowledge.create")}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-5 px-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ai:knowledge.name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("ai:knowledge.namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ai:knowledge.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("ai:knowledge.descriptionPlaceholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compileModelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ai:knowledge.compileModel")}</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("ai:knowledge.selectCompileModel")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {llmModels.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autoCompile"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t("ai:knowledge.autoCompile")}</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="crawlEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t("ai:knowledge.crawlEnabled")}</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {watchCrawlEnabled && (
              <FormField
                control={form.control}
                name="crawlSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ai:knowledge.crawlSchedule")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("ai:knowledge.crawlSchedulePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <SheetFooter>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? t("common:saving") : isEditing ? t("common:save") : t("common:create")}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
