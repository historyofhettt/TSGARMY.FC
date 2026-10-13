import { storage } from "./storage";

/**
 * Resolve a set of storage keys to URLs.
 * Returns a map of key -> url. Keys that fail are simply omitted.
 */
export async function signKeys(
  keys: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter((k): k is string => !!k))];
  if (unique.length === 0) return {};
  try {
    const { urls } = await storage.getPresignedUrls({ keys: unique });
    const map: Record<string, string> = {};
    for (const u of urls) {
      if (u.key && u.url) map[u.key] = u.url;
    }
    return map;
  } catch {
    return {};
  }
}

/** Attach `photoUrl` style fields to an entity with a given key field. */
export function withUrl<T extends Record<string, unknown>>(
  entity: T,
  keyField: keyof T,
  urls: Record<string, string>,
  urlField: string,
): T & Record<string, string | null> {
  const key = entity[keyField] as string | null | undefined;
  return {
    ...entity,
    [urlField]: key ? (urls[key] ?? null) : null,
  };
}
