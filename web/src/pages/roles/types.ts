export type DataScope = "all" | "dept_and_sub" | "dept" | "self" | "custom"

export interface Role {
  id: number
  name: string
  code: string
  description: string
  sort: number
  isSystem: boolean
  dataScope: DataScope
  deptIds: number[]
  createdAt: string
  updatedAt: string
}
