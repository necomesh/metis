import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

export interface NodeItem {
  id: number
  name: string
  status: string
  labels: Record<string, string> | null
  systemInfo: Record<string, unknown> | null
  version: string
  lastHeartbeat: string | null
  processCount: number
  createdAt: string
  updatedAt: string
}

function useNodeSchema() {
  const { t } = useTranslation("node")
  return z.object({
    name: z.string().min(1, t("validation.nameRequired")).max(128),
    labels: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof useNodeSchema>>

interface NodeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: NodeItem | null
  onCreated?: (token: string) => void
}

export function NodeSheet({ open, onOpenChange, node, onCreated }: NodeSheetProps) {
  const { t } = useTranslation(["node", "common"])
  const queryClient = useQueryClient()
  const isEditing = node !== null
  const schema = useNodeSchema()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", labels: "" },
  })

  useEffect(() => {
    if (open) {
      if (node) {
        form.reset({
          name: node.name,
          labels: node.labels ? JSON.stringify(node.labels, null, 2) : "",
        })
      } else {
        form.reset({ name: "", labels: "" })
      }
    }
  }, [open, node, form])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: Record<string, unknown> = { name: values.name }
      if (values.labels?.trim()) {
        body.labels = JSON.parse(values.labels)
      }
      return api.post<{ node: NodeItem; token: string }>("/api/v1/nodes", body)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      onOpenChange(false)
      toast.success(t("node:nodes.createSuccess"))
      onCreated?.(data.token)
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: Record<string, unknown> = { name: values.name }
      if (values.labels?.trim()) {
        body.labels = JSON.parse(values.labels)
      }
      return api.put(`/api/v1/nodes/${node!.id}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      queryClient.invalidateQueries({ queryKey: ["node"] })
      onOpenChange(false)
      toast.success(t("node:nodes.updateSuccess"))
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
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? t("node:nodes.editNode") : t("node:nodes.create")}</SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing ? t("node:nodes.editNode") : t("node:nodes.create")}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-5 px-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("node:nodes.nodeName")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("node:nodes.nodeNamePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="labels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("node:nodes.labels")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("node:nodes.labelsPlaceholder")}
                      rows={4}
                      className="font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
