/**
 * E2EE Notes service - bridges encryption lib with Supabase
 * Handles: profile keys, key sharing, encrypt/decrypt, and note persistence
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOrCreateUserKeyPair,
  getUserPublicKeyJwk,
  getProfileKey,
  setProfileKey,
  removeProfileKey,
  generateProfileKey,
  wrapProfileKeyForUser,
  unwrapProfileKey,
  encryptNote,
  decryptNote,
  isE2EEAvailable,
} from "./encryption";

export { isE2EEAvailable };

export type NoteEncrypted = {
  id: string;
  profile_id: string;
  user_id: string | null;
  text: string | null;
  ciphertext: string | null;
  iv: string | null;
  emotion_type: "anger" | "feelings" | "appreciation";
  created_at: string;
};

export type NoteDecrypted = {
  id: string;
  text: string;
  authorId: string;
  emotionType: "anger" | "feelings" | "appreciation";
  createdAt?: number;
};

/**
 * Ensure the current user has a keypair and public key stored in Supabase.
 * Call this on app load when user is authenticated.
 */
export async function ensureUserEncryptionKeys(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { publicKey } = await getOrCreateUserKeyPair(userId);
  await supabase.from("user_encryption_keys").upsert(
    { user_id: userId, public_key_jwk: publicKey },
    { onConflict: "user_id" }
  );
}

/**
 * Get or create the profile encryption key for the owner.
 * Owners get a new key generated; collaborators get it from profile_key_shares.
 */
export async function getOrCreateProfileKeyForUser(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  isOwner: boolean
): Promise<CryptoKey | null> {
  const existing = await getProfileKey(profileId, userId);
  if (existing) return existing;

  if (isOwner) {
    const key = await generateProfileKey();
    await setProfileKey(profileId, key);
    return key;
  }

  // Collaborator: fetch wrapped key
  const { data: share, error } = await supabase
    .from("profile_key_shares")
    .select("wrapped_key")
    .eq("profile_id", profileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !share?.wrapped_key) return null;

  const { privateKey } = await getOrCreateUserKeyPair(userId);
  const profileKey = await unwrapProfileKey(share.wrapped_key, privateKey);
  await setProfileKey(profileId, profileKey);
  return profileKey;
}

/**
 * Ensure all collaborators of a profile have the profile key shared.
 * Call this when the owner loads a profile they own.
 */
export async function ensureKeySharesForCollaborators(
  supabase: SupabaseClient,
  profileId: string,
  ownerUserId: string
): Promise<void> {
  const profileKey = await getProfileKey(profileId, ownerUserId);
  if (!profileKey) return;

  const { data: collaborators } = await supabase
    .from("profile_collaborators")
    .select("user_id")
    .eq("profile_id", profileId);

  const { data: existingShares } = await supabase
    .from("profile_key_shares")
    .select("user_id")
    .eq("profile_id", profileId);

  const sharedIds = new Set((existingShares ?? []).map((s) => s.user_id));

  for (const c of collaborators ?? []) {
    if (c.user_id === ownerUserId || sharedIds.has(c.user_id)) continue;
    const pubKey = await getUserPublicKeyJwk(c.user_id);
    if (!pubKey) continue;
    const wrapped = await wrapProfileKeyForUser(profileKey, pubKey);
    await supabase.from("profile_key_shares").upsert(
      { profile_id: profileId, user_id: c.user_id, wrapped_key: wrapped },
      { onConflict: "profile_id,user_id" }
    );
  }
}

/**
 * Share the profile key with a collaborator when they are added.
 * Call this after inserting into profile_collaborators.
 */
export async function shareProfileKeyWithCollaborator(
  supabase: SupabaseClient,
  profileId: string,
  collaboratorUserId: string,
  ownerUserId: string
): Promise<boolean> {
  const profileKey = await getProfileKey(profileId, ownerUserId);
  if (!profileKey) return false;

  const collaboratorPublicKey = await getUserPublicKeyJwk(collaboratorUserId);
  if (!collaboratorPublicKey) return false;

  const wrapped = await wrapProfileKeyForUser(profileKey, collaboratorPublicKey);

  const { error } = await supabase.from("profile_key_shares").upsert(
    {
      profile_id: profileId,
      user_id: collaboratorUserId,
      wrapped_key: wrapped,
    },
    { onConflict: "profile_id,user_id" }
  );

  return !error;
}

/**
 * Encrypt and persist a note. Returns the decrypted note shape for UI.
 */
export async function createEncryptedNote(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  plaintext: string,
  emotionType: "anger" | "feelings" | "appreciation",
  isOwner: boolean
): Promise<NoteDecrypted | null> {
  const key = await getOrCreateProfileKeyForUser(supabase, profileId, userId, isOwner);
  if (!key) return null;

  const { ciphertext, iv } = await encryptNote(plaintext, key);

  const { data, error } = await supabase
    .from("profile_notes")
    .insert({
      profile_id: profileId,
      user_id: userId,
      ciphertext,
      iv,
      emotion_type: emotionType,
    })
    .select("id, user_id, emotion_type, created_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    text: plaintext,
    authorId: data.user_id ?? userId,
    emotionType: (data.emotion_type as NoteDecrypted["emotionType"]) ?? emotionType,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  };
}

/**
 * Load and decrypt notes for a profile.
 * Handles both E2EE notes (ciphertext+iv) and legacy plaintext notes.
 */
export async function loadAndDecryptNotes(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  isOwner: boolean
): Promise<NoteDecrypted[]> {
  const { data: rows, error } = await supabase
    .from("profile_notes")
    .select("id, text, ciphertext, iv, user_id, emotion_type, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !rows) return [];

  const profileKey = isOwner
    ? await getProfileKey(profileId, userId)
    : await getOrCreateProfileKeyForUser(supabase, profileId, userId, false);

  const decrypted: NoteDecrypted[] = [];

  for (const row of rows) {
    let text: string;

    if (row.ciphertext && row.iv && profileKey) {
      try {
        text = await decryptNote(row.ciphertext, row.iv, profileKey);
      } catch {
        text = "[Unable to decrypt]";
      }
    } else if (row.text) {
      text = row.text;
    } else {
      text = "[Unable to decrypt]";
    }

    decrypted.push({
      id: row.id,
      text,
      authorId: row.user_id ?? "",
      emotionType: (row.emotion_type as NoteDecrypted["emotionType"]) ?? "feelings",
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    });
  }

  return decrypted;
}

/**
 * Remove profile key from local storage when collaborator is removed.
 * Call when user is removed from profile_key_shares or when they leave.
 */
export async function revokeLocalProfileKey(profileId: string): Promise<void> {
  await removeProfileKey(profileId);
}
