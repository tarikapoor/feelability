/**
 * Supabase Edge Function: Create Note
 * 
 * Validates input, enforces rate limiting, and creates note securely.
 * Replaces direct table INSERT from frontend.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateNoteRequest {
  profileId: string;
  text: string;
  emotionType: "anger" | "feelings" | "appreciation";
}

const VALIDATION_LIMITS = {
  NOTE_TEXT_MAX: 5000,
  NOTE_TEXT_MIN: 1,
};

const RATE_LIMIT = {
  MAX_PER_MINUTE: 20,
};

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  const timestamps = rateLimitStore.get(userId) || [];
  const recentRequests = timestamps.filter((ts) => ts > oneMinuteAgo);
  
  if (recentRequests.length >= RATE_LIMIT.MAX_PER_MINUTE) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(userId, recentRequests);
  
  return true;
}

function sanitizeText(text: string, maxLength: number): string {
  return text
    .trim()
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, maxLength);
}

function validateNoteText(text: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Note text is required" };
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length < VALIDATION_LIMITS.NOTE_TEXT_MIN) {
    return { valid: false, error: "Note must contain text" };
  }
  
  if (trimmed.length > VALIDATION_LIMITS.NOTE_TEXT_MAX) {
    return { valid: false, error: `Note must be ${VALIDATION_LIMITS.NOTE_TEXT_MAX} characters or less` };
  }
  
  return { valid: true };
}

function validateEmotionType(type: string): type is "anger" | "feelings" | "appreciation" {
  return ["anger", "feelings", "appreciation"].includes(type);
}

function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateNoteRequest = await req.json();
    
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!validateUUID(body.profileId)) {
      return new Response(
        JSON.stringify({ error: "Invalid profile ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textValidation = validateNoteText(body.text);
    if (!textValidation.valid) {
      return new Response(
        JSON.stringify({ error: textValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateEmotionType(body.emotionType)) {
      return new Response(
        JSON.stringify({ error: "Invalid emotion type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to profile (RLS will enforce, but double-check)
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, owner_id, visibility")
      .eq("id", body.profileId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is owner or collaborator (RLS handles this, but we verify)
    const isOwner = profile.owner_id === user.id;
    const isPublic = profile.visibility === "public";
    
    if (!isOwner && isPublic) {
      // Check if user is collaborator
      const { data: collab } = await supabaseClient
        .from("profile_collaborators")
        .select("id")
        .eq("profile_id", body.profileId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!collab) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!isOwner) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize text
    const sanitizedText = sanitizeText(body.text, VALIDATION_LIMITS.NOTE_TEXT_MAX);

    // Create note
    const { data, error } = await supabaseClient
      .from("profile_notes")
      .insert({
        profile_id: body.profileId,
        user_id: user.id,
        text: sanitizedText,
        emotion_type: body.emotionType,
      })
      .select("id, text, user_id, emotion_type, created_at")
      .single();

    if (error) {
      console.error("Error creating note:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create note" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update notes count (RLS allows this for owners/collaborators)
    await supabaseClient.rpc("increment_notes_count", { profile_id_param: body.profileId }).catch(() => {
      // Fallback: direct update (RLS will enforce)
      supabaseClient
        .from("profiles")
        .update({ notes_count: supabaseClient.rpc("get_notes_count", { profile_id_param: body.profileId }) })
        .eq("id", body.profileId);
    });

    // Log successful creation
    console.log(`Note created: ${data.id} by user ${user.id} on profile ${body.profileId}`);

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
