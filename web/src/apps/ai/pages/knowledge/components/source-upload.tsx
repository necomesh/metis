import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Upload, X, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"

const ACCEPTED_EXTENSIONS = [".md", ".txt", ".pdf", ".docx", ".xlsx", ".pptx"]
const ACCEPTED_MIME = [
  "text/markdown",
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
].join(",")

interface SourceUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kbId: number
  onSuccess: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SourceUpload({ open, onOpenChange, kbId, onSuccess }: SourceUploadProps) {
  const { t } = useTranslation(["ai", "common"])
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...selected.filter((f) => !existing.has(f.name))]
    })
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase()
      return ACCEPTED_EXTENSIONS.includes(ext)
    })
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...dropped.filter((f) => !existing.has(f.name))]
    })
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        const token = localStorage.getItem("metis_token")
        const res = await fetch(`/api/v1/ai/knowledge-bases/${kbId}/sources`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string }
          throw new Error(body.message ?? res.statusText)
        }
      }
      toast.success(t("ai:knowledge.sources.uploadSuccess"))
      setFiles([])
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  function handleOpenChange(val: boolean) {
    if (!uploading) {
      setFiles([])
      onOpenChange(val)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("ai:knowledge.sources.uploadFile")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("ai:knowledge.sources.uploadFile")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 px-4">
          {/* Drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer
              ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">{t("ai:knowledge.sources.dropHere")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {ACCEPTED_EXTENSIONS.join(", ")}
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_MIME}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-accent text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <SheetFooter className="px-4">
          <Button
            size="sm"
            disabled={files.length === 0 || uploading}
            onClick={handleUpload}
          >
            {uploading
              ? t("ai:knowledge.sources.uploading")
              : t("ai:knowledge.sources.uploadBtn", { count: files.length })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
