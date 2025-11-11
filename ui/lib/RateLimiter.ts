/**
 * RateLimiter.ts
 * 
 * Client-side rate limiting for sensitive operations
 */

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitRecord {
  attempts: number[];
  blockedUntil?: number;
}

class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();

  /**
   * Check if an operation is allowed
   */
  public isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const record = this.getOrCreateRecord(key);

    // Check if currently blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      return false;
    }

    // Clear block if expired
    if (record.blockedUntil && now >= record.blockedUntil) {
      record.blockedUntil = undefined;
    }

    // Remove attempts outside the time window
    record.attempts = record.attempts.filter(
      (timestamp) => now - timestamp < config.windowMs
    );

    // Check if limit exceeded
    if (record.attempts.length >= config.maxAttempts) {
      // Block for configured duration
      if (config.blockDurationMs) {
        record.blockedUntil = now + config.blockDurationMs;
      }
      return false;
    }

    // Record this attempt
    record.attempts.push(now);
    return true;
  }

  /**
   * Get remaining attempts
   */
  public getRemainingAttempts(key: string, config: RateLimitConfig): number {
    const record = this.getOrCreateRecord(key);
    const now = Date.now();

    // Filter valid attempts
    const validAttempts = record.attempts.filter(
      (timestamp) => now - timestamp < config.windowMs
    );

    return Math.max(0, config.maxAttempts - validAttempts.length);
  }

  /**
   * Get time until unblocked (in ms)
   */
  public getTimeUntilUnblocked(key: string): number {
    const record = this.records.get(key);
    if (!record || !record.blockedUntil) {
      return 0;
    }

    return Math.max(0, record.blockedUntil - Date.now());
  }

  /**
   * Reset rate limit for a key
   */
  public reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clear all rate limits
   */
  public clearAll(): void {
    this.records.clear();
  }

  private getOrCreateRecord(key: string): RateLimitRecord {
    if (!this.records.has(key)) {
      this.records.set(key, { attempts: [] });
    }
    return this.records.get(key)!;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Common rate limit configurations
export const RateLimitConfigs = {
  // Authentication attempts: 5 attempts per 15 minutes, block for 30 minutes
  AUTH: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  
  // Proof generation: 10 per hour
  PROOF_GENERATION: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  },
  
  // Proof verification: 50 per hour
  PROOF_VERIFICATION: {
    maxAttempts: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 10 * 60 * 1000, // 10 minutes
  },
  
  // Account deletion: 3 attempts per day, block for 24 hours
  ACCOUNT_DELETION: {
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    blockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Data export: 20 per hour
  DATA_EXPORT: {
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Format remaining time in human-readable format
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}
