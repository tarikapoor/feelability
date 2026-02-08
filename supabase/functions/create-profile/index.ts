/**
 * Supabase Edge Function: Create Profile
 * 
 * Validates input, enforces rate limiting, and creates profile securely.
 * Replaces direct table INSERT from frontend.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateProfileRequest {
  name: string;
  description?: string;
  visibility?: "public" | "private";
  imageUrl?: string;
}

const VALIDATION_LIMITS = {
  PROFILE_NAME_MAX: 30,
  PROFILE_DESC_MAX: 50,
};

const RATE_LIMIT = {
  MAX_PER_MINUTE: 5,
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

function validateProfileName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Profile name is required" };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 1) {
    return { valid: false, error: "Profile name must be at least 1 character" };
  }
  
  if (trimmed.length > VALIDATION_LIMITS.PROFILE_NAME_MAX) {
    return { valid: false, error: `Profile name must be ${VALIDATION_LIMITS.PROFILE_NAME_MAX} characters or less` };
  }
  
  if (/<script|javascript:|on\w+\s*=/i.test(trimmed)) {
    return { valid: false, error: "Invalid characters in profile name" };
  }
  
  return { valid: true };
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
    const body: CreateProfileRequest = await req.json();
    
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const nameValidation = validateProfileName(body.name);
    if (!nameValidation.valid) {
      return new Response(
        JSON.stringify({ error: nameValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const sanitizedName = sanitizeText(body.name, VALIDATION_LIMITS.PROFILE_NAME_MAX);
    const sanitizedDesc = body.description 
      ? sanitizeText(body.description, VALIDATION_LIMITS.PROFILE_DESC_MAX)
      : null;
    
    const visibility = body.visibility === "public" ? "public" : "private";

    // Create profile
    const { data, error } = await supabaseClient
      .from("profiles")
      .insert({
        owner_id: user.id,
        name: sanitizedName,
        description: sanitizedDesc,
        visibility,
        image_data: body.imageUrl || null,
      })
      .select("id, owner_id, name, description, visibility, punch_count, hug_count, kiss_count, notes_count, created_at")
      .single();

    if (error) {
      console.error("Error creating profile:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful creation
    console.log(`Profile created: ${data.id} by user ${user.id}`);

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
