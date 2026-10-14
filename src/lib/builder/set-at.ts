/**
 * A copy of `value` with the field at `path` replaced: `setAt(config, ["sections", 0, "items", 2, "price"], "$12")`.
 * Objects and arrays along the way are copied, nothing else is touched; a missing object or array on the way is
 * created (an array when the next key is a number).
 */
export function setAt<T>(value: T, path: Array<string | number>, next: unknown): T {
  if (path.length === 0) return next as T;
  const [key, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[key as number] = setAt(copy[key as number], rest, next);
    return copy as T;
  }
  const source = (value ?? {}) as Record<string | number, unknown>;
  const child = source[key] ?? (typeof rest[0] === "number" ? [] : {});
  return { ...source, [key]: setAt(child, rest, next) } as T;
}
