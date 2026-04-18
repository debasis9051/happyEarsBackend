/**
 * cacheInvalidationBroadcaster.js — Real-time cache invalidation for multi-user sync
 * 
 * When one user updates data (POST /save-product, etc), this broadcaster
 * notifies ALL connected users to refetch fresh data instead of using stale cache.
 * 
 * Uses Server-Sent Events (SSE) for efficient one-way push from server to clients.
 */

class CacheInvalidationBroadcaster {
  constructor() {
    this.subscribers = new Set();
  }

  /**
   * Register a client to receive cache invalidation events (SSE).
   * @param {Response} res - Express response object
   * @param {string} clientId - Unique client identifier (optional, for debugging)
   */
  subscribe(res, clientId = null) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const subscriber = { res, clientId, connectedAt: new Date() };
    this.subscribers.add(subscriber);

    console.log(`[CacheInvalidation] Client connected: ${clientId || 'anonymous'} (total: ${this.subscribers.size})`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (e) {
        clearInterval(heartbeat);
        this.subscribers.delete(subscriber);
        console.log(`[CacheInvalidation] Client disconnected: ${clientId || 'anonymous'}`);
      }
    }, 30000);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(heartbeat);
      this.subscribers.delete(subscriber);
      console.log(`[CacheInvalidation] Client closed connection: ${clientId || 'anonymous'} (remaining: ${this.subscribers.size})`);
    });

    res.on('error', (err) => {
      clearInterval(heartbeat);
      this.subscribers.delete(subscriber);
      console.error(`[CacheInvalidation] Error on client ${clientId}:`, err.message);
    });
  }

  /**
   * Broadcast cache invalidation to ALL connected clients.
   * Called after any POST operation (save, update, delete).
   * 
   * @param {string} cacheKey - Cache key to invalidate (e.g., 'products', 'invoices', 'patients')
   * @param {string} operation - What happened (e.g., 'add', 'update', 'delete')
   * @param {object} metadata - Extra data (e.g., { product_id: '123', product_name: 'Widget' })
   */
  broadcast(cacheKey, operation, metadata = {}) {
    if (this.subscribers.size === 0) {
      console.log(`[CacheInvalidation] No subscribers connected; skipping broadcast for ${cacheKey}`);
      return;
    }

    const event = {
      cacheKey,
      operation,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const eventData = `data: ${JSON.stringify(event)}\n\n`;

    let failedCount = 0;
    const subscriberArray = Array.from(this.subscribers);

    subscriberArray.forEach((subscriber) => {
      try {
        subscriber.res.write(eventData);
      } catch (e) {
        console.error(`[CacheInvalidation] Failed to send to client: ${subscriber.clientId}`, e.message);
        failedCount++;
        this.subscribers.delete(subscriber);
      }
    });

    const successCount = subscriberArray.length - failedCount;
    console.log(`[CacheInvalidation] Broadcast: ${cacheKey}/${operation} sent to ${successCount}/${subscriberArray.length} clients`);
  }

  /**
   * Get current subscriber count (for monitoring).
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }

  /**
   * Get subscriber details (for debugging).
   */
  getSubscribers() {
    return Array.from(this.subscribers).map((sub) => ({
      clientId: sub.clientId || 'anonymous',
      connectedSince: sub.connectedAt,
    }));
  }
}

module.exports = new CacheInvalidationBroadcaster();
