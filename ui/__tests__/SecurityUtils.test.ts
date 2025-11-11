/**
 * SecurityUtils.test.ts
 * 
 * Unit tests for security utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateCSPHeader,
  generateSecureRandom,
  hashForLogging,
  constantTimeCompare,
  checkSecurityFeatures,
  redactSensitiveData,
  logSecurityEvent,
} from '../lib/SecurityUtils';

describe('SecurityUtils', () => {
  describe('generateCSPHeader', () => {
    it('should generate valid CSP header', () => {
      const csp = generateCSPHeader();
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-eval'");
      expect(csp).toContain("worker-src 'self' blob:");
    });

    it('should include o1js requirements', () => {
      const csp = generateCSPHeader();
      
      // o1js requires unsafe-eval for ZK proofs
      expect(csp).toContain("'unsafe-eval'");
      // o1js requires blob: for workers
      expect(csp).toContain('blob:');
    });
  });

  describe('generateSecureRandom', () => {
    it('should generate random string of specified length', () => {
      const random1 = generateSecureRandom(16);
      const random2 = generateSecureRandom(16);
      
      expect(random1.length).toBe(16);
      expect(random2.length).toBe(16);
      expect(random1).not.toBe(random2); // Should be different
    });

    it('should generate different values on each call', () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(generateSecureRandom(32));
      }
      expect(values.size).toBe(100); // All unique
    });

    it('should only contain alphanumeric characters', () => {
      const random = generateSecureRandom(100);
      expect(random).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('hashForLogging', () => {
    it('should generate consistent hash for same input', async () => {
      const input = 'test-data';
      const hash1 = await hashForLogging(input);
      const hash2 = await hashForLogging(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await hashForLogging('input1');
      const hash2 = await hashForLogging('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce hex string output', async () => {
      const hash = await hashForLogging('test');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should be one-way (cannot reverse)', async () => {
      const original = 'sensitive-data';
      const hash = await hashForLogging(original);
      
      // Hash should not contain original data
      expect(hash).not.toContain(original);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for identical strings', () => {
      expect(constantTimeCompare('hello', 'hello')).toBe(true);
      expect(constantTimeCompare('test123', 'test123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('hello', 'world')).toBe(false);
      expect(constantTimeCompare('test', 'Test')).toBe(false); // Case sensitive
    });

    it('should return false for different length strings', () => {
      expect(constantTimeCompare('short', 'longer string')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('text', '')).toBe(false);
    });

    it('should be timing-attack resistant', () => {
      // This is a basic check - true timing attack resistance requires timing analysis
      const target = 'secret123';
      const wrong1 = 'xecret123'; // First char different
      const wrong2 = 'secret12x'; // Last char different
      
      // Both should return false regardless of where the difference is
      expect(constantTimeCompare(target, wrong1)).toBe(false);
      expect(constantTimeCompare(target, wrong2)).toBe(false);
    });
  });

  describe('checkSecurityFeatures', () => {
    it('should check for Web Crypto API', () => {
      const result = checkSecurityFeatures();
      
      if (typeof window !== 'undefined' && window.crypto) {
        expect(result.missing).not.toContain('Web Crypto API');
      }
    });

    it('should check for WebAuthn', () => {
      const result = checkSecurityFeatures();
      
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        expect(result.missing).not.toContain('WebAuthn/Passkeys');
      }
    });

    it('should check for SharedArrayBuffer', () => {
      const result = checkSecurityFeatures();
      
      if (typeof SharedArrayBuffer !== 'undefined') {
        expect(result.missing).not.toContain('SharedArrayBuffer (required for o1js)');
      }
    });

    it('should return supported=true when all features available', () => {
      const result = checkSecurityFeatures();
      
      if (result.supported) {
        expect(result.missing.length).toBe(0);
      } else {
        expect(result.missing.length).toBeGreaterThan(0);
      }
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact private key fields', () => {
      const data = {
        name: 'John',
        privateKey: 'secret123',
        publicKey: 'public456',
      };
      
      const redacted = redactSensitiveData(data);
      expect(redacted.privateKey).toBe('[REDACTED]');
      expect(redacted.publicKey).toBe('public456'); // Not redacted
      expect(redacted.name).toBe('John');
    });

    it('should redact password fields', () => {
      const data = {
        username: 'user',
        password: 'secret',
        confirmPassword: 'secret',
      };
      
      const redacted = redactSensitiveData(data);
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.confirmPassword).toBe('[REDACTED]');
      expect(redacted.username).toBe('user');
    });

    it('should redact secret and token fields', () => {
      const data = {
        apiSecret: 'secret123',
        authToken: 'token456',
        accessToken: 'access789',
        data: 'normal data',
      };
      
      const redacted = redactSensitiveData(data);
      expect(redacted.apiSecret).toBe('[REDACTED]');
      expect(redacted.authToken).toBe('[REDACTED]');
      expect(redacted.accessToken).toBe('[REDACTED]');
      expect(redacted.data).toBe('normal data');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            apiKey: 'key123',
          },
        },
      };
      
      const redacted = redactSensitiveData(data);
      expect(redacted.user.name).toBe('John');
      expect(redacted.user.credentials.password).toBe('[REDACTED]');
      expect(redacted.user.credentials.apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const data = {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' },
        ],
      };
      
      const redacted = redactSensitiveData(data);
      expect(redacted.users[0].password).toBe('[REDACTED]');
      expect(redacted.users[1].password).toBe('[REDACTED]');
      expect(redacted.users[0].name).toBe('John');
      expect(redacted.users[1].name).toBe('Jane');
    });

    it('should not modify original object', () => {
      const original = { password: 'secret', name: 'John' };
      const redacted = redactSensitiveData(original);
      
      expect(original.password).toBe('secret'); // Original unchanged
      expect(redacted.password).toBe('[REDACTED]');
    });
  });

  describe('logSecurityEvent', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should log event to localStorage', () => {
      logSecurityEvent('test_event', { data: 'test' }, 'info');
      
      const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
      expect(logs.length).toBe(1);
      expect(logs[0].event).toBe('test_event');
      expect(logs[0].level).toBe('info');
    });

    it('should include timestamp in log', () => {
      const beforeTime = new Date().toISOString();
      logSecurityEvent('test_event', {}, 'info');
      const afterTime = new Date().toISOString();
      
      const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
      const logTime = logs[0].timestamp;
      
      expect(logTime).toBeTypeOf('string');
      expect(logTime.length).toBeGreaterThan(0);
      expect(logTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format
    });

    it('should redact sensitive data in details', () => {
      logSecurityEvent('login', { username: 'user', password: 'secret' }, 'info');
      
      const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
      expect(logs[0].details.password).toBe('[REDACTED]');
      expect(logs[0].details.username).toBe('user');
    });

    it('should limit log storage to 100 entries', () => {
      // Add 110 logs
      for (let i = 0; i < 110; i++) {
        logSecurityEvent(`event_${i}`, { count: i }, 'info');
      }
      
      const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
      expect(logs.length).toBe(100);
      
      // Should keep the most recent 100
      expect(logs[0].details.count).toBeGreaterThanOrEqual(10);
    });

    it('should support different log levels', () => {
      logSecurityEvent('info_event', {}, 'info');
      logSecurityEvent('warning_event', {}, 'warning');
      logSecurityEvent('error_event', {}, 'error');
      
      const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
      
      // Logs are stored newest first (unshift), so error is first
      expect(logs[0].level).toBe('error');
      expect(logs[1].level).toBe('warning');
      expect(logs[2].level).toBe('info');
    });

    it('should handle logging errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('Storage full');
      };
      
      // Should not throw
      expect(() => {
        logSecurityEvent('test_event', {}, 'info');
      }).not.toThrow();
      
      // Restore
      Storage.prototype.setItem = originalSetItem;
    });
  });
});
