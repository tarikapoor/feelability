# RLS Policy Testing Guide

This directory contains test scripts to verify Row Level Security (RLS) policies are working correctly.

## Files

- `test-rls.sql` - SQL test script for direct policy verification (run in Supabase SQL Editor)
- `test-rls.ts` - TypeScript test script for application-level testing (run with Node.js)

## Quick Start

### Option 1: SQL Test (Simpler)

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `test-rls.sql`
4. Run the script
5. Review the results

**Note:** The SQL test is limited because it can't fully simulate different user contexts. For comprehensive testing, use the TypeScript test.

### Option 2: TypeScript Test (Comprehensive)

#### Prerequisites

1. Install dependencies:
   ```bash
   npm install @supabase/supabase-js tsx
   ```

2. Create test users in Supabase Auth:
   - Go to Authentication → Users → Add User
   - Create these test accounts:
     - `owner@test.com` / `password123`
     - `collaborator@test.com` / `password123`
     - `other@test.com` / `password123`

3. Set environment variables:
   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   ```

#### Run Tests

```bash
npx tsx supabase/test-rls.ts
```

## What Gets Tested

### ✅ Unauthenticated Access
- Cannot read profiles
- Cannot create profiles
- Cannot read notes

### ✅ Owner Access
- Can create own profiles
- Can read own profiles
- Can update own profiles
- Can delete own profiles
- Can create notes on own profiles
- Can delete own notes

### ✅ Collaborator Access
- Can add self to public profiles
- Can read public profiles they collaborate on
- Can create notes on public profiles they collaborate on
- Can delete own notes
- Cannot delete profiles (even if collaborator)

### ✅ Unauthorized Access (ID Guessing)
- Cannot read private profiles of other users
- Cannot update private profiles of other users
- Cannot access profiles via ID guessing

## Expected Results

All tests should pass ✅. If any test fails:

1. Check that RLS is enabled on all tables:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename IN ('profiles', 'profile_collaborators', 'profile_notes');
   ```

2. Verify policies exist:
   ```sql
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('profiles', 'profile_collaborators', 'profile_notes');
   ```

3. Re-run `supabase/schema.sql` to ensure policies are correct

## Troubleshooting

### "Policy does not exist" errors
- Run `supabase/schema.sql` again (it's idempotent)

### "Permission denied" errors
- Verify RLS is enabled: `SELECT * FROM pg_tables WHERE tablename = 'profiles';`
- Check that policies are created: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

### Tests pass but app doesn't work
- Check that frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not service role key)
- Verify user is authenticated: `await supabase.auth.getUser()`
- Check browser console for RLS errors

## Manual Testing Checklist

After running automated tests, manually verify:

- [ ] Logged-in user can create/edit/delete own profiles
- [ ] Logged-in user can add notes to own profiles
- [ ] Collaborator can access shared public profile via link
- [ ] Collaborator can add notes to shared public profile
- [ ] Collaborator cannot delete shared profile
- [ ] Logged-out user sees guest mode (no Supabase queries)
- [ ] Private profiles are not accessible via ID guessing
- [ ] Only note author can delete their own notes

## Security Verification

✅ **No service role keys in frontend code**
- Search codebase: `grep -r "service_role" .`
- Should return no results (except in test files or `.env.local`)

✅ **All tables have RLS enabled**
- Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;`
- Should return no tables (or only system tables)

✅ **Unauthenticated access blocked**
- Test in incognito mode (logged out)
- Should not be able to query any tables
