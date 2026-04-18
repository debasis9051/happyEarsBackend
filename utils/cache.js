/**
 * Backend in-memory cache utility with Time-To-Live (TTL) expiration.
 *
 * Usage:
 *   cache.set('branch-list', branchData, 300)  // Cache for 5 mins
 *   const data = cache.get('branch-list')       // Retrieve (auto-returns null if expired)
 *   cache.invalidate('branch-list')             // Manual invalidation
 *
 * Automatically cleans up expired entries on access. Perfect for reducing
 * repeated Firestore reads during development and production.
 */

class MemoryCache {
  constructor() {
    // Keep internal containers defined so legacy invalidation calls are safe,
    // even though caching behavior is intentionally disabled.
    this.store = new Map();
    this.timers = new Map();
  }

  /**
   * Set a value in cache with optional TTL (seconds).
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time-to-live in seconds (default: 300 = 5 mins)
   */
  set(key, value, ttlSeconds = 300) {
    // Clear existing timer if re-setting a key
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
    // Auto-evict on expiry to prevent memory leaks
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);
    // Allow Node.js to exit even if the timer is still pending
    if (timer.unref) timer.unref();
    this.timers.set(key, timer);
  }

  /**
   * Get a value from cache if it exists and hasn't expired.
   * @param {string} key - Cache key
   * @returns {*} Cached value, or null if not found or expired
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.invalidate(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Manually invalidate a cache entry.
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.store.delete(key);
  }

  /**
   * Invalidate all keys that start with the given prefix.
   * Exists for compatibility with existing call sites.
   */
  invalidateMatching(prefix) {
    const safePrefix = typeof prefix === 'string' ? prefix : '';
    for (const key of this.store.keys()) {
      if (!safePrefix || key.startsWith(safePrefix)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    for (const key of this.store.keys()) {
      this.invalidate(key);
    }
  }

  /**
   * Get cache statistics (for monitoring/debugging).
   */
  stats() {
    const now = Date.now();
    const entries = [];
    for (const [key, entry] of this.store.entries()) {
      entries.push({ key, ttlRemainingMs: Math.max(0, entry.expiresAt - now) });
    }
    return { count: entries.length, entries };
  }
}

// Export singleton instance
module.exports = new MemoryCache();
