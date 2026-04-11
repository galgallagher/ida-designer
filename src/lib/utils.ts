import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — class name utility.
 *
 * Combines clsx (conditional class logic) with tailwind-merge (deduplicates
 * conflicting Tailwind classes). Used by all shadcn/ui generated components.
 *
 * Example:
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
