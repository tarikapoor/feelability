/**
 * Security utilities for input validation, sanitization, and rate limiting
 */

// Input validation constants
export const VALIDATION_LIMITS = {
  PROFILE_NAME_MAX: 30,
  PROFILE_DESC_MAX: 50,
  NOTE_TEXT_MAX: 5000,
  MIN_TEXT_LENGTH: 1,
} as const;

// Rate limiting (client-side checks - backend must also enforce)
export const RATE_LIMITS = {
  PROFILE_CREATE_PER_MINUTE: 5,
  NOTE_CREATE_PER_MINUTE: 20,
  PROFILE_UPDATE_PER_MINUTE: 30,
  ACTION_PER_MINUTE: 100,
} as const;

/**
 * Sanitize text input to prevent XSS and injection attacks
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") return "";
  
  return text
    .trim()
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    // Limit length to prevent DoS
    .slice(0, VALIDATION_LIMITS.NOTE_TEXT_MAX);
}

/**
 * Validate profile name
 */
export function validateProfileName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Profile name is required" };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < VALIDATION_LIMITS.MIN_TEXT_LENGTH) {
    return { valid: false, error: "Profile name must be at least 1 character" };
  }
  
  if (trimmed.length > VALIDATION_LIMITS.PROFILE_NAME_MAX) {
    return { valid: false, error: `Profile name must be ${VALIDATION_LIMITS.PROFILE_NAME_MAX} characters or less` };
  }
  
  // Check for potentially dangerous patterns
  if (/<script|javascript:|on\w+\s*=/i.test(trimmed)) {
    return { valid: false, error: "Invalid characters in profile name" };
  }
  
  return { valid: true };
}

/**
 * Validate profile description
 */
export function validateProfileDescription(desc: string | null | undefined): { valid: boolean; error?: string } {
  if (!desc) return { valid: true }; // Optional field
  
  if (typeof desc !== "string") {
    return { valid: false, error: "Description must be text" };
  }
  
  if (desc.length > VALIDATION_LIMITS.PROFILE_DESC_MAX) {
    return { valid: false, error: `Description must be ${VALIDATION_LIMITS.PROFILE_DESC_MAX} characters or less` };
  }
  
  return { valid: true };
}

/**
 * Validate note text
 */
export function validateNoteText(text: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Note text is required" };
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length < VALIDATION_LIMITS.MIN_TEXT_LENGTH) {
    return { valid: false, error: "Note must contain text" };
  }
  
  if (trimmed.length > VALIDATION_LIMITS.NOTE_TEXT_MAX) {
    return { valid: false, error: `Note must be ${VALIDATION_LIMITS.NOTE_TEXT_MAX} characters or less` };
  }
  
  return { valid: true };
}

/**
 * Validate emotion type
 */
export function validateEmotionType(type: string): type is "anger" | "feelings" | "appreciation" {
  return ["anger", "feelings", "appreciation"].includes(type);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Client-side rate limiting (backend must also enforce)
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  /**
   * Check if action is allowed based on rate limit
   */
  checkLimit(key: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const timestamps = this.requests.get(key) || [];
    const recentRequests = timestamps.filter((ts) => ts > oneMinuteAgo);
    
    if (recentRequests.length >= maxPerMinute) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    // Cleanup old entries
    if (recentRequests.length === 1) {
      setTimeout(() => {
        const current = this.requests.get(key);
        if (current) {
          const filtered = current.filter((ts) => ts > Date.now() - 60000);
          if (filtered.length === 0) {
            this.requests.delete(key);
          } else {
            this.requests.set(key, filtered);
          }
        }
      }, 61000);
    }
    
    return true;
  }
  
  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Get rate limit key for a user
 */
export function getRateLimitKey(userId: string | null, action: string): string {
  return userId ? `${userId}:${action}` : `anonymous:${action}`;
}
