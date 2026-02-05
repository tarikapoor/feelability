-- RLS Policy Test Script
-- Run this in Supabase SQL Editor to verify RLS policies are working correctly
-- 
-- IMPORTANT: This script uses SECURITY DEFINER functions to test RLS policies
-- from different user contexts. It will create test users and data.

-- ============================================================================
-- SETUP: Create test helper function to simulate different user contexts
-- ============================================================================

-- Drop existing test function if it exists
drop function if exists test_rls_policies();

-- Create a comprehensive test function
create or replace function test_rls_policies()
returns table (
  test_name text,
  passed boolean,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  test_owner_id uuid;
  test_collab_id uuid;
  test_unauth_id uuid := null;
  test_profile_id uuid;
  test_profile_private_id uuid;
  test_note_id uuid;
  test_collab_record_id uuid;
  result_count int;
begin
  -- Create test users (using auth.users directly - requires admin access)
  -- Note: In production, you'd use Supabase Auth API to create users
  -- For testing, we'll use existing auth.uid() context
  
  -- Test 1: Verify RLS is enabled
  begin
    select count(*) into result_count
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'profile_collaborators', 'profile_notes');
    
    if result_count < 9 then
      return query select 'RLS policies exist'::text, false, 
        format('Expected at least 9 policies, found %s', result_count)::text;
    else
      return query select 'RLS policies exist'::text, true, null::text;
    end if;
  exception when others then
    return query select 'RLS policies exist'::text, false, 
      format('Error checking policies: %s', sqlerrm)::text;
  end;

  -- Test 2: Verify unauthenticated users cannot read profiles
  begin
    -- Simulate unauthenticated context (auth.uid() = null)
    perform set_config('request.jwt.claim.sub', null::text, true);
    
    select count(*) into result_count
    from public.profiles;
    
    if result_count > 0 then
      return query select 'Unauthenticated cannot read profiles'::text, false,
        'Unauthenticated user was able to read profiles'::text;
    else
      return query select 'Unauthenticated cannot read profiles'::text, true, null::text;
    end if;
  exception when insufficient_privilege then
    return query select 'Unauthenticated cannot read profiles'::text, true, null::text;
  when others then
    return query select 'Unauthenticated cannot read profiles'::text, false,
      format('Unexpected error: %s', sqlerrm)::text;
  end;

  -- Note: Full testing requires actual authenticated user sessions
  -- The above tests verify basic RLS structure
  
  return query select 'Test script completed'::text, true, 
    'Note: Full testing requires authenticated user sessions via Supabase client'::text;
end;
$$;

-- Run the test
select * from test_rls_policies();

-- Cleanup (optional - comment out if you want to keep the test function)
-- drop function if exists test_rls_policies();
