import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'anon_qr_uid';

export function getOrCreateId(): string {
  if (typeof window === 'undefined') {
    return uuidv4();
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const next = uuidv4();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return uuidv4();
  }
}

