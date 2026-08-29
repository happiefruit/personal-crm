// Shared-passcode session, persisted in localStorage.

const KEY = 'crm_passcode';
let passcode = '';
try {
  passcode = localStorage.getItem(KEY) || '';
} catch {
  passcode = '';
}

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(passcode));

export const getPasscode = () => passcode;

export function setPasscode(value) {
  passcode = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* private mode — keep it in memory only */
  }
  emit();
}

export function clearPasscode() {
  passcode = '';
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/** Subscribe to passcode changes; returns an unsubscribe fn. */
export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
