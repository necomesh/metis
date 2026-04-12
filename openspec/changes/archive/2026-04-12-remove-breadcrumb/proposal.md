## Why

面包屑导航在当前布局中不再需要，移除可简化 UI 层级，减少无意义的视觉噪音，并轻微收窄主内容区顶部空白。

## What Changes

- 删除 `web/src/components/layout/header.tsx`（面包屑组件，整个文件）
- 从 `dashboard-layout.tsx` 中移除 `Header` 的 import 和渲染调用

## Capabilities

### New Capabilities

无

### Modified Capabilities

无

## Impact

- `web/src/components/layout/dashboard-layout.tsx` — 移除 `<Header />` 及其 import
- `web/src/components/layout/header.tsx` — 删除文件
- 布局高度：主内容区顶部减少 `h-10`（40px）的面包屑占位
