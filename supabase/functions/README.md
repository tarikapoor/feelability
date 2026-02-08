# Supabase Edge Functions

These Edge Functions provide secure, rate-limited endpoints for sensitive operations.

## Functions

### `create-profile`
- **Purpose**: Create a new profile with validation and rate limiting
- **Rate Limit**: 5 requests per minute per user
- **Validation**: Name (1-30 chars), description (0-50 chars), sanitization
- **Auth**: Required (JWT token)

### `create-note`
- **Purpose**: Create a note with validation and rate limiting
- **Rate Limit**: 20 requests per minute per user
- **Validation**: Text (1-5000 chars), emotion type, profile access check
- **Auth**: Required (JWT token)

## Deployment

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-profile
supabase functions deploy create-note
```

## Environment Variables

Set in Supabase Dashboard → Edge Functions → Settings:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key

## Usage

### Create Profile
```typescript
const { data, error } = await supabase.functions.invoke('create-profile', {
  body: {
    name: "Profile Name",
    description: "Optional description",
    visibility: "public" | "private",
    imageUrl: "https://..."
  }
});
```

### Create Note
```typescript
const { data, error } = await supabase.functions.invoke('create-note', {
  body: {
    profileId: "uuid",
    text: "Note text",
    emotionType: "anger" | "feelings" | "appreciation"
  }
});
```

## Rate Limiting

Rate limits are enforced per user ID. Exceeding limits returns HTTP 429.

## Security Features

- ✅ Authentication required
- ✅ Input validation and sanitization
- ✅ Rate limiting
- ✅ Access control checks
- ✅ Request size limits
- ✅ Error logging

## Production Recommendations

1. **Use Redis for rate limiting**: Replace in-memory store with Redis
2. **Add monitoring**: Integrate with Supabase Logs or external monitoring
3. **Add request ID tracking**: For better debugging
4. **Add IP-based rate limiting**: Additional layer of protection
5. **Add request body size limits**: Prevent DoS attacks
