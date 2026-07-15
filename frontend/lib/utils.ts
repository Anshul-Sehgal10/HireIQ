import { clsx, type ClassValue } from "clsx";

/**
 * Merges conditional className fragments. clsx is already a dependency —
 * this just gives every ui/ component one shared, consistent way to build
 * className strings instead of hand-rolling it per component.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}