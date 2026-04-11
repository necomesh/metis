import { registerApp } from "@/apps/registry"
import { registerTranslations } from "@/i18n"
import zhCN from "./locales/zh-CN.json"
import en from "./locales/en.json"

registerTranslations("node", { "zh-CN": zhCN, en })

registerApp({
  name: "node",
  routes: [
    {
      path: "node/nodes",
      children: [
        {
          index: true,
          lazy: () => import("./pages/nodes/index"),
        },
        {
          path: ":id",
          lazy: () => import("./pages/nodes/[id]"),
        },
      ],
    },
    {
      path: "node/process-defs",
      children: [
        {
          index: true,
          lazy: () => import("./pages/process-defs/index"),
        },
      ],
    },
  ],
})
