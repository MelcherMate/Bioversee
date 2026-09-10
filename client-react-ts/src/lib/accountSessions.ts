import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { toAppUser, type AppUser } from "./user";

const STORAGE_KEY = "bioversee.account_sessions.v1";

export type StoredAccount = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  updatedAt: number;
};

function readVault(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.userId === "string" &&
        typeof entry.access_token === "string" &&
        typeof entry.refresh_token === "string"
    );
  } catch {
    return [];
  }
}

function writeVault(accounts: StoredAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function listStoredAccounts(): StoredAccount[] {
  return readVault().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertStoredSession(session: Session): StoredAccount[] {
  const appUser = toAppUser(session.user);
  const entry: StoredAccount = {
    userId: session.user.id,
    email: appUser.email,
    displayName: appUser.displayName,
    avatarUrl: appUser.avatarUrl,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
    updatedAt: Date.now(),
  };

  const next = readVault().filter((account) => account.userId !== entry.userId);
  next.unshift(entry);
  writeVault(next);
  return next;
}

export function removeStoredAccount(userId: string): StoredAccount[] {
  const next = readVault().filter((account) => account.userId !== userId);
  writeVault(next);
  return next;
}

export function clearStoredAccounts() {
  localStorage.removeItem(STORAGE_KEY);
}

export function storedAccountToAppUser(account: StoredAccount): AppUser {
  const parts = account.displayName.trim().split(/\s+/);
  return {
    id: account.userId,
    email: account.email,
    displayName: account.displayName,
    givenName: parts[0] || "",
    familyName: parts.length > 1 ? parts.slice(1).join(" ") : "",
    avatarUrl: account.avatarUrl,
  };
}

export function avatarForAccount(account: {
  displayName: string;
  avatarUrl: string | null;
}): string {
  return (
    account.avatarUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      account.displayName
    )}`
  );
}

/** Keep the multi-account vault in sync with the active Supabase session. */
export function syncAccountVaultFromSession(session: Session | null) {
  if (session) {
    upsertStoredSession(session);
  }
}

export async function switchToAccount(userId: string): Promise<void> {
  const account = readVault().find((entry) => entry.userId === userId);
  if (!account) {
    throw new Error("Account not found on this device");
  }

  const { data: current } = await supabase.auth.getSession();
  if (current.session) {
    upsertStoredSession(current.session);
  }

  if (current.session?.user.id === userId) {
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });
  if (error) {
    removeStoredAccount(userId);
    throw error;
  }
}

/**
 * Sign out only the active account. If other accounts remain on this device,
 * switch to the most recently used one.
 */
export async function signOutCurrentAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const currentId = data.session?.user.id;

  if (currentId) {
    removeStoredAccount(currentId);
  }

  await supabase.auth.signOut({ scope: "local" });

  const remaining = listStoredAccounts();
  if (remaining.length === 0) return;

  const next = remaining[0];
  const { error } = await supabase.auth.setSession({
    access_token: next.access_token,
    refresh_token: next.refresh_token,
  });
  if (error) {
    removeStoredAccount(next.userId);
    if (listStoredAccounts().length > 0) {
      await signOutCurrentAccount();
    }
  }
}

/** Remove every saved account on this browser and clear the active session. */
export async function signOutAllAccounts(): Promise<void> {
  clearStoredAccounts();
  await supabase.auth.signOut({ scope: "local" });
}
