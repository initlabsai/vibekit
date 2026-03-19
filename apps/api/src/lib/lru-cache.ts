/** Simple LRU cache using Map insertion-order semantics (no deps). */
export class LRUCache<K, V> {
  private map = new Map<K, V>()
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const val = this.map.get(key)
    if (val !== undefined) {
      // refresh position
      this.map.delete(key)
      this.map.set(key, val)
    }
    return val
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.capacity) {
      // evict oldest
      this.map.delete(this.map.keys().next().value!)
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }
}
