import type { User } from "@supabase/supabase-js";

/** Normalized user shape for Navbar / pages from Supabase Auth. */
export type AppUser = {
  id: string;
  email: string | null;
  displayName: string;
  givenName: string;
  familyName: string;
  avatarUrl: string | null;
};

export function toAppUser(user: User): AppUser {
  const meta = user.user_metadata ?? {};
  const fullName =
    meta.full_name || meta.name || user.email?.split("@")[0] || "User";
  const parts = String(fullName).trim().split(/\s+/);
  const givenName = meta.given_name || parts[0] || "";
  const familyName =
    meta.family_name || (parts.length > 1 ? parts.slice(1).join(" ") : "");

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: fullName,
    givenName,
    familyName,
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}
