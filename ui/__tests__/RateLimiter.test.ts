/**
 * RateLimiter.test.ts
 * 
 * Unit tests for rate limiting functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimiter, RateLimitConfigs } from '../lib/RateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset rate limiter before each test
    rateLimiter.reset('test_key');
  });

  describe('isAllowed', () => {
    it('should allow requests within rate limit', () => {
      const config = { maxAttempts: 3, windowMs: 60000 };
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
    });

    it('should block requests after exceeding rate limit', () => {
      const config = { maxAttempts: 2, windowMs: 60000 };
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(false);
    });

    it('should reset after time window expires', () => {
      const config = { maxAttempts: 2, windowMs: 100 }; // 100ms window
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(false);
      
      // Wait for window to expire
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      
      vi.useRealTimers();
    });

    it('should apply block duration after exceeding limit', () => {
      const config = { 
        maxAttempts: 2, 
        windowMs: 60000,
        blockDurationMs: 30000 
      };
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(false);
      
      // Should still be blocked even after window expires but before block expires
      vi.useFakeTimers();
      vi.advanceTimersByTime(20000); // 20 seconds (< 30 second block)
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(false);
      
      vi.useRealTimers();
    });

    it('should handle different keys independently', () => {
      const config = { maxAttempts: 2, windowMs: 60000 };
      
      expect(rateLimiter.isAllowed('key1', config)).toBe(true);
      expect(rateLimiter.isAllowed('key2', config)).toBe(true);
      expect(rateLimiter.isAllowed('key1', config)).toBe(true);
      expect(rateLimiter.isAllowed('key2', config)).toBe(true);
      
      // key1 should be blocked
      expect(rateLimiter.isAllowed('key1', config)).toBe(false);
      // key2 should still be blocked
      expect(rateLimiter.isAllowed('key2', config)).toBe(false);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return correct remaining attempts', () => {
      const config = { maxAttempts: 5, windowMs: 60000 };
      
      expect(rateLimiter.getRemainingAttempts('test_key', config)).toBe(5);
      
      rateLimiter.isAllowed('test_key', config);
      expect(rateLimiter.getRemainingAttempts('test_key', config)).toBe(4);
      
      rateLimiter.isAllowed('test_key', config);
      expect(rateLimiter.getRemainingAttempts('test_key', config)).toBe(3);
    });

    it('should return 0 when blocked', () => {
      const config = { maxAttempts: 2, windowMs: 60000 };
      
      rateLimiter.isAllowed('test_key', config);
      rateLimiter.isAllowed('test_key', config);
      rateLimiter.isAllowed('test_key', config); // Blocked
      
      expect(rateLimiter.getRemainingAttempts('test_key', config)).toBe(0);
    });
  });

  describe('getTimeUntilUnblocked', () => {
    it('should return 0 when not blocked', () => {
      expect(rateLimiter.getTimeUntilUnblocked('test_key')).toBe(0);
    });

    it('should return remaining block time when blocked', () => {
      const config = { 
        maxAttempts: 1, 
        windowMs: 60000,
        blockDurationMs: 30000 
      };
      
      rateLimiter.isAllowed('test_key', config);
      rateLimiter.isAllowed('test_key', config); // Blocked
      
      const timeRemaining = rateLimiter.getTimeUntilUnblocked('test_key');
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(30000);
    });
  });

  describe('RateLimitConfigs', () => {
    it('should have AUTH config', () => {
      expect(RateLimitConfigs.AUTH).toBeDefined();
      expect(RateLimitConfigs.AUTH.maxAttempts).toBe(5);
      expect(RateLimitConfigs.AUTH.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should have PROOF_GENERATION config', () => {
      expect(RateLimitConfigs.PROOF_GENERATION).toBeDefined();
      expect(RateLimitConfigs.PROOF_GENERATION.maxAttempts).toBe(10);
      expect(RateLimitConfigs.PROOF_GENERATION.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should have PROOF_VERIFICATION config', () => {
      expect(RateLimitConfigs.PROOF_VERIFICATION).toBeDefined();
      expect(RateLimitConfigs.PROOF_VERIFICATION.maxAttempts).toBe(50);
    });

    it('should have ACCOUNT_DELETION config', () => {
      expect(RateLimitConfigs.ACCOUNT_DELETION).toBeDefined();
      expect(RateLimitConfigs.ACCOUNT_DELETION.maxAttempts).toBe(3);
      expect(RateLimitConfigs.ACCOUNT_DELETION.windowMs).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it('should have DATA_EXPORT config', () => {
      expect(RateLimitConfigs.DATA_EXPORT).toBeDefined();
      expect(RateLimitConfigs.DATA_EXPORT.maxAttempts).toBe(20);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a key', () => {
      const config = { maxAttempts: 2, windowMs: 60000 };
      
      rateLimiter.isAllowed('test_key', config);
      rateLimiter.isAllowed('test_key', config);
      expect(rateLimiter.isAllowed('test_key', config)).toBe(false);
      
      rateLimiter.reset('test_key');
      
      expect(rateLimiter.isAllowed('test_key', config)).toBe(true);
    });
  });
});
