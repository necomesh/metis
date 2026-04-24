# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: service-desk-sse.spec.ts >> 服务台聊天按 AI SDK UI Message Stream 增量渲染
- Location: e2e/service-desk-sse.spec.ts:101:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/itsm/service-desk
Call log:
  - navigating to "http://127.0.0.1:3100/itsm/service-desk", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "无法访问此网站" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: 拒绝了我们的连接请求。
    - generic [ref=e10]:
      - paragraph [ref=e11]: 请试试以下办法：
      - list [ref=e12]:
        - listitem [ref=e13]: 检查网络连接
        - listitem [ref=e14]:
          - link "检查代理服务器和防火墙" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "重新加载" [ref=e19] [cursor=pointer]
    - button "详情" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  144 |             twoFactorEnabled: true,
  145 |           },
  146 |         }),
  147 |       })
  148 |       return
  149 |     }
  150 |     if (url.pathname === "/api/v1/menus/user-tree") {
  151 |       await route.fulfill({
  152 |         json: ok({
  153 |           permissions: ["itsm:service-desk:use"],
  154 |           menus: [
  155 |             {
  156 |               id: 1,
  157 |               parentId: null,
  158 |               name: "ITSM",
  159 |               type: "directory",
  160 |               path: "",
  161 |               icon: "bot",
  162 |               permission: "itsm",
  163 |               sort: 1,
  164 |               isHidden: false,
  165 |               children: [
  166 |                 {
  167 |                   id: 2,
  168 |                   parentId: 1,
  169 |                   name: "服务台",
  170 |                   type: "menu",
  171 |                   path: "/itsm/service-desk",
  172 |                   icon: "message-square",
  173 |                   permission: "itsm:service-desk:use",
  174 |                   sort: 1,
  175 |                   isHidden: false,
  176 |                   children: [],
  177 |                 },
  178 |               ],
  179 |             },
  180 |           ],
  181 |         }),
  182 |       })
  183 |       return
  184 |     }
  185 |     if (url.pathname === "/api/v1/notifications/unread-count") {
  186 |       await route.fulfill({ json: ok({ count: 0 }) })
  187 |       return
  188 |     }
  189 |     if (url.pathname === "/api/v1/itsm/smart-staffing/config") {
  190 |       await route.fulfill({
  191 |         json: ok({
  192 |           posts: {
  193 |             intake: { agentId: 10, agentName: "IT 服务台智能体" },
  194 |             decision: { agentId: 0, agentName: "", mode: "manual" },
  195 |             slaAssurance: { agentId: 0, agentName: "" },
  196 |           },
  197 |           health: { items: [] },
  198 |         }),
  199 |       })
  200 |       return
  201 |     }
  202 |     if (url.pathname === "/api/v1/ai/sessions" && request.method() === "GET") {
  203 |       await route.fulfill({ json: ok({ items: [], total: 0 }) })
  204 |       return
  205 |     }
  206 |     if (url.pathname === "/api/v1/ai/sessions" && request.method() === "POST") {
  207 |       await route.fulfill({
  208 |         json: ok({
  209 |           id: 101,
  210 |           agentId: 10,
  211 |           userId: 1,
  212 |           status: "completed",
  213 |           title: "服务台会话",
  214 |           pinned: false,
  215 |           createdAt: "2026-04-24T06:00:00Z",
  216 |           updatedAt: "2026-04-24T06:00:00Z",
  217 |         }),
  218 |       })
  219 |       return
  220 |     }
  221 |     if (url.pathname === "/api/v1/ai/sessions/101") {
  222 |       await route.fulfill({
  223 |         json: ok({
  224 |           session: {
  225 |             id: 101,
  226 |             agentId: 10,
  227 |             userId: 1,
  228 |             status: "completed",
  229 |             title: "服务台会话",
  230 |             pinned: false,
  231 |             createdAt: "2026-04-24T06:00:00Z",
  232 |             updatedAt: "2026-04-24T06:00:00Z",
  233 |           },
  234 |           messages: [],
  235 |         }),
  236 |       })
  237 |       return
  238 |     }
  239 | 
  240 |     await route.fulfill({ json: ok(null) })
  241 |   })
  242 | 
  243 |   try {
> 244 |     await page.goto("/itsm/service-desk")
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/itsm/service-desk
  245 |     await page.getByPlaceholder("描述你的 IT 诉求...").fill("我想申请 VPN，线上支持用\n\nadmin\npassword")
  246 |     await page.keyboard.press("Enter")
  247 | 
  248 |     await expect(page.getByText("正在")).toBeVisible()
  249 |     await expect(page.getByText("正在为你准备 VPN 申请草稿")).toHaveCount(0, { timeout: 80 })
  250 | 
  251 |     const toolActivity = page.getByTestId("chat-tool-activity")
  252 |     await expect(toolActivity).toHaveAttribute("data-status", "running")
  253 |     await expect(toolActivity).toHaveAttribute("data-status", "completed")
  254 | 
  255 |     await expect(page.getByTestId("itsm-draft-form-surface")).toBeVisible()
  256 |     await expect(page.getByText("VPN 账号")).toBeVisible()
  257 |     await expect(page.getByText("正在为你准备 VPN 申请草稿")).toHaveCount(0)
  258 |   } finally {
  259 |     await streamServer.close()
  260 |   }
  261 | })
  262 | 
```