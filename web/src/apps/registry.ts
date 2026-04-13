import type { RouteObject } from "react-router"

export interface AppModule {
  name: string
  routes: RouteObject[]
}

const modules: AppModule[] = []

export function registerApp(m: AppModule) {
  modules.push(m)
}

export function getAppRoutes(): RouteObject[] {
  return modules.flatMap((m) => m.routes)
}

// App module imports are in _bootstrap.ts to avoid circular dependency.
// gen-registry.sh manages _bootstrap.ts for filtered builds.
