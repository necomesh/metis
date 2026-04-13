import { zodResolver as baseZodResolver } from "@hookform/resolvers/zod"
import type { FieldValues, Resolver } from "react-hook-form"
import type { z } from "zod"

/**
 * Typed wrapper around zodResolver for zod v4 compatibility.
 * z.coerce creates schemas where input ≠ output types,
 * which breaks react-hook-form's Resolver generic inference.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends z.ZodType<any>>(schema: T): Resolver<z.output<T> & FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return baseZodResolver(schema as any) as unknown as Resolver<z.output<T> & FieldValues>
}
