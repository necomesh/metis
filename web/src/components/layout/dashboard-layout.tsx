import { Outlet, useLocation } from "react-router"
import { TopNav } from "./top-nav"
import { Sidebar } from "./sidebar"
import { useUiStore } from "@/stores/ui"
import { cn } from "@/lib/utils"

export function DashboardLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const location = useLocation()

  // Chat and service desk use fixed-height shells with internal scroll regions.
  const isFullHeightWorkspaceRoute = /^\/ai\/chat(?:\/\d+)?$/.test(location.pathname)
    || location.pathname === "/itsm/service-desk"

  return (
    <div className="workspace-shell-bg min-h-screen">
      <TopNav />
      <Sidebar />
      <main
        className={cn(
          "pt-14 transition-all duration-200",
          collapsed ? "pl-12" : "pl-52",
          isFullHeightWorkspaceRoute && "h-screen overflow-hidden",
        )}
      >
        <div className={cn(
          "flex h-full flex-col",
          !isFullHeightWorkspaceRoute && "p-4 sm:p-5 lg:p-6",
        )}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
