import NodeCache from "node-cache";
const repricerCache = new NodeCache({ stdTTL: 0 });

export function Set(key: string, value: any): void {
  repricerCache.set(key, value);
}

export function Has(key: string): boolean {
  if (key) {
    return repricerCache.has(key);
  } else return false;
}

export function Get(key: string): any {
  if (key) {
    return repricerCache.get(key);
  }
  return null;
}

export function GetAllCache(): string[] {
  return repricerCache.keys();
}

export function DeleteCacheByKey(key: string): number | string {
  if (key) {
    return repricerCache.del(key);
  }
  return "";
}

export function FlushCache(): void {
  repricerCache.flushAll();
}

export function Override(key: string, value: any): void {
  if (key) {
    if (repricerCache.has(key)) {
      repricerCache.del(key);
    }
    repricerCache.set(key, value);
  }
}
