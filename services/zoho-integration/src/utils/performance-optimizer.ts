/**
 * Performance optimizer utility for managing resource usage
 */
class PerformanceOptimizer {
  private concurrencyLimit: number = 5;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests: number = 0;

  /**
   * Queue a request to be executed when resources are available
   * @param requestFn Function that returns a promise
   * @returns Promise that resolves with the result of the request
   */
  public async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add request to queue
      this.requestQueue.push(async () => {
        try {
          this.activeRequests++;
          const result = await requestFn();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      });

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private processQueue(): void {
    // Process requests up to concurrency limit
    while (this.activeRequests < this.concurrencyLimit && this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        request().catch(() => {
          // Error is already handled in queueRequest
        });
      }
    }
  }

  /**
   * Set the concurrency limit
   * @param limit Maximum number of concurrent requests
   */
  public setConcurrencyLimit(limit: number): void {
    this.concurrencyLimit = limit;
  }

  /**
   * Get the current concurrency limit
   * @returns Current concurrency limit
   */
  public getConcurrencyLimit(): number {
    return this.concurrencyLimit;
  }

  /**
   * Get the number of active requests
   * @returns Number of active requests
   */
  public getActiveRequests(): number {
    return this.activeRequests;
  }

  /**
   * Get the number of queued requests
   * @returns Number of queued requests
   */
  public getQueuedRequests(): number {
    return this.requestQueue.length;
  }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();
export default performanceOptimizer;
