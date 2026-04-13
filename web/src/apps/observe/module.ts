import { registerApp } from "@/apps/registry"
import { registerTranslations } from "@/i18n"
import zhCN from "./locales/zh-CN.json"
import en from "./locales/en.json"

registerTranslations("observe", { "zh-CN": zhCN, en })

registerApp({
  name: "observe",
  routes: [
    {
      path: "observe/integrations",
      children: [
        {
          index: true,
          lazy: () => import("./pages/integrations/index"),
        },
        {
          path: ":slug",
          lazy: () => import("./pages/integrations/[slug]"),
        },
      ],
    },
    {
      path: "observe/tokens",
      children: [
        {
          index: true,
          lazy: () => import("./pages/tokens/index"),
        },
      ],
    },
  ],
})
