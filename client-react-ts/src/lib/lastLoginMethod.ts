const STORAGE_KEY = "bv.lastLoginMethod";

export type LastLoginMethod = "email" | "google";

export function getLastLoginMethod(): LastLoginMethod | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "email" || value === "google") return value;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

export function setLastLoginMethod(method: LastLoginMethod) {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    /* private mode / blocked storage */
  }
}
