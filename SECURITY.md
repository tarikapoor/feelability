# Security Documentation

This document outlines the security measures implemented in the Feelability application.

## Overview

The application implements multiple layers of security to protect against unauthorized access, abuse, and data leaks.

## Security Layers

### 1. Row Level Security (RLS)

All database tables have RLS enabled with strict policies:

- **profiles**: Owners can manage their own profiles. Authenticated users can read public profiles or profiles they collaborate on.
- **profile_collaborators**: Users can view their own collaborator records. Owners can manage collaborators for their profiles.
- **profile_notes**: Owners and collaborators can read/write notes. Only note authors can delete their own notes.

**See**: `supabase/schema.sql` for complete RLS policies.

### 2. Environment Variables & Secrets

- ✅ Only `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed on the client
- ✅ No service role keys in frontend code
- ✅ All secrets stored in environment variables (`.env.local`)
- ✅ Service role key (if used) only in server-side Edge Functions

**Verification**:
```bash
grep -r "service_role" . --exclude-dir=node_modules
# Should return no results (except in test files)
```

### 3. Input Validation & Sanitization

All user inputs are validated and sanitized before processing:

- **Profile names**: 1-30 characters, sanitized for XSS prevention
- **Profile descriptions**: 0-50 characters, sanitized
- **Note text**: 1-5000 characters, sanitized
- **Emotion types**: Validated against allowed values
- **UUIDs**: Validated format before database queries

**See**: `lib/security.ts` for validation functions.

### 4. Rate Limiting

Client-side rate limiting prevents abuse:

- **Profile creation**: 5 per minute per user
- **Note creation**: 20 per minute per user
- **Profile updates**: 30 per minute per user
- **Actions**: 100 per minute per user

**Note**: Edge Functions implement server-side rate limiting for additional protection.

**See**: `lib/security.ts` for rate limiting implementation.

### 5. Query Limits

All database queries have explicit limits to prevent data scraping:

- **Profiles**: Maximum 100 per query
- **Notes**: Maximum 50 per query
- **Collaborators**: Maximum 50 per query

**See**: `lib/query-helpers.ts` for query limit constants.

### 6. Authentication Checks

All write operations require authentication:

- ✅ Profile creation/update/delete: Requires authenticated user
- ✅ Note creation/deletion: Requires authenticated user
- ✅ Collaborator management: Requires authenticated user
- ✅ Guest mode: Uses local-only state, no database access

**Verification**: RLS policies enforce authentication at the database level.

### 7. Edge Functions (Optional)

For enhanced security, sensitive operations can use Edge Functions:

- `create-profile`: Validates input, enforces rate limiting, creates profile securely
- `create-note`: Validates input, enforces rate limiting, creates note securely

**See**: `supabase/functions/` for Edge Function implementations.

### 8. Data Exposure Hardening

- ✅ SELECT queries specify exact columns (no `SELECT *`)
- ✅ Query limits prevent mass data retrieval
- ✅ Pagination-ready queries (using `.range()`)
- ✅ No listing of all rows without limits

### 9. Frontend Safety

- ✅ Input validation before sending to backend
- ✅ Text sanitization to prevent XSS/injection
- ✅ Client-side rate limiting
- ✅ Backend re-validates all inputs (RLS + Edge Functions)

### 10. Logging & Monitoring

- ✅ Edge Functions log successful operations
- ✅ Error logging for failed operations
- ✅ Rate limit violations logged
- ✅ Failed auth attempts logged

**Note**: For production, integrate with Supabase Logs or external monitoring service.

## Security Checklist

### Before Deployment

- [ ] Verify RLS is enabled on all tables
- [ ] Confirm no service role keys in frontend code
- [ ] Test rate limiting works correctly
- [ ] Verify input validation on all forms
- [ ] Test unauthenticated access is blocked
- [ ] Verify query limits are enforced
- [ ] Check Edge Functions are deployed (if using)
- [ ] Review Supabase logs for suspicious activity

### Ongoing Monitoring

- [ ] Monitor failed authentication attempts
- [ ] Track rate limit violations
- [ ] Review error logs regularly
- [ ] Monitor for unusual access patterns
- [ ] Keep dependencies updated

## Testing

Run security tests:

```bash
npm run test:rls
```

This tests:
- ✅ Unauthenticated access is blocked
- ✅ Owner access works correctly
- ✅ Collaborator access works correctly
- ✅ Unauthorized access is blocked

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
