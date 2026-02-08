/**
 * Query helpers for secure database operations
 * Ensures all queries have proper limits and validation
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Default query limits
export const QUERY_LIMITS = {
  PROFILES_MAX: 100,
  NOTES_MAX: 50,
  COLLABORATORS_MAX: 50,
  DEFAULT_PAGE_SIZE: 20,
} as const;

/**
 * Safely query profiles with limits
 */
export async function queryProfiles(
  supabase: SupabaseClient,
  filters: {
    ownerId?: string;
    profileIds?: string[];
    limit?: number;
  }
) {
  const limit = Math.min(filters.limit || QUERY_LIMITS.PROFILES_MAX, QUERY_LIMITS.PROFILES_MAX);
  
  let query = supabase
    .from("profiles")
    .select("id, owner_id, name, description, visibility, punch_count, hug_count, kiss_count, notes_count, created_at")
    .limit(limit);
  
  if (filters.ownerId) {
    query = query.eq("owner_id", filters.ownerId);
  }
  
  if (filters.profileIds && filters.profileIds.length > 0) {
    // Limit the number of IDs to prevent abuse
    const limitedIds = filters.profileIds.slice(0, QUERY_LIMITS.PROFILES_MAX);
    query = query.in("id", limitedIds);
  }
  
  return query.order("created_at", { ascending: false });
}

/**
 * Safely query notes with limits
 */
export async function queryNotes(
  supabase: SupabaseClient,
  filters: {
    profileId: string;
    limit?: number;
    offset?: number;
  }
) {
  const limit = Math.min(filters.limit || QUERY_LIMITS.NOTES_MAX, QUERY_LIMITS.NOTES_MAX);
  const offset = Math.max(0, filters.offset || 0);
  
  return supabase
    .from("profile_notes")
    .select("id, text, user_id, emotion_type, created_at")
    .eq("profile_id", filters.profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
}

/**
 * Safely query collaborators with limits
 */
export async function queryCollaborators(
  supabase: SupabaseClient,
  filters: {
    userId?: string;
    profileId?: string;
    limit?: number;
  }
) {
  const limit = Math.min(filters.limit || QUERY_LIMITS.COLLABORATORS_MAX, QUERY_LIMITS.COLLABORATORS_MAX);
  
  let query = supabase
    .from("profile_collaborators")
    .select("id, user_id, display_name, avatar_url, profile_id")
    .limit(limit);
  
  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }
  
  if (filters.profileId) {
    query = query.eq("profile_id", filters.profileId);
  }
  
  return query;
}
