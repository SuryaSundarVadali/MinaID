/**
 * InputValidator.test.ts
 * 
 * Unit tests for input validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateDID,
  validateMinaAddress,
  validatePasskeyId,
  validateAge,
  sanitizeString,
  validateJSON,
  validateProofData,
  validateCredentialData,
  containsSuspiciousPatterns,
  validateURL,
  validateEmail,
} from '../lib/InputValidator';

describe('InputValidator', () => {
  describe('validateDID', () => {
    it('should validate correct DID format', () => {
      expect(validateDID('did:mina:B62qkYa1o6Mj6uTTjDQCob7FYZspuhkm4T1jndY9WEHqMZgEFnQnJ2f')).toBe(true);
      expect(validateDID('did:mina:B62qnTR8bvyPKLALcqkQjHcx9vP1eiEXLcxs9eCWWrYBQkN1T3N8DaH')).toBe(true);
    });

    it('should reject invalid DID format', () => {
      expect(validateDID('not-a-did')).toBe(false);
      expect(validateDID('did:mina:')).toBe(false);
      expect(validateDID('did:eth:0x123')).toBe(false);
      expect(validateDID('')).toBe(false);
    });
  });

  describe('validateMinaAddress', () => {
    it('should validate correct Mina address', () => {
      expect(validateMinaAddress('B62qkYa1o6Mj6uTTjDQCob7FYZspuhkm4T1jndY9WEHqMZgEFnQnJ2f')).toBe(true);
      expect(validateMinaAddress('B62qnTR8bvyPKLALcqkQjHcx9vP1eiEXLcxs9eCWWrYBQkN1T3N8DaH')).toBe(true);
    });

    it('should reject invalid Mina address', () => {
      expect(validateMinaAddress('B62qinvalid')).toBe(false);
      expect(validateMinaAddress('0x1234567890')).toBe(false);
      expect(validateMinaAddress('')).toBe(false);
    });
  });

  describe('validatePasskeyId', () => {
    it('should validate correct passkey ID format', () => {
      expect(validatePasskeyId('abc123def456')).toBe(true);
      expect(validatePasskeyId('ABC-123_def')).toBe(true);
      expect(validatePasskeyId('a'.repeat(64))).toBe(true);
    });

    it('should reject invalid passkey ID', () => {
      expect(validatePasskeyId('ab')).toBe(false); // Too short
      expect(validatePasskeyId('a'.repeat(300))).toBe(false); // Too long
      expect(validatePasskeyId('pass<script>')).toBe(false); // Invalid characters
      expect(validatePasskeyId('')).toBe(false);
    });
  });

  describe('validateAge', () => {
    it('should validate valid ages', () => {
      expect(validateAge(18).valid).toBe(true);
      expect(validateAge(0).valid).toBe(true);
      expect(validateAge(150).valid).toBe(true);
      expect(validateAge(65).valid).toBe(true);
    });

    it('should reject invalid ages', () => {
      expect(validateAge(-1).valid).toBe(false);
      expect(validateAge(151).valid).toBe(false);
      expect(validateAge(NaN).valid).toBe(false);
      expect(validateAge(Infinity).valid).toBe(false);
    });

    it('should provide error messages for invalid ages', () => {
      expect(validateAge(-1).error).toBe('Age must be a positive number');
      expect(validateAge(151).error).toBe('Age must be between 0 and 150');
      expect(validateAge(NaN).error).toBe('Age must be a valid number');
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeString('<div>Hello</div>')).toBe('divHello/div');
      expect(sanitizeString('Plain text')).toBe('Plain text');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert("xss")')).toBe('alert("xss")');
      expect(sanitizeString('normal text')).toBe('normal text');
    });

    it('should remove event handlers', () => {
      expect(sanitizeString('onclick="malicious()"')).not.toContain('onclick');
      expect(sanitizeString('onload="bad()"')).not.toContain('onload');
    });

    it('should handle empty and null input', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('   ');
    });
  });

  describe('validateJSON', () => {
    it('should validate valid JSON', () => {
      expect(validateJSON('{"key": "value"}')).toBe(true);
      expect(validateJSON('[1, 2, 3]')).toBe(true);
      expect(validateJSON('"string"')).toBe(true);
      expect(validateJSON('null')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(validateJSON('{invalid}')).toBe(false);
      expect(validateJSON('undefined')).toBe(false);
      expect(validateJSON('')).toBe(false);
      expect(validateJSON('{')).toBe(false);
    });
  });

  describe('validateProofData', () => {
    it('should validate correct proof structure', () => {
      const validProof = {
        id: 'proof_123',
        type: 'age',
        timestamp: Date.now(),
        subjectDID: 'did:mina:B62qkYa1o6Mj6uTTjDQCob7FYZspuhkm4T1jndY9WEHqMZgEFnQnJ2f',
        proof: { data: 'proof_data' },
      };
      
      const result = validateProofData(validProof);
      expect(result.valid).toBe(true);
    });

    it('should reject proof with missing fields', () => {
      const invalidProof = {
        id: 'proof_123',
        type: 'age',
        // missing timestamp, subjectDID, proof
      };
      
      const result = validateProofData(invalidProof);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject proof with invalid types', () => {
      const invalidProof = {
        id: 'proof_123',
        type: 'age',
        timestamp: 'not-a-number', // Should be number
        subjectDID: 'did:mina:B62qkYa1o6Mj6uTTjDQCob7FYZspuhkm4T1jndY9WEHqMZgEFnQnJ2f',
        proof: { data: 'proof_data' },
      };
      
      const result = validateProofData(invalidProof);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });
  });

  describe('validateCredentialData', () => {
    it('should validate correct credential structure', () => {
      const validCredential = {
        name: 'John Doe',
        aadharNumber: '123456789012',
        dateOfBirth: '1990-01-01',
      };
      
      const result = validateCredentialData(validCredential);
      expect(result.valid).toBe(true);
    });

    it('should reject credential with missing required fields', () => {
      const invalidCredential = {
        name: 'John Doe',
        // missing aadharNumber and dateOfBirth
      };
      
      const result = validateCredentialData(invalidCredential);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should reject credential with invalid date format', () => {
      const invalidCredential = {
        name: 'John Doe',
        aadharNumber: '123456789012',
        dateOfBirth: '01/01/1990', // Wrong format
      };
      
      const result = validateCredentialData(invalidCredential);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dateOfBirth must be in YYYY-MM-DD format');
    });

    it('should reject credential with invalid Aadhar number length', () => {
      const invalidCredential = {
        name: 'John Doe',
        aadharNumber: '12345', // Too short
        dateOfBirth: '1990-01-01',
      };
      
      const result = validateCredentialData(invalidCredential);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('aadharNumber must be 12 digits');
    });
  });

  describe('containsSuspiciousPatterns', () => {
    it('should detect XSS attempts', () => {
      expect(containsSuspiciousPatterns('<script>alert("xss")</script>')).toBe(true);
      expect(containsSuspiciousPatterns('<img src=x onerror="alert(1)">')).toBe(true);
      expect(containsSuspiciousPatterns('javascript:void(0)')).toBe(true);
    });

    it('should detect SQL injection attempts', () => {
      expect(containsSuspiciousPatterns("' OR '1'='1")).toBe(true);
      expect(containsSuspiciousPatterns('DROP TABLE users')).toBe(true);
      expect(containsSuspiciousPatterns('SELECT * FROM')).toBe(true);
    });

    it('should allow normal text', () => {
      expect(containsSuspiciousPatterns('Normal text')).toBe(false);
      expect(containsSuspiciousPatterns('Email: user@example.com')).toBe(false);
      expect(containsSuspiciousPatterns('Age: 25 years')).toBe(false);
    });
  });

  describe('validateURL', () => {
    it('should validate correct URLs', () => {
      expect(validateURL('https://example.com')).toBe(true);
      expect(validateURL('http://localhost:3000')).toBe(true);
      expect(validateURL('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateURL('not-a-url')).toBe(false);
      expect(validateURL('ftp://example.com')).toBe(false); // Not http(s)
      expect(validateURL('javascript:alert(1)')).toBe(false);
      expect(validateURL('')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('user123@test-domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });
});
