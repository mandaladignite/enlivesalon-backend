import { ApiError } from "../utils/ApiError.js";

export const errorHandler = (err, req, res, next) => {
    // Enhanced logging with request context
    const errorContext = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?._id,
        error: {
            name: err.name,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    };
    
    console.error('Error occurred:', errorContext);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: Object.values(err.errors).map(error => ({
                field: error.path,
                message: error.message,
                value: error.value
            })),
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            success: false,
            message: `${field} already exists`,
            errors: [{
                field: field,
                message: `${field} must be unique`,
                value: err.keyValue[field]
            }],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle MongoDB cast errors
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
            errors: [{
                field: err.path,
                message: "Invalid ID format",
                value: err.value
            }],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle MongoDB timeout errors
    if (err.name === 'MongoTimeoutError') {
        return res.status(408).json({
            success: false,
            message: "Database operation timed out. Please try again.",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle MongoDB network errors
    if (err.name === 'MongoNetworkError') {
        return res.status(503).json({
            success: false,
            message: "Database connection error. Please try again later.",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: "Token expired",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle rate limiting errors
    if (err.status === 429) {
        return res.status(429).json({
            success: false,
            message: "Too many requests. Please try again later.",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle API errors with enhanced context
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors || [],
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && { 
                stack: err.stack,
                context: errorContext 
            })
        });
    }
    
    // Handle specific booking-related errors
    if (err.message && err.message.includes('booking')) {
        return res.status(409).json({
            success: false,
            message: "Booking conflict detected. Please try a different time slot.",
            errors: [],
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle other errors with enhanced logging
    console.error('Unhandled error:', {
        ...errorContext,
        severity: 'HIGH'
    });
    
    return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? "Internal server error" 
            : err.message || "Internal server error",
        errors: [],
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            context: errorContext 
        })
    });
};

