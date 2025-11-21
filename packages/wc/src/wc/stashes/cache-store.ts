export type CachedEntry<T> = { data: T; timestamp: number };

export class CacheStore<T> {
  #ttlMs: number;
  #map: Map<string, CachedEntry<T>> = new Map();

  constructor(ttlMs: number) {
    this.#ttlMs = Math.max(0, ttlMs);
  }

  get(id: string): T | null {
    const e = this.#map.get(id);
    if (!e) return null;
    if (Date.now() - e.timestamp > this.#ttlMs) {
      this.#map.delete(id);
      return null;
    }
    return e.data;
  }

  set(id: string, data: T): void {
    this.#map.set(id, { data, timestamp: Date.now() });
  }

  has(id: string): boolean {
    return this.get(id) !== null;
  }

  clear(): void {
    this.#map.clear();
  }

  timestamp(id: string): number | undefined {
    return this.#map.get(id)?.timestamp;
  }
}

export default CacheStore;
