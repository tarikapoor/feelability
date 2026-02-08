/**
 * End-to-End Encryption utilities for Notes
 * Uses AES-256-GCM for content encryption and ECDH for key exchange.
 * All keys and plaintext stay client-side; only ciphertext goes to Supabase.
 */

const PROFILE_KEYS_DB = "feelability-e2ee";
const PROFILE_KEYS_STORE = "profile-keys";
const USER_KEYS_STORE = "user-keys";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

// ---------------------------------------------------------------------------
// IndexedDB helpers for client-side key storage
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PROFILE_KEYS_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROFILE_KEYS_STORE)) {
        db.createObjectStore(PROFILE_KEYS_STORE, { keyPath: "profileId" });
      }
      if (!db.objectStoreNames.contains(USER_KEYS_STORE)) {
        db.createObjectStore(USER_KEYS_STORE, { keyPath: "userId" });
      }
    };
  });
}

export async function getProfileKey(profileId: string, userId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_KEYS_STORE, "readonly");
    const store = tx.objectStore(PROFILE_KEYS_STORE);
    const req = store.get(profileId);
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec?.rawKey) {
        resolve(null);
        return;
      }
      crypto.subtle
        .importKey("jwk", rec.rawKey, { name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"])
        .then(resolve)
        .catch(reject);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function setProfileKey(profileId: string, key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey("jwk", key);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_KEYS_STORE, "readwrite");
    const store = tx.objectStore(PROFILE_KEYS_STORE);
    store.put({ profileId, rawKey: raw });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeProfileKey(profileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_KEYS_STORE, "readwrite");
    const store = tx.objectStore(PROFILE_KEYS_STORE);
    store.delete(profileId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// User keypair (for receiving wrapped profile keys)
// ---------------------------------------------------------------------------

export async function getOrCreateUserKeyPair(userId: string): Promise<{
  publicKey: JsonWebKey;
  privateKey: CryptoKey;
}> {
  const db = await openDB();
  const existing = await new Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined>((resolve, reject) => {
    const tx = db.transaction(USER_KEYS_STORE, "readonly");
    const req = tx.objectStore(USER_KEYS_STORE).get(userId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });

  if (existing) {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      existing.privateKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
    return { publicKey: existing.publicKey, privateKey };
  }

  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );

  const pubJwk = await crypto.subtle.exportKey("jwk", publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", privateKey);

  const db2 = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(USER_KEYS_STORE, "readwrite");
    tx.objectStore(USER_KEYS_STORE).put({ userId, publicKey: pubJwk, privateKey: privJwk });
    tx.oncomplete = () => {
      db2.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });

  return { publicKey: pubJwk!, privateKey };
}

export async function getUserPublicKeyJwk(userId: string): Promise<JsonWebKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USER_KEYS_STORE, "readonly");
    const req = tx.objectStore(USER_KEYS_STORE).get(userId);
    req.onsuccess = () => resolve(req.result?.publicKey ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

// ---------------------------------------------------------------------------
// Profile key generation
// ---------------------------------------------------------------------------

export async function generateProfileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------------------
// Wrap profile key for a collaborator (encrypt with their public key)
// ---------------------------------------------------------------------------

export async function wrapProfileKeyForUser(
  profileKey: CryptoKey,
  recipientPublicKeyJwk: JsonWebKey
): Promise<string> {
  const recipientKey = await crypto.subtle.importKey(
    "jwk",
    recipientPublicKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", profileKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientKey,
    raw
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// ---------------------------------------------------------------------------
// Unwrap profile key (decrypt with own private key)
// ---------------------------------------------------------------------------

export async function unwrapProfileKey(
  wrappedBase64: string,
  userPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const bin = Uint8Array.from(atob(wrappedBase64), (c) => c.charCodeAt(0));
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, userPrivateKey, bin);
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt note content
// ---------------------------------------------------------------------------

export async function encryptNote(plaintext: string, profileKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    profileKey,
    encoded
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptNote(ciphertext: string, iv: string, profileKey: CryptoKey): Promise<string> {
  const ctBin = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const ivBin = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBin, tagLength: TAG_LENGTH },
    profileKey,
    ctBin
  );
  return new TextDecoder().decode(decrypted);
}

// ---------------------------------------------------------------------------
// Check if Web Crypto and IndexedDB are available
// ---------------------------------------------------------------------------

export function isE2EEAvailable(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle && !!window.indexedDB;
}
