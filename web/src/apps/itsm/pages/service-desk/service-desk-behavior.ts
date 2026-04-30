export function recoverInitialPromptDraft<TImage>(
  initialPrompt: string | undefined,
  initialImages: readonly TImage[] | undefined,
) {
  return {
    input: initialPrompt ?? "",
    images: [...(initialImages ?? [])],
  }
}

export function createServiceDeskWorkspaceActions({
  regenerate,
  clearError,
  continueGeneration,
  cancel,
}: {
  regenerate: () => void
  clearError: () => void
  continueGeneration: () => void
  cancel: () => void
}): {
  regenerate: () => void
  retry: () => void
  continueGeneration: () => void
  cancel: () => void
} {
  return {
    regenerate,
    retry: () => {
      clearError()
      regenerate()
    },
    continueGeneration,
    cancel,
  }
}
