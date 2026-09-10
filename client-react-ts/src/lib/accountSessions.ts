import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { toAppUser, type AppUser } from "./user";

const STORAGE_KEY = "bioversee.account_sessions.v1";

/** Wall-clock max age for a saved session on this device. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type AccountPresence = "signed_in" | "logged_out";

export type StoredAccount = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  signedInAt: number;
  presence: AccountPresence;
  updatedAt: number;
};

function isFresh(signedInAt: number, now = Date.now()): boolean {
  return now - signedInAt < SESSION_MAX_AGE_MS;
}

function normalizeAccount(raw: Partial<StoredAccount>): StoredAccount | null {
  if (!raw || typeof raw.userId !== "string") return null;

  const signedInAt =
    typeof raw.signedInAt === "number"
      ? raw.signedInAt
      : typeof raw.updatedAt === "number"
        ? raw.updatedAt
        : Date.now();

  const hasTokens =
    typeof raw.access_token === "string" &&
    raw.access_token.length > 0 &&
    typeof raw.refresh_token === "string" &&
    raw.refresh_token.length > 0;

  let presence: AccountPresence =
    raw.presence === "logged_out" || !hasTokens ? "logged_out" : "signed_in";

  if (presence === "signed_in" && !isFresh(signedInAt)) {
    presence = "logged_out";
  }

  return {
    userId: raw.userId,
    email: raw.email ?? null,
    displayName: raw.displayName || raw.email || "Account",
    avatarUrl: raw.avatarUrl ?? null,
    access_token: presence === "signed_in" ? raw.access_token || "" : "",
    refresh_token: presence === "signed_in" ? raw.refresh_token || "" : "",
    expires_at: raw.expires_at ?? null,
    signedInAt,
    presence,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function readVault(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredAccount>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeAccount)
      .filter((entry): entry is StoredAccount => entry !== null);
  } catch {
    return [];
  }
}

function writeVault(accounts: StoredAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

/** Expire any vault entries past the 1-week window (clears tokens). */
export function expireStaleAccounts(now = Date.now()): StoredAccount[] {
  const next = readVault().map((account) => {
    if (account.presence === "logged_out") return account;
    if (isFresh(account.signedInAt, now)) return account;
    return {
      ...account,
      presence: "logged_out" as const,
      access_token: "",
      refresh_token: "",
      updatedAt: now,
    };
  });
  writeVault(next);
  return next;
}

export function listStoredAccounts(): StoredAccount[] {
  return expireStaleAccounts().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isAccountSignedIn(account: StoredAccount): boolean {
  return (
    account.presence === "signed_in" &&
    Boolean(account.access_token && account.refresh_token) &&
    isFresh(account.signedInAt)
  );
}

export function markAccountLoggedOut(userId: string): StoredAccount[] {
  const next = readVault().map((account) =>
    account.userId === userId
      ? {
          ...account,
          presence: "logged_out" as const,
          access_token: "",
          refresh_token: "",
          updatedAt: Date.now(),
        }
      : account
  );
  writeVault(next);
  return next;
}

type UpsertOptions = {
  /** True on an explicit password/OAuth sign-in (resets the 1-week clock). */
  resetSignedInAt?: boolean;
};

export function upsertStoredSession(
  session: Session,
  options: UpsertOptions = {}
): StoredAccount[] {
  const { resetSignedInAt = false } = options;
  const appUser = toAppUser(session.user);
  const existing = readVault().find(
    (account) => account.userId === session.user.id
  );
  const now = Date.now();

  let signedInAt = existing?.signedInAt ?? now;
  if (resetSignedInAt) {
    signedInAt = now;
  } else if (
    !existing ||
    existing.presence === "logged_out" ||
    !isFresh(existing.signedInAt, now)
  ) {
    // First save, re-auth after logout/expiry — start a new 1-week window.
    signedInAt = now;
  }

  const entry: StoredAccount = {
    userId: session.user.id,
    email: appUser.email,
    displayName: appUser.displayName,
    avatarUrl: appUser.avatarUrl,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
    signedInAt,
    presence: "signed_in",
    updatedAt: now,
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
export function syncAccountVaultFromSession(
  session: Session | null,
  _event?: AuthChangeEvent
) {
  if (!session) return;
  // Preserve the 1-week clock across token refresh and account switches.
  // Explicit logins call upsertStoredSession(..., { resetSignedInAt: true }).
  upsertStoredSession(session, { resetSignedInAt: false });
}

/**
 * If the active session is older than 1 week, sign it out locally and
 * activate another signed-in account when possible.
 */
export async function enforceSessionMaxAge(): Promise<void> {
  expireStaleAccounts();

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return;

  const accounts = readVault();
  const current = accounts.find((account) => account.userId === session.user.id);
  const signedInAt = current?.signedInAt ?? Date.now();

  if (isFresh(signedInAt)) {
    // Ensure vault has current session without resetting the clock.
    upsertStoredSession(session, { resetSignedInAt: !current });
    return;
  }

  await signOutCurrentAccount();
}

export async function switchToAccount(userId: string): Promise<void> {
  expireStaleAccounts();
  const account = readVault().find((entry) => entry.userId === userId);
  if (!account) {
    throw new Error("Account not found on this device");
  }

  if (!isAccountSignedIn(account)) {
    throw new Error("REAUTH_REQUIRED");
  }

  const { data: current } = await supabase.auth.getSession();
  if (current.session) {
    upsertStoredSession(current.session, { resetSignedInAt: false });
  }

  if (current.session?.user.id === userId) {
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });
  if (error) {
    markAccountLoggedOut(userId);
    throw new Error("REAUTH_REQUIRED");
  }
}

/**
 * Sign out only the active account. Keeps it on the device list as logged out.
 * If another signed-in account remains, switch to it.
 */
export async function signOutCurrentAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const currentId = data.session?.user.id;

  if (currentId) {
    markAccountLoggedOut(currentId);
  }

  await supabase.auth.signOut({ scope: "local" });

  const remaining = listStoredAccounts().filter(isAccountSignedIn);
  if (remaining.length === 0) return;

  const next = remaining[0];
  const { error } = await supabase.auth.setSession({
    access_token: next.access_token,
    refresh_token: next.refresh_token,
  });
  if (error) {
    markAccountLoggedOut(next.userId);
    if (listStoredAccounts().some(isAccountSignedIn)) {
      await signOutCurrentAccount();
    }
  }
}

/** Remove every saved account on this browser and clear the active session. */
export async function signOutAllAccounts(): Promise<void> {
  clearStoredAccounts();
  await supabase.auth.signOut({ scope: "local" });
}

/**
 * Permanently delete the signed-in auth user + cascaded app data,
 * remove them from the local vault, then switch to another saved
 * session if one remains.
 */
export async function deleteCurrentAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  removeStoredAccount(userId);
  await supabase.auth.signOut({ scope: "local" });

  const remaining = listStoredAccounts().filter(isAccountSignedIn);
  if (remaining.length === 0) return;

  const next = remaining[0];
  const { error: switchError } = await supabase.auth.setSession({
    access_token: next.access_token,
    refresh_token: next.refresh_token,
  });
  if (switchError) {
    markAccountLoggedOut(next.userId);
  }
}
