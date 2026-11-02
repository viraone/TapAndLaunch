/**
 * The Settings dialog sends the whole theme back on every save, but the theme also holds keys the server manages and
 * the theme schema deliberately does not accept (StageTime's `header_action`, `home_redirect` and its companions).
 * Plain zod validation drops those keys, so writing the parsed object back over the column would delete them. Keep
 * every undeclared key exactly as it is and lay the validated incoming keys over it. A declared key left out of
 * `incoming` is removed, so clearing a field still works. Neither input is changed.
 */
export function mergeThemeUpdate(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
  declaredKeys: readonly string[]
): Record<string, unknown> {
  const declared = new Set(declaredKeys);
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current ?? {})) {
    if (!declared.has(key)) kept[key] = value;
  }
  return { ...kept, ...incoming };
}
