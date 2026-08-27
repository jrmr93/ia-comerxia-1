/**
 * Safe local and session storage helper with robust in-memory fallback.
 * Prevents DOMException / SecurityError crashes in restrictive iframe sandboxes
 * or environments where third-party storage/cookies are restricted or partitioned.
 */

const memoryStore: Record<string, string> = {};
const memorySessionStore: Record<string, string> = {};

function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const storage = window[type];
    if (!storage) return false;
    const testKey = `__test_${type}__`;
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasLocal = isStorageAvailable('localStorage');
const hasSession = isStorageAvailable('sessionStorage');

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (hasLocal && typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (hasLocal && typeof window !== 'undefined') {
        window.localStorage.setItem(key, String(value));
        return;
      }
    } catch {}
    memoryStore[key] = String(value);
  },
  removeItem: (key: string): void => {
    try {
      if (hasLocal && typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    delete memoryStore[key];
  },
  clear: (): void => {
    try {
      if (hasLocal && typeof window !== 'undefined') {
        window.localStorage.clear();
        return;
      }
    } catch {}
    for (const key in memoryStore) {
      delete memoryStore[key];
    }
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (hasSession && typeof window !== 'undefined') {
        return window.sessionStorage.getItem(key);
      }
    } catch {}
    return Object.prototype.hasOwnProperty.call(memorySessionStore, key) ? memorySessionStore[key] : null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (hasSession && typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, String(value));
        return;
      }
    } catch {}
    memorySessionStore[key] = String(value);
  },
  removeItem: (key: string): void => {
    try {
      if (hasSession && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch {}
    delete memorySessionStore[key];
  },
  clear: (): void => {
    try {
      if (hasSession && typeof window !== 'undefined') {
        window.sessionStorage.clear();
        return;
      }
    } catch {}
    for (const key in memorySessionStore) {
      delete memorySessionStore[key];
    }
  },
};
