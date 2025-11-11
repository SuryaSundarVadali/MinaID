/**
 * Test setup file for Vitest
 */

import '@testing-library/jest-dom';

// Mock window.crypto for tests
if (typeof window !== 'undefined' && !window.crypto) {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        digest: async (algorithm: string, data: BufferSource) => {
          // Mock SHA-256 hash
          const text = new TextDecoder().decode(data);
          let hash = 0;
          for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return new Uint8Array([hash & 0xff, (hash >> 8) & 0xff, (hash >> 16) & 0xff, (hash >> 24) & 0xff]);
        },
      },
    },
  });
}

// Mock localStorage for tests
if (typeof window !== 'undefined' && !window.localStorage) {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] || null,
      get length() {
        return Object.keys(store).length;
      },
    };
  })();
  
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}
