import { describe, expect, test } from "bun:test"

import {
  createServiceDeskWorkspaceActions,
  recoverInitialPromptDraft,
} from "./service-desk-behavior"

describe("service desk page behavior", () => {
  test("recovers the initial prompt draft inside the created session after auto-send fails", () => {
    const image = { file: new File(["x"], "vpn.png", { type: "image/png" }), preview: "data:image/png;base64,x" }
    const images = [image]

    const draft = recoverInitialPromptDraft("我想申请 VPN", images)

    expect(draft.input).toBe("我想申请 VPN")
    expect(draft.images).toEqual([image])
    expect(draft.images).not.toBe(images)
  })

  test("exposes retry and continue actions for service desk stream failures", () => {
    const calls: string[] = []
    const actions = createServiceDeskWorkspaceActions({
      regenerate: () => calls.push("regenerate"),
      clearError: () => calls.push("clearError"),
      continueGeneration: () => calls.push("continueGeneration"),
      cancel: () => calls.push("cancel"),
    })

    actions.retry?.()
    actions.continueGeneration?.()
    actions.cancel?.()

    expect(calls).toEqual(["clearError", "regenerate", "continueGeneration", "cancel"])
  })
})
