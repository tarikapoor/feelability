# End-to-End Encryption for Notes

## Overview

Notes are encrypted client-side before being stored in Supabase. Only the note writer and approved collaborators can decrypt and view note content. The backend never sees plaintext.

## How It Works

1. **Profile key**: Each profile has a symmetric AES-256-GCM key generated when the owner creates or first loads the profile.
2. **Key storage**: Profile keys are stored only in IndexedDB on the client. They are never sent to Supabase.
3. **Key sharing**: When a collaborator is added, the owner's client encrypts the profile key with the collaborator's public key and stores the wrapped key in `profile_key_shares`.
4. **Encryption**: Note content is encrypted with the profile key before insertion. Only `ciphertext` and `iv` are stored in the database.
5. **Decryption**: On load, the client fetches encrypted rows, unwraps the profile key (if needed), and decrypts locally.

## Setup

### 1. Run the E2EE schema migration

In Supabase SQL Editor, run the contents of:

```
supabase/migrations/e2ee-schema.sql
```

This adds:
- `ciphertext` and `iv` columns to `profile_notes`
- `user_encryption_keys` table (user public keys)
- `profile_key_shares` table (wrapped profile keys per collaborator)
- RLS policies for the new tables

### 2. Make `text` nullable (if needed)

If you see an error about `text` not null, run:

```sql
alter table public.profile_notes alter column text drop not null;
```

## Compatibility

- **Web (desktop)**: Full support
- **Mobile web**: Full support (IndexedDB and Web Crypto are available)
- **Legacy notes**: Existing plaintext notes continue to work; new notes use E2EE
- **Guest mode**: No E2EE; notes stay local-only

## Access Revocation

When a collaborator is removed:
- Their row is deleted from `profile_key_shares`
- They can no longer fetch the profile key
- Previously synced notes may remain decrypted in their local cache until they refresh
- Keys are device-bound; switching devices means keys are not available on the new device

## Key Management Notes

- **Device-bound**: Profile keys are stored in IndexedDB. Clearing site data or using a new device means existing encrypted notes cannot be decrypted on that device.
- **No password recovery**: There is no server-side key backup. This is intentional for E2EE.
