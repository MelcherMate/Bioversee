import type { UserIdentity } from "@supabase/supabase-js";
import { upsertStoredSession } from "./accountSessions";
import { supabase } from "./supabase";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_PX = 256;
const AVATAR_QUALITY = 0.86;

export type LinkedProviders = {
  identities: UserIdentity[];
  hasEmail: boolean;
  hasGoogle: boolean;
};

export async function refreshSessionVault() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    upsertStoredSession(data.session, { resetSignedInAt: false });
  }
  return data.session;
}

export async function getLinkedProviders(): Promise<LinkedProviders> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const identities = data.user?.identities ?? [];
  return {
    identities,
    hasEmail: identities.some((identity) => identity.provider === "email"),
    hasGoogle: identities.some((identity) => identity.provider === "google"),
  };
}

export async function updateAccountUsername(username: string) {
  const trimmed = username.trim();
  if (trimmed.length < 2) {
    throw new Error("USERNAME_TOO_SHORT");
  }

  const { data, error } = await supabase.auth.updateUser({
    data: {
      username: trimmed,
      full_name: trimmed,
      name: trimmed,
    },
  });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", data.user.id);
    if (profileError) throw profileError;
  }

  await refreshSessionVault();
  return data.user;
}

export async function updateAccountEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("EMAIL_INVALID");
  }

  const { data, error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) throw error;
  await refreshSessionVault();
  return data.user;
}

export async function updateAccountPassword(password: string) {
  if (password.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  await refreshSessionVault();
  return data.user;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("AVATAR_LOAD_FAILED"));
    };
    image.src = url;
  });
}

async function compressAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("AVATAR_NOT_IMAGE");
  }

  const image = await loadImage(file);
  const scale = Math.min(
    1,
    AVATAR_MAX_PX / Math.max(image.width, image.height)
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("AVATAR_CANVAS_FAILED");
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", AVATAR_QUALITY)
  );
  if (!blob) throw new Error("AVATAR_COMPRESS_FAILED");
  return blob;
}

export async function updateAccountAvatar(file: File) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("NOT_SIGNED_IN");

  const blob = await compressAvatar(file);
  const path = `${user.id}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);
  const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { data, error } = await supabase.auth.updateUser({
    data: {
      avatar_url: avatarUrl,
      picture: avatarUrl,
    },
  });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (profileError) throw profileError;

  await refreshSessionVault();
  return data.user;
}

export async function linkGoogleIdentity(redirectTo: string) {
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}
