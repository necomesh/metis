import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, ChevronRight, Code, Globe, Loader2, Plus, Search, Settings2, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export interface BindingItem {
  id: number
  name: string
  displayName?: string
  description?: string
  isExecutable?: boolean
  availabilityStatus?: string
  availabilityReason?: string
}

export interface BindingGroup {
  key: string
  id?: number
  title: string
  description: string
  items: BindingItem[]
}

interface BindingSelectorSectionProps {
  title: string
  description: string
  groups?: BindingGroup[]
  items?: BindingItem[]
  isLoading: boolean
  value: number[]
  onChange: (ids: number[]) => void
  groupValues?: Record<string, number[]>
  onGroupItemsChange?: (group: BindingGroup, ids: number[]) => void
  sheetTitle?: string
  sheetDescription?: string
  emphasize?: boolean
  selectionMode?: "default" | "group-first"
  groupFirstLabels?: {
    selectedGroupCount: (count: number) => string
    manageGroups: string
    sheetTitle: string
    emptyTitle: string
    emptyHint: string
    availableCount: (count: number) => string
    unavailableCount: (count: number) => string
  }
}

interface ResolvedBindingItem {
  id: number
  name: string
  description?: string
  isDisabled?: boolean
  disabledReason?: string
  availabilityStatus?: string
}

interface ResolvedBindingGroup {
  key: string
  id?: number
  title: string
  description: string
  items: ResolvedBindingItem[]
}

const TOOLKIT_ICONS: Record<string, React.ElementType> = {
  knowledge: BookOpen,
  network: Globe,
  code: Code,
}

export function BindingSelectorSection({
  title,
  description,
  groups,
  items,
  isLoading,
  value,
  onChange,
  groupValues,
  onGroupItemsChange,
  sheetTitle,
  sheetDescription,
  emphasize = false,
  selectionMode = "default",
  groupFirstLabels,
}: BindingSelectorSectionProps) {
  const { t } = useTranslation(["ai", "common"])
  const [open, setOpen] = useState(false)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [sheetMode, setSheetMode] = useState<"add" | "configure">("add")
  const [query, setQuery] = useState("")

  const resolvedItems = useMemo<ResolvedBindingItem[]>(() => {
    return (items ?? []).map((item) => ({
      id: item.id,
      name: t(`ai:tools.toolDefs.${item.name}.name`, { defaultValue: item.displayName || item.name }),
      description: item.description
        ? t(`ai:tools.toolDefs.${item.name}.description`, { defaultValue: item.description })
        : undefined,
      isDisabled: item.isExecutable === false,
      disabledReason: item.availabilityReason,
      availabilityStatus: item.availabilityStatus,
    }))
  }, [items, t])

  const resolvedGroups = useMemo<ResolvedBindingGroup[]>(() => {
    return (groups ?? []).map((group) => ({
      key: group.key,
      id: group.id,
      title: group.title,
      description: group.description,
      items: group.items.map((item) => ({
        id: item.id,
        name: t(`ai:tools.toolDefs.${item.name}.name`, { defaultValue: item.displayName || item.name }),
        description: item.description
          ? t(`ai:tools.toolDefs.${item.name}.description`, { defaultValue: item.description })
          : undefined,
        isDisabled: item.isExecutable === false,
        disabledReason: item.availabilityReason,
        availabilityStatus: item.availabilityStatus,
      })),
    }))
  }, [groups, t])

  const selectedItems = useMemo(() => {
    const source = resolvedGroups.length > 0 ? resolvedGroups.flatMap((group) => group.items) : resolvedItems
    return source.filter((item) => value.includes(item.id))
  }, [resolvedGroups, resolvedItems, value])

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return resolvedItems
    return resolvedItems.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(trimmed))
  }, [query, resolvedItems])

  const filteredGroups = useMemo(() => {
    const sourceGroups = activeGroupKey
      ? resolvedGroups.filter((group) => group.key === activeGroupKey)
      : resolvedGroups
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return sourceGroups
    return sourceGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(trimmed)),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeGroupKey, query, resolvedGroups])

  const activeResolvedGroup = useMemo(() => {
    if (!activeGroupKey) return undefined
    return resolvedGroups.find((group) => group.key === activeGroupKey)
  }, [activeGroupKey, resolvedGroups])

  const activeOriginalGroup = useMemo(() => {
    if (!activeGroupKey) return undefined
    return (groups ?? []).find((group) => group.key === activeGroupKey)
  }, [activeGroupKey, groups])

  const selectedGroups = resolvedGroups
    .map((group) => ({
      group,
      selectedIDs: selectedIDsForGroup(group),
    }))
    .filter(({ selectedIDs }) => selectedIDs.length > 0)

  const groupFirstMode = selectionMode === "group-first" && resolvedGroups.length > 0
  const groupLabels = groupFirstLabels ?? {
    selectedGroupCount: (count: number) => t("ai:agents.selectedToolSetCount", { count }),
    manageGroups: t("ai:agents.addToolSet"),
    sheetTitle: t("ai:agents.selectToolSet"),
    emptyTitle: t("ai:agents.noToolSetsSelected"),
    emptyHint: t("ai:agents.addToolSetHint"),
    availableCount: (count: number) => t("ai:agents.availableToolCount", { count }),
    unavailableCount: (count: number) => t("ai:agents.unavailableToolCount", { count }),
  }

  function selectedIDsForGroup(group: ResolvedBindingGroup) {
    return groupValues?.[group.key] ?? group.items.filter((item) => value.includes(item.id)).map((item) => item.id)
  }

  function executableIDsForGroup(group: ResolvedBindingGroup) {
    return group.items.filter((item) => !item.isDisabled).map((item) => item.id)
  }

  function originalGroupForKey(groupKey: string) {
    return (groups ?? []).find((group) => group.key === groupKey)
  }

  function toggleGroupSelection(group: ResolvedBindingGroup) {
    const originalGroup = originalGroupForKey(group.key)
    if (!originalGroup) return
    const selectedIDs = selectedIDsForGroup(group)
    const groupItemIDs = group.items.map((item) => item.id)

    if (selectedIDs.length > 0) {
      onChange(value.filter((itemId) => !groupItemIDs.includes(itemId)))
      onGroupItemsChange?.(originalGroup, [])
      return
    }

    const nextSelectedIDs = executableIDsForGroup(group)
    if (nextSelectedIDs.length === 0) return
    const nextFlat = [...value.filter((itemId) => !groupItemIDs.includes(itemId)), ...nextSelectedIDs]
    onChange(Array.from(new Set(nextFlat)))
    onGroupItemsChange?.(originalGroup, nextSelectedIDs)
  }

  function toggle(id: number) {
    if (activeResolvedGroup) {
      const target = activeResolvedGroup.items.find((item) => item.id === id)
      if (target?.isDisabled) return
      const current = selectedIDsForGroup(activeResolvedGroup)
      const next = current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
      const groupItemIDs = activeResolvedGroup.items.map((item) => item.id)
      const nextFlat = [...value.filter((itemId) => !groupItemIDs.includes(itemId)), ...next]
      onChange(Array.from(new Set(nextFlat)))
      if (activeOriginalGroup) {
        onGroupItemsChange?.(activeOriginalGroup, next)
      }
      return
    }
    const target = resolvedItems.find((item) => item.id === id)
    if (target?.isDisabled) return
    if (value.includes(id)) {
      onChange(value.filter((itemId) => itemId !== id))
      return
    }
    onChange([...value, id])
  }

  function clearSelection() {
    if (activeResolvedGroup) {
      const groupItemIDs = activeResolvedGroup.items.map((item) => item.id)
      onChange(value.filter((itemId) => !groupItemIDs.includes(itemId)))
      if (activeOriginalGroup) {
        onGroupItemsChange?.(activeOriginalGroup, [])
      }
      return
    }
    onChange([])
  }

  function openGroup(groupKey: string) {
    setActiveGroupKey(groupKey)
    setSheetMode("configure")
    setQuery("")
    setOpen(true)
  }

  function openGroupGallery() {
    setActiveGroupKey(null)
    setSheetMode("add")
    setQuery("")
    setOpen(true)
  }

  const filteredGalleryGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return resolvedGroups
    return resolvedGroups.filter((group) => `${group.title} ${group.description}`.toLowerCase().includes(trimmed))
  }, [query, resolvedGroups])

  if (groupFirstMode) {
    return (
      <>
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <Badge variant={selectedGroups.length > 0 ? "default" : "outline"}>
                  {groupLabels.selectedGroupCount(selectedGroups.length)}
                </Badge>
                <Badge variant={value.length > 0 ? "secondary" : "outline"}>
                  {t("ai:agents.selectedCount", { count: value.length })}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openGroupGallery} className="shrink-0">
              <Plus className="size-4" />
              {groupLabels.manageGroups}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex min-h-24 items-center justify-center rounded-[1rem] border border-dashed border-border/55 bg-background/20">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : selectedGroups.length === 0 ? (
            <button
              type="button"
              onClick={openGroupGallery}
              className="flex min-h-28 w-full items-center justify-center rounded-[1rem] border border-dashed border-border/55 bg-background/25 px-4 text-center transition-colors hover:border-border/90 hover:bg-accent/20"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{groupLabels.emptyTitle}</p>
                <p className="text-xs leading-5 text-muted-foreground">{groupLabels.emptyHint}</p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {selectedGroups.map(({ group, selectedIDs }) => {
                const selected = group.items.filter((item) => selectedIDs.includes(item.id))
                const Icon = TOOLKIT_ICONS[group.key] ?? Wrench
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => openGroup(group.key)}
                    className="group flex min-h-36 w-full flex-col rounded-[1rem] border border-border/60 bg-background/30 p-4 text-left transition-colors hover:border-border/90 hover:bg-accent/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-background/70 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{group.title}</p>
                            <Badge variant="default" className="shrink-0">
                              {selected.length}/{group.items.length}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{group.description}</p>
                        </div>
                      </div>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors group-hover:text-foreground">
                        <Settings2 className="size-4" />
                      </span>
                    </div>
                    <div className="mt-auto border-t border-border/45 pt-3">
                      <div className="flex min-h-7 flex-wrap gap-2">
                        {selected.slice(0, 4).map((item) => (
                          <Badge key={item.id} variant="outline" className="max-w-full truncate">
                            {item.name}
                          </Badge>
                        ))}
                        {selected.length > 4 && <Badge variant="secondary">+{selected.length - 4}</Badge>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <Sheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) {
              setActiveGroupKey(null)
              setSheetMode("add")
              setQuery("")
            }
          }}
        >
          <SheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
            <SheetHeader className="border-b border-border/50 pb-4">
              <SheetTitle>
                {sheetMode === "configure" && activeResolvedGroup ? activeResolvedGroup.title : groupLabels.sheetTitle}
              </SheetTitle>
              <SheetDescription>
                {sheetMode === "configure" && activeResolvedGroup ? activeResolvedGroup.description : sheetDescription || description}
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common:search")}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                />
              </div>

              {sheetMode === "configure" && activeResolvedGroup ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/55 bg-background/30 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{t("ai:agents.currentSelection")}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {t("ai:agents.selectedCount", { count: selectedIDsForGroup(activeResolvedGroup).length })}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        disabled={selectedIDsForGroup(activeResolvedGroup).length === 0}
                      >
                        {t("ai:agents.clearSelection")}
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {filteredGroups.length === 0 ? (
                      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-border/55 bg-background/20 px-6 text-center">
                        <p className="text-sm font-medium text-foreground">{t("ai:agents.noMatchingItems")}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{t("ai:agents.noItemsHint")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredGroups[0]?.items.map((item) => {
                          const checked = selectedIDsForGroup(activeResolvedGroup).includes(item.id)
                          const disabled = item.isDisabled
                          return (
                            <label
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 rounded-[1rem] border px-4 py-3 transition-colors",
                                disabled ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-70" : "cursor-pointer hover:border-border/90 hover:bg-accent/24",
                                checked ? "border-primary/30 bg-primary/[0.06]" : "border-border/55 bg-background/42"
                              )}
                            >
                              <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                                  {checked ? (
                                    <Badge variant="default">{t("ai:agents.selected")}</Badge>
                                  ) : disabled && item.availabilityStatus ? (
                                    <Badge variant="outline">{t(`ai:tools.builtin.availability.${item.availabilityStatus}`)}</Badge>
                                  ) : null}
                                </div>
                                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {item.description || t("ai:agents.noItemDescription")}
                                </p>
                                {disabled && item.disabledReason && (
                                  <p className="text-xs leading-5 text-muted-foreground">{item.disabledReason}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {filteredGalleryGroups.length === 0 ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-border/55 bg-background/20 px-6 text-center">
                      <p className="text-sm font-medium text-foreground">{t("ai:agents.noMatchingItems")}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{t("ai:agents.noItemsHint")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredGalleryGroups.map((group) => {
                        const Icon = TOOLKIT_ICONS[group.key] ?? Wrench
                        const selectedCount = selectedIDsForGroup(group).length
                        const availableCount = group.items.filter((item) => !item.isDisabled).length
                        const unavailableCount = group.items.length - availableCount
                        const selected = selectedCount > 0
                        const disabled = availableCount === 0
                        return (
                          <div
                            key={group.key}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            onClick={() => {
                              if (!disabled) toggleGroupSelection(group)
                            }}
                            onKeyDown={(event) => {
                              if (disabled) return
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                toggleGroupSelection(group)
                              }
                            }}
                            className={cn(
                              "group flex w-full flex-col gap-3 rounded-[1rem] border px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between",
                              selected ? "border-primary/30 bg-primary/[0.06]" : "border-border/60 bg-background/30",
                              disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-border/90 hover:bg-accent/20"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Checkbox
                                checked={selected}
                                disabled={disabled}
                                onClick={(event) => event.stopPropagation()}
                                onCheckedChange={() => toggleGroupSelection(group)}
                                className="shrink-0"
                              />
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-background/70 text-primary">
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-semibold text-foreground">{group.title}</p>
                                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-1">{group.description}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                              <Badge variant={selectedCount > 0 ? "default" : "outline"}>
                                {t("ai:agents.selectedCount", { count: selectedCount })}
                              </Badge>
                              <Badge variant="secondary">{groupLabels.availableCount(availableCount)}</Badge>
                              {unavailableCount > 0 && (
                                <Badge variant="outline">{groupLabels.unavailableCount(unavailableCount)}</Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <SheetFooter className="px-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common:close")}
              </Button>
              {sheetMode === "configure" && activeResolvedGroup && (
                <Button type="button" onClick={() => setOpen(false)}>
                  {t("common:confirm")}
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <Badge variant={value.length > 0 ? "default" : "outline"}>
                {t("ai:agents.selectedCount", { count: value.length })}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {resolvedGroups.length === 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="shrink-0">
              {t("ai:agents.manageSelection")}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex min-h-24 items-center justify-center rounded-[1rem] border border-dashed border-border/55 bg-background/20">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : resolvedGroups.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {resolvedGroups.map((group) => {
              const groupSelectedIDs = selectedIDsForGroup(group)
              const groupSelected = group.items.filter((item) => groupSelectedIDs.includes(item.id))
              const Icon = TOOLKIT_ICONS[group.key] ?? Wrench
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    setActiveGroupKey(group.key)
                    setOpen(true)
                  }}
                  className={cn(
                    "group rounded-[1.1rem] border border-border/60 bg-background/30 px-4 py-4 text-left transition-colors hover:border-border/90 hover:bg-accent/20",
                    emphasize && "first:border-primary/25 first:bg-primary/[0.035]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-background/70 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{group.title}</p>
                          <Badge variant={groupSelected.length > 0 ? "default" : "outline"}>
                            {groupSelected.length}/{group.items.length}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{group.description}</p>
                      </div>
                    </div>
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors group-hover:text-foreground">
                      <ChevronRight className="size-4" />
                    </span>
                  </div>

                  <div className="mt-4 border-t border-border/45 pt-4">
                    {groupSelected.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("ai:agents.clickToSelect")}</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {groupSelected.slice(0, 4).map((item) => (
                            <Badge key={item.id} variant="outline">
                              {item.name}
                            </Badge>
                          ))}
                          {groupSelected.length > 4 && <Badge variant="secondary">+{groupSelected.length - 4}</Badge>}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {groupSelected[0]?.description || t("ai:agents.manageInSheet")}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setActiveGroupKey(null)
              setOpen(true)
            }}
            className={cn(
              "group w-full rounded-[1.1rem] border border-border/60 bg-background/30 px-4 py-4 text-left transition-colors hover:border-border/90 hover:bg-accent/20",
              emphasize && "border-primary/25 bg-primary/[0.04]"
            )}
          >
            {selectedItems.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center rounded-[0.9rem] border border-dashed border-border/55 bg-background/25 text-center">
                <p className="text-sm text-muted-foreground">{t("ai:agents.clickToSelect")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {selectedItems.slice(0, 5).map((item) => (
                    <Badge key={item.id} variant="outline">
                      {item.name}
                    </Badge>
                  ))}
                  {selectedItems.length > 5 && <Badge variant="secondary">+{selectedItems.length - 5}</Badge>}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {selectedItems[0]?.description || t("ai:agents.manageInSheet")}
                </p>
              </div>
            )}
          </button>
        )}
      </section>

      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setActiveGroupKey(null)
            setQuery("")
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader className="border-b border-border/50 pb-4">
            <SheetTitle>{activeResolvedGroup?.title || sheetTitle || title}</SheetTitle>
            <SheetDescription>{activeResolvedGroup?.description || sheetDescription || description}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common:search")}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/55 bg-background/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{t("ai:agents.currentSelection")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("ai:agents.selectedCount", {
                    count: activeResolvedGroup ? selectedIDsForGroup(activeResolvedGroup).length : value.length,
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={activeResolvedGroup ? selectedIDsForGroup(activeResolvedGroup).length === 0 : value.length === 0}
              >
                {t("ai:agents.clearSelection")}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex h-full min-h-48 items-center justify-center rounded-[1rem] border border-dashed border-border/55 bg-background/20">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : resolvedGroups.length > 0 ? (
                <div className="space-y-6">
                  {filteredGroups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{group.title}</h4>
                        <p className="text-xs leading-5 text-muted-foreground">{group.description}</p>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((item) => {
                          const checked = selectedIDsForGroup(group).includes(item.id)
                          const disabled = item.isDisabled
                          return (
                            <label
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 rounded-[1rem] border px-4 py-3 transition-colors",
                                disabled ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-70" : "cursor-pointer hover:border-border/90 hover:bg-accent/24",
                                checked ? "border-primary/30 bg-primary/[0.06]" : "border-border/55 bg-background/42"
                              )}
                            >
                              <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                                  {checked ? (
                                    <Badge variant="default">{t("ai:agents.selected")}</Badge>
                                  ) : disabled && item.availabilityStatus ? (
                                    <Badge variant="outline">{t(`ai:tools.builtin.availability.${item.availabilityStatus}`)}</Badge>
                                  ) : null}
                                </div>
                                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {item.description || t("ai:agents.noItemDescription")}
                                </p>
                                {disabled && item.disabledReason && (
                                  <p className="text-xs leading-5 text-muted-foreground">{item.disabledReason}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-border/55 bg-background/20 px-6 text-center">
                  <p className="text-sm font-medium text-foreground">{t("ai:agents.noMatchingItems")}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{t("ai:agents.noItemsHint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => {
                    const checked = value.includes(item.id)
                    const disabled = item.isDisabled
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          "flex items-start gap-3 rounded-[1rem] border px-4 py-3 transition-colors",
                          disabled ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-70" : "cursor-pointer hover:border-border/90 hover:bg-accent/24",
                          checked ? "border-primary/30 bg-primary/[0.06]" : "border-border/55 bg-background/42"
                        )}
                      >
                        <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                            {checked ? (
                              <Badge variant="default">{t("ai:agents.selected")}</Badge>
                            ) : disabled && item.availabilityStatus ? (
                              <Badge variant="outline">{t(`ai:tools.builtin.availability.${item.availabilityStatus}`)}</Badge>
                            ) : null}
                          </div>
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.description || t("ai:agents.noItemDescription")}
                          </p>
                          {disabled && item.disabledReason && (
                            <p className="text-xs leading-5 text-muted-foreground">{item.disabledReason}</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="px-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common:close")}
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              {t("common:confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
