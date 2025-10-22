/**
 * Enhanced logging utility for the booking system
 */

import fs from 'fs';
import path from 'path';

class Logger {
    constructor() {
        this.logDir = process.env.LOG_DIR || './logs';
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatLogEntry(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };
        
        return JSON.stringify(logEntry);
    }

    writeToFile(filename, logEntry) {
        const filePath = path.join(this.logDir, filename);
        fs.appendFileSync(filePath, logEntry + '\n');
    }

    info(message, meta = {}) {
        const logEntry = this.formatLogEntry('INFO', message, meta);
        console.log(logEntry);
        
        if (process.env.NODE_ENV === 'production') {
            this.writeToFile('app.log', logEntry);
        }
    }

    error(message, meta = {}) {
        const logEntry = this.formatLogEntry('ERROR', message, meta);
        console.error(logEntry);
        
        this.writeToFile('error.log', logEntry);
    }

    warn(message, meta = {}) {
        const logEntry = this.formatLogEntry('WARN', message, meta);
        console.warn(logEntry);
        
        if (process.env.NODE_ENV === 'production') {
            this.writeToFile('app.log', logEntry);
        }
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            const logEntry = this.formatLogEntry('DEBUG', message, meta);
            console.debug(logEntry);
        }
    }

    // Booking-specific logging methods
    logBookingAttempt(userId, appointmentData, meta = {}) {
        this.info('Booking attempt started', {
            userId,
            appointmentData,
            ...meta
        });
    }

    logBookingSuccess(userId, appointmentId, bookingReference, meta = {}) {
        this.info('Booking successful', {
            userId,
            appointmentId,
            bookingReference,
            ...meta
        });
    }

    logBookingFailure(userId, error, appointmentData, meta = {}) {
        this.error('Booking failed', {
            userId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            appointmentData,
            ...meta
        });
    }

    logBookingConflict(userId, conflictType, appointmentData, meta = {}) {
        this.warn('Booking conflict detected', {
            userId,
            conflictType,
            appointmentData,
            ...meta
        });
    }

    logStylistAvailability(stylistId, date, timeSlot, isAvailable, meta = {}) {
        this.debug('Stylist availability check', {
            stylistId,
            date,
            timeSlot,
            isAvailable,
            ...meta
        });
    }

    logServiceValidation(serviceId, validationResult, meta = {}) {
        this.debug('Service validation', {
            serviceId,
            validationResult,
            ...meta
        });
    }

    logDatabaseOperation(operation, collection, duration, success, meta = {}) {
        const level = success ? 'info' : 'error';
        this[level](`Database operation: ${operation}`, {
            collection,
            duration,
            success,
            ...meta
        });
    }

    logApiRequest(method, url, statusCode, duration, userId, meta = {}) {
        const level = statusCode >= 400 ? 'warn' : 'info';
        this[level](`API request: ${method} ${url}`, {
            method,
            url,
            statusCode,
            duration,
            userId,
            ...meta
        });
    }


    // Performance monitoring
    logPerformance(operation, duration, threshold = 1000, meta = {}) {
        const level = duration > threshold ? 'warn' : 'info';
        this[level](`Performance: ${operation}`, {
            operation,
            duration,
            threshold,
            slow: duration > threshold,
            ...meta
        });
    }

    // Security logging
    logSecurityEvent(eventType, userId, ip, userAgent, meta = {}) {
        this.warn(`Security event: ${eventType}`, {
            eventType,
            userId,
            ip,
            userAgent,
            ...meta
        });
    }

    // System health logging
    logSystemHealth(component, status, metrics = {}, meta = {}) {
        const level = status === 'healthy' ? 'info' : 'warn';
        this[level](`System health: ${component}`, {
            component,
            status,
            metrics,
            ...meta
        });
    }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience methods
export const {
    info,
    error,
    warn,
    debug,
    logBookingAttempt,
    logBookingSuccess,
    logBookingFailure,
    logBookingConflict,
    logStylistAvailability,
    logServiceValidation,
    logDatabaseOperation,
    logApiRequest,
    logPerformance,
    logSecurityEvent,
    logSystemHealth
} = logger;
