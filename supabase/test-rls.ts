/**
 * RLS Policy Test Script
 * 
 * This script tests Row Level Security policies from the application perspective.
 * Run this with: npx tsx supabase/test-rls.ts
 * 
 * Prerequisites:
 * 1. Set environment variables in .env.local:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * 2. Create test users in Supabase Auth:
 *    - owner@test.com / password123
 *    - collaborator@test.com / password123
 *    - other@test.com / password123
 * 
 * Or modify the script to use your own test accounts.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local file
try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.warn("⚠️  Could not load .env.local file, using process.env");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}${error ? `: ${error}` : ""}`);
}

async function testUnauthenticatedAccess() {
  console.log("\n=== Testing Unauthenticated Access ===");
  
  const unauthedClient = createClient(supabaseUrl, supabaseAnonKey);
  
  // Test: Cannot read profiles
  const { data: profiles, error: profilesError } = await unauthedClient
    .from("profiles")
    .select("*")
    .limit(1);
  
  if (profiles && profiles.length > 0) {
    logTest("Unauthenticated cannot read profiles", false, "Was able to read profiles");
  } else {
    logTest("Unauthenticated cannot read profiles", true);
  }
  
  // Test: Cannot create profiles
  const { error: createError } = await unauthedClient
    .from("profiles")
    .insert({ name: "Test Profile", owner_id: "00000000-0000-0000-0000-000000000000" });
  
  if (createError && createError.code === "42501") {
    logTest("Unauthenticated cannot create profiles", true);
  } else {
    logTest("Unauthenticated cannot create profiles", false, `Unexpected: ${createError?.message}`);
  }
  
  // Test: Cannot read notes
  const { data: notes } = await unauthedClient
    .from("profile_notes")
    .select("*")
    .limit(1);
  
  if (notes && notes.length > 0) {
    logTest("Unauthenticated cannot read notes", false, "Was able to read notes");
  } else {
    logTest("Unauthenticated cannot read notes", true);
  }
}

async function testOwnerAccess(ownerClient: ReturnType<typeof createClient>) {
  console.log("\n=== Testing Owner Access ===");
  
  // Create a test profile
  const { data: newProfile, error: createError } = await ownerClient
    .from("profiles")
    .insert({
      name: "Test Profile " + Date.now(),
      description: "Test description",
      visibility: "private",
    })
    .select()
    .single();
  
  if (createError || !newProfile) {
    logTest("Owner can create profile", false, createError?.message);
    return null;
  }
  logTest("Owner can create profile", true);
  
  const profileId = newProfile.id;
  
  // Test: Owner can read own profile
  const { data: readProfile, error: readError } = await ownerClient
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  
  if (readError || !readProfile) {
    logTest("Owner can read own profile", false, readError?.message);
  } else {
    logTest("Owner can read own profile", true);
  }
  
  // Test: Owner can update own profile
  const { error: updateError } = await ownerClient
    .from("profiles")
    .update({ description: "Updated description" })
    .eq("id", profileId);
  
  if (updateError) {
    logTest("Owner can update own profile", false, updateError.message);
  } else {
    logTest("Owner can update own profile", true);
  }
  
  // Test: Owner can create note
  const { data: newNote, error: noteError } = await ownerClient
    .from("profile_notes")
    .insert({
      profile_id: profileId,
      text: "Test note",
      emotion_type: "feelings",
    })
    .select()
    .single();
  
  if (noteError || !newNote) {
    logTest("Owner can create note", false, noteError?.message);
  } else {
    logTest("Owner can create note", true);
  }
  
  // Test: Owner can delete own profile
  const { error: deleteError } = await ownerClient
    .from("profiles")
    .delete()
    .eq("id", profileId);
  
  if (deleteError) {
    logTest("Owner can delete own profile", false, deleteError.message);
  } else {
    logTest("Owner can delete own profile", true);
  }
  
  return profileId;
}

async function testCollaboratorAccess(
  ownerClient: ReturnType<typeof createClient>,
  collabClient: ReturnType<typeof createClient>
) {
  console.log("\n=== Testing Collaborator Access ===");
  
  // Owner creates a public profile
  const { data: publicProfile, error: createError } = await ownerClient
    .from("profiles")
    .insert({
      name: "Public Profile " + Date.now(),
      visibility: "public",
    })
    .select()
    .single();
  
  if (createError || !publicProfile) {
    logTest("Setup: Owner creates public profile", false, createError?.message);
    return;
  }
  logTest("Setup: Owner creates public profile", true);
  
  const profileId = publicProfile.id;
  
  // Collaborator adds themselves
  const { error: addCollabError } = await collabClient
    .from("profile_collaborators")
    .insert({
      profile_id: profileId,
      user_id: (await collabClient.auth.getUser()).data.user!.id,
    });
  
  if (addCollabError) {
    logTest("Collaborator can add self to public profile", false, addCollabError.message);
  } else {
    logTest("Collaborator can add self to public profile", true);
  }
  
  // Test: Collaborator can read public profile
  const { data: readProfile, error: readError } = await collabClient
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  
  if (readError || !readProfile) {
    logTest("Collaborator can read public profile", false, readError?.message);
  } else {
    logTest("Collaborator can read public profile", true);
  }
  
  // Test: Collaborator can create note
  const { data: collabNote, error: noteError } = await collabClient
    .from("profile_notes")
    .insert({
      profile_id: profileId,
      text: "Collaborator note",
      emotion_type: "appreciation",
    })
    .select()
    .single();
  
  if (noteError || !collabNote) {
    logTest("Collaborator can create note", false, noteError?.message);
  } else {
    logTest("Collaborator can create note", true);
    
    // Test: Collaborator can delete own note
    const { error: deleteNoteError } = await collabClient
      .from("profile_notes")
      .delete()
      .eq("id", collabNote.id);
    
    if (deleteNoteError) {
      logTest("Collaborator can delete own note", false, deleteNoteError.message);
    } else {
      logTest("Collaborator can delete own note", true);
    }
  }
  
  // Test: Collaborator cannot delete profile
  const { error: deleteProfileError } = await collabClient
    .from("profiles")
    .delete()
    .eq("id", profileId);
  
  if (deleteProfileError) {
    logTest("Collaborator cannot delete profile", true);
  } else {
    logTest("Collaborator cannot delete profile", false, "Was able to delete profile");
  }
  
  // Cleanup: Owner deletes profile
  await ownerClient.from("profiles").delete().eq("id", profileId);
}

async function testUnauthorizedAccess(
  ownerClient: ReturnType<typeof createClient>,
  otherClient: ReturnType<typeof createClient>
) {
  console.log("\n=== Testing Unauthorized Access (ID Guessing) ===");
  
  // Owner creates private profile
  const { data: privateProfile, error: createError } = await ownerClient
    .from("profiles")
    .insert({
      name: "Private Profile " + Date.now(),
      visibility: "private",
    })
    .select()
    .single();
  
  if (createError || !privateProfile) {
    logTest("Setup: Owner creates private profile", false, createError?.message);
    return;
  }
  logTest("Setup: Owner creates private profile", true);
  
  const profileId = privateProfile.id;
  
  // Other user tries to access private profile
  const { data: unauthorizedRead, error: readError } = await otherClient
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  
  if (unauthorizedRead) {
    logTest("Other user cannot read private profile", false, "Was able to read private profile");
  } else {
    logTest("Other user cannot read private profile", true);
  }
  
  // Other user tries to update private profile
  const { error: updateError } = await otherClient
    .from("profiles")
    .update({ name: "Hacked" })
    .eq("id", profileId);
  
  if (updateError) {
    logTest("Other user cannot update private profile", true);
  } else {
    logTest("Other user cannot update private profile", false, "Was able to update private profile");
  }
  
  // Cleanup
  await ownerClient.from("profiles").delete().eq("id", profileId);
}

async function main() {
  console.log("🔒 RLS Policy Test Suite\n");
  console.log("Make sure you have created test users:");
  console.log("  - owner@test.com / password123");
  console.log("  - collaborator@test.com / password123");
  console.log("  - other@test.com / password123\n");
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Missing environment variables:");
    console.error("   NEXT_PUBLIC_SUPABASE_URL");
    console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  
  // Test unauthenticated access
  await testUnauthenticatedAccess();
  
  // Test owner access
  const ownerClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: ownerAuth, error: ownerAuthError } = await ownerClient.auth.signInWithPassword({
    email: "owner@test.com",
    password: "password123",
  });
  
  if (ownerAuthError || !ownerAuth.user) {
    console.log("\n⚠️  Skipping authenticated tests - could not sign in as owner");
    console.log(`   Error: ${ownerAuthError?.message}`);
    console.log("   Create test user: owner@test.com / password123");
  } else {
    await testOwnerAccess(ownerClient);
    
    // Test collaborator access
    const collabClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: collabAuth, error: collabAuthError } = await collabClient.auth.signInWithPassword({
      email: "collaborator@test.com",
      password: "password123",
    });
    
    if (collabAuthError || !collabAuth.user) {
      console.log("\n⚠️  Skipping collaborator tests - could not sign in as collaborator");
      console.log(`   Error: ${collabAuthError?.message}`);
      console.log("   Create test user: collaborator@test.com / password123");
    } else {
      await testCollaboratorAccess(ownerClient, collabClient);
      
      // Test unauthorized access
      const otherClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: otherAuth, error: otherAuthError } = await otherClient.auth.signInWithPassword({
        email: "other@test.com",
        password: "password123",
      });
      
      if (otherAuthError || !otherAuth.user) {
        console.log("\n⚠️  Skipping unauthorized access tests - could not sign in as other user");
        console.log(`   Error: ${otherAuthError?.message}`);
        console.log("   Create test user: other@test.com / password123");
      } else {
        await testUnauthorizedAccess(ownerClient, otherClient);
      }
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`   - ${r.name}${r.error ? `: ${r.error}` : ""}`);
    });
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ Test suite error:", error);
  process.exit(1);
});
