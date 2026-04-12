## Context

面包屑（`Header` 组件）渲染在 `DashboardLayout` 的主内容区顶部，高度 40px，通过解析当前路由路径 + menuTree 拼接标签。产品决策认为此导航元素不再必要，予以移除。

## Goals / Non-Goals

**Goals:**
- 从 UI 中完全移除面包屑渲染
- 删除相关文件，消除死代码

**Non-Goals:**
- 不调整其他布局参数（TopNav、Sidebar、padding 等）
- 不引入替代导航元素

## Decisions

**直接删除 header.tsx，不保留**：组件唯一职责是渲染面包屑，无复用价值，整个文件删除。

**不修改 locales**：`header.tsx` 使用 `useTranslation("layout")`，但 `layout` namespace 可能被其他组件共用，不做清理以避免误删。

## Risks / Trade-offs

- [布局高度变化] 主内容区顶部减少 40px → 视觉上内容上移，属预期效果，无需额外补偿
