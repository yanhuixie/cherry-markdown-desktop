/**
 * Makes all properties in T optional recursively, with special handling for functions.
 * This utility type preserves function signatures while making them optional.
 */
export type Optional<T> = {
  [K in keyof T]?: T[K] extends (...args: unknown[]) => unknown
    ? T[K] // Preserve function types as-is
    : T[K] extends object
      ? Optional<T[K]>
      : T[K];
};
