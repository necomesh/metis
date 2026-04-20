import type { RouteObject } from "react-router"

export interface MenuGroup {
  label: string
  items: string[]
}

export interface AppModule {
  name: string
  routes: RouteObject[]
  menuGroups?: MenuGroup[]
}

const modules: AppModule[] = []

export function registerApp(m: AppModule) {
  modules.push(m)
}

export function getAppRoutes(): RouteObject[] {
  return modules.flatMap((m) => m.routes)
}

export function getMenuGroups(appName: string): MenuGroup[] | undefined {
  return modules.find((m) => m.name === appName)?.menuGroups
}

// App module imports are in _bootstrap.ts to avoid circular dependency.
// gen-registry.sh manages _bootstrap.ts for filtered builds.
