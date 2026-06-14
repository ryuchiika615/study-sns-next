const cache = new Map<string, { data: any; timestamp: number }>();
const DEFAULT_TTL = 8000;

export function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < DEFAULT_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

export function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(pattern?: string) {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
