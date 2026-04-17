# DESIGN.md

Frontend UI/UX design patterns and conventions for Metis.

## Information Architecture

### Two-Layer Pattern (List → Detail)

Use when an entity has sub-entities or multiple management actions:

```
L1: 列表页 (卡片网格 or 表格)
  职责: 总览、状态一览、快速创建、导航

L2: 详情页 (/path/:id)
  职责: 单个实体的完整管理工作区
```

**Decision criteria:**
- Sub-entities to manage (e.g., models under a provider) → detail page
- Simple CRUD only → table + drawer is sufficient
- Entity count < 20 + rich visual identity → card grid for L1
- Entity count > 20 or comparison-heavy → table for L1

### Operation Placement (Progressive Disclosure)

```
高频操作 → 常驻可见 (卡片底部 / 详情页顶部按钮)
中频操作 → 次要按钮 (outline variant)
低频操作 → 收进 ⋯ DropdownMenu
破坏性操作 → ⋯ 菜单底部, text-destructive, 需确认
```

### Form Container Convention

- **创建**: Sheet (抽屉) — 字段少、操作路径短、创建后立即可见
- **编辑**: Sheet (抽屉) 或详情页内联 — 取决于编辑后是否有后续操作流
- 统一使用 Sheet，不用 Dialog

## Card Grid Pattern

适用于实体数量少 (< 20) 且需要视觉辨识度的场景。

### Layout

```css
grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
gap: 1rem;
```

全量加载 (pageSize=100)，不分页。卡片网格下分页体验差——翻页后空间位置重排，用户失去空间记忆。

### Card Structure

```
┌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┐  ← 品牌色条 3-4px (可选)
│                                 │
│  [Avatar]  标题            ⋯   │  ← 头部: 图标 + 名称 + 菜单
│            副标题               │
│                                 │
│  统计信息 / 标签 chips          │  ← 中部: 摘要信息
│                                 │
│  ── ── ── ── ── ── ── ── ── ──│  ← border-t 分割
│  ● 状态 · 时间    [快捷操作]    │  ← 底部: 状态 + 高频操作
└─────────────────────────────────┘
```

### Interactions

```
默认:   border-border, shadow-none
Hover:  border-primary/20, shadow-md, -translate-y-0.5
Click:  navigate to detail page
Action zone: [data-action-zone] 阻止点击穿透
```

### Guide Card

当已有数据时，网格末尾放虚线引导卡片:

```
border-2 border-dashed border-muted-foreground/20 bg-muted/20
hover: border-primary/30 bg-muted/40
内容: "+" 图标 + "添加xxx" 文字
```

### Empty State

居中布局: 图标 (h-12 w-12, text-muted-foreground/40) + 标题 + 描述 + 主操作按钮

## Brand/Identity Mapping

当实体有类型区分但无 Logo 资产时，用 **色彩 + 首字母 Avatar** 方案:

```typescript
interface EntityBrand {
  stripe: string    // 顶部色条 class (bg-emerald-500)
  avatarBg: string  // Avatar 背景 + 文字色 (bg-emerald-50 text-emerald-700)
  avatarText: string // 2字母缩写 (AI)
  label: string     // 显示名
}
```

Color assignment principle: 每种类型分配一个 Tailwind 色系 (emerald/amber/sky/violet/rose...), 未知类型 fallback 到 primary。颜色是前注意加工 (pre-attentive), 识别速度远快于阅读文字。

## Status Indicator

```
● active   → green-500, animate-pulse (subtle, 2s)
● inactive → gray-400, static
● error    → red-500, animate-pulse (faster)
○ loading  → Loader2 icon, animate-spin
```

圆点尺寸 h-2 w-2, loading 时切换为 h-3.5 w-3.5 Spinner。

## Detail Page Layout

```
┌─────────────────────────────────────────────────┐
│ ← 返回    实体名称                               │  ← 导航 + 标题
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 信息区 (rounded-xl border bg-card) ────────┐│
│  │ 品牌色条                                     ││
│  │ Avatar + 名称 + 副标题      [操作按钮组]     ││
│  │ grid cols-2/4 的 description-list            ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ 子实体管理区 (rounded-xl border bg-card) ──┐│
│  │ 标题              [搜索] [添加]              ││
│  │ 分组表格 / 列表                              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└─────────────────────────────────────────────────┘
```

Back link pattern: `<Button variant="ghost" size="sm" asChild><Link to=".."><ArrowLeft /></Link></Button>`
