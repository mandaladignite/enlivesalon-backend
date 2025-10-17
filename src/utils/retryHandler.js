/**
 * Retry mechanism utility for handling transient failures
 */

export class RetryHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 10000;
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.jitter = options.jitter || 0.1;
    }

    /**
     * Execute a function with retry logic
     * @param {Function} fn - Function to execute
     * @param {Array} args - Arguments to pass to the function
     * @param {Object} options - Retry options
     * @returns {Promise} - Result of the function execution
     */
    async execute(fn, args = [], options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        const baseDelay = options.baseDelay || this.baseDelay;
        const maxDelay = options.maxDelay || this.maxDelay;
        const backoffMultiplier = options.backoffMultiplier || this.backoffMultiplier;
        const jitter = options.jitter || this.jitter;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain error types
                if (this.shouldNotRetry(error)) {
                    throw error;
                }
                
                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff and jitter
                const delay = Math.min(
                    baseDelay * Math.pow(backoffMultiplier, attempt),
                    maxDelay
                );
                const jitterAmount = delay * jitter * Math.random();
                const finalDelay = delay + jitterAmount;
                
                console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${Math.round(finalDelay)}ms...`);
                await this.sleep(finalDelay);
            }
        }
        
        throw lastError;
    }

    /**
     * Determine if an error should not be retried
     * @param {Error} error - The error to check
     * @returns {boolean} - True if the error should not be retried
     */
    shouldNotRetry(error) {
        // Don't retry validation errors
        if (error.name === 'ValidationError') return true;
        
        // Don't retry authentication errors
        if (error.name === 'JsonWebTokenError') return true;
        if (error.name === 'TokenExpiredError') return true;
        
        // Don't retry authorization errors
        if (error.statusCode === 403) return true;
        
        // Don't retry not found errors
        if (error.statusCode === 404) return true;
        
        // Don't retry client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) return true;
        
        return false;
    }

    /**
     * Sleep for a specified number of milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after the delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Default retry handler instance
 */
export const defaultRetryHandler = new RetryHandler();

/**
 * Retry decorator for functions
 * @param {Object} options - Retry options
 * @returns {Function} - Decorated function
 */
export function withRetry(options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const retryHandler = new RetryHandler(options);
        
        descriptor.value = async function(...args) {
            return retryHandler.execute(originalMethod.bind(this), args, options);
        };
        
        return descriptor;
    };
}

/**
 * Retry a database operation
 * @param {Function} operation - Database operation to retry
 * @param {Array} args - Arguments for the operation
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the operation
 */
export async function retryDatabaseOperation(operation, args = [], options = {}) {
    const retryHandler = new RetryHandler({
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: 0.1,
        ...options
    });
    
    return retryHandler.execute(operation, args, options);
}

/**
 * Retry an API call
 * @param {Function} apiCall - API call to retry
 * @param {Array} args - Arguments for the API call
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the API call
 */
export async function retryApiCall(apiCall, args = [], options = {}) {
    const retryHandler = new RetryHandler({
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: 0.2,
        ...options
    });
    
    return retryHandler.execute(apiCall, args, options);
}
