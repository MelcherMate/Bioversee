import { supabase } from "./supabase";
import type { AppearanceSettings } from "./appearance";
import { appearanceFromPrefs } from "./appearance";

export type UserPreferencesJson = {
  theme?: AppearanceSettings["theme"];
  accent?: string;
  language?: AppearanceSettings["language"];
  /** First-run device setup intro was finished or dismissed. */
  onboardingCompleted?: boolean;
};

export async function fetchUserPreferences(
  userId: string
): Promise<UserPreferencesJson | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[user_settings] fetch failed", error.message);
    return null;
  }

  const raw = data?.preferences;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as UserPreferencesJson;
}

export async function upsertUserPreferences(
  userId: string,
  preferences: UserPreferencesJson
): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const uid = session.user.id;
  if (uid !== userId) return false;

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: uid,
      preferences,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.warn("[user_settings] upsert failed", error.message);
    return false;
  }
  return true;
}

export async function mergeUserPreferences(
  userId: string,
  patch: Partial<UserPreferencesJson>
): Promise<boolean> {
  const existing = await fetchUserPreferences(userId);
  return upsertUserPreferences(userId, { ...(existing ?? {}), ...patch });
}

export async function loadAppearanceFromCloud(
  userId: string
): Promise<AppearanceSettings | null> {
  const prefs = await fetchUserPreferences(userId);
  return appearanceFromPrefs(prefs);
}
