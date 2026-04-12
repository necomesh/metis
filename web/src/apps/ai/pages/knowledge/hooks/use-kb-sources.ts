import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { SourceItem } from "../types"

export function useKbSources(kbId: number) {
  return useQuery({
    queryKey: ["ai-kb-sources", kbId],
    queryFn: () => api.get<{ items: SourceItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/sources?pageSize=100`,
    ),
  })
}
