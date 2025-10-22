/**
 * Security utilities for input sanitization and validation
 */

/**
 * Escape special regex characters to prevent regex injection
 * @param {string} input - The input string to escape
 * @returns {string} - Escaped string safe for regex use
 */
export const escapeRegex = (input) => {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Escape special regex characters
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize search input for database queries
 * @param {string} search - The search term
 * @returns {string} - Sanitized search term
 */
export const sanitizeSearchInput = (search) => {
    if (typeof search !== 'string') {
        return '';
    }
    
    // Trim whitespace and limit length
    const trimmed = search.trim();
    if (trimmed.length === 0) {
        return '';
    }
    
    // Limit search length to prevent DoS
    const limited = trimmed.substring(0, 100);
    
    // Escape regex characters
    return escapeRegex(limited);
};

/**
 * Validate and sanitize email input
 * @param {string} email - Email to validate
 * @returns {string|null} - Sanitized email or null if invalid
 */
export const sanitizeEmail = (email) => {
    if (typeof email !== 'string') {
        return null;
    }
    
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
        return null;
    }
    
    return trimmed;
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
export const isValidObjectId = (id) => {
    if (typeof id !== 'string') {
        return false;
    }
    
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
};

/**
 * Sanitize string input for database storage
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (input, maxLength = 1000) => {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Remove potentially dangerous characters
    const sanitized = input
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim();
    
    // Limit length
    return sanitized.substring(0, maxLength);
};

/**
 * Rate limiting helper
 * @param {string} key - Rate limit key (usually IP or user ID)
 * @param {number} limit - Request limit
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - True if within limits
 */
export const checkRateLimit = (key, limit = 100, windowMs = 15 * 60 * 1000) => {
    // This is a simple in-memory rate limiter
    // In production, use Redis or similar
    if (!global.rateLimitStore) {
        global.rateLimitStore = new Map();
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [k, v] of global.rateLimitStore.entries()) {
        if (v.timestamp < windowStart) {
            global.rateLimitStore.delete(k);
        }
    }
    
    const entry = global.rateLimitStore.get(key);
    
    if (!entry) {
        global.rateLimitStore.set(key, { count: 1, timestamp: now });
        return true;
    }
    
    if (entry.timestamp < windowStart) {
        global.rateLimitStore.set(key, { count: 1, timestamp: now });
        return true;
    }
    
    if (entry.count >= limit) {
        return false;
    }
    
    entry.count++;
    return true;
};
