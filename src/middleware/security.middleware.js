/**
 * Security middleware for input sanitization and validation
 */

import { sanitizeSearchInput, sanitizeString, checkRateLimit } from '../utils/security.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Sanitize search parameters in query strings
 */
export const sanitizeSearchParams = (req, res, next) => {
    if (req.query.search) {
        req.query.search = sanitizeSearchInput(req.query.search);
    }
    
    if (req.query.q) {
        req.query.q = sanitizeSearchInput(req.query.q);
    }
    
    next();
};

/**
 * Sanitize string inputs in request body
 */
export const sanitizeStringInputs = (req, res, next) => {
    if (req.body) {
        // Sanitize common string fields
        const stringFields = ['name', 'description', 'message', 'subject', 'notes', 'feedback'];
        
        for (const field of stringFields) {
            if (req.body[field] && typeof req.body[field] === 'string') {
                req.body[field] = sanitizeString(req.body[field], 1000);
            }
        }
    }
    
    next();
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // limit each IP to 100 requests per windowMs
        message = 'Too many requests from this IP, please try again later.'
    } = options;
    
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        
        if (!checkRateLimit(key, max, windowMs)) {
            return res.status(429).json({
                success: false,
                message: message,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
        
        next();
    };
};

/**
 * Enhanced rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 login attempts per windowMs (increased for production)
    message: 'Too many authentication attempts, please try again later.'
});

/**
 * More lenient rate limiting for authentication endpoints (for production)
 */
export const lenientAuthRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 login attempts per windowMs (increased for development)
    message: 'Too many authentication attempts, please try again later.'
});

/**
 * Development-friendly rate limiting for authentication endpoints
 */
export const devAuthRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 login attempts per windowMs (for development)
    message: 'Too many authentication attempts, please try again later.'
});

/**
 * Environment-aware rate limiting for authentication endpoints
 */
export const smartDevAuthRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 200, // More lenient in development
    message: 'Too many authentication attempts, please try again later.'
});

/**
 * Rate limiting that bypasses for admin users
 */
export const smartAuthRateLimit = (req, res, next) => {
    // Check if user is already authenticated and is admin
    if (req.user && req.user.role === 'admin') {
        return next(); // Skip rate limiting for admin users
    }
    
    // Apply normal rate limiting for others
    return authRateLimit(req, res, next);
};

/**
 * Clear rate limit for a specific IP (admin only)
 */
export const clearRateLimit = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (global.rateLimitStore && global.rateLimitStore.has(ip)) {
        global.rateLimitStore.delete(ip);
    }
    
    next();
};

/**
 * Clear all rate limits (development only)
 */
export const clearAllRateLimits = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        if (global.rateLimitStore) {
            global.rateLimitStore.clear();
        }
    }
    
    next();
};

/**
 * Get rate limit status
 */
export const getRateLimitStatus = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        const ip = req.ip || req.connection.remoteAddress;
        const status = {
            ip: ip,
            rateLimitStore: global.rateLimitStore ? Array.from(global.rateLimitStore.entries()) : [],
            totalEntries: global.rateLimitStore ? global.rateLimitStore.size : 0
        };
        
        return res.json({
            success: true,
            data: status
        });
    }
    
    next();
};

/**
 * Enhanced rate limiting for API endpoints
 */
export const apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many API requests, please try again later.'
});

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict Transport Security (HTTPS only)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://api.razorpay.com; " +
        "frame-src https://checkout.razorpay.com;"
    );
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
};

/**
 * Request size limiting
 */
export const requestSizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxBytes = parseSize(maxSize);
        
        if (contentLength > maxBytes) {
            return res.status(413).json({
                success: false,
                message: 'Request entity too large'
            });
        }
        
        next();
    };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
    const units = {
        'b': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };
    
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
    if (!match) {
        return 10 * 1024 * 1024; // Default 10MB
    }
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    return Math.floor(value * units[unit]);
}
