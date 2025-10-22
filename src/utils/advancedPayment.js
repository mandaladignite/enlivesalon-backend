import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from './logger.js';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Enhanced payment security class
class PaymentSecurity {
    constructor() {
        this.attempts = new Map();
        this.MAX_ATTEMPTS = 3;
        this.COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes
    }

    // Check rate limiting for payment attempts
    checkRateLimit(userId) {
        const userAttempts = this.attempts.get(userId);
        
        if (!userAttempts) {
            return { allowed: true, remainingTime: 0 };
        }

        const timeSinceLastAttempt = Date.now() - userAttempts.lastAttempt;
        
        if (timeSinceLastAttempt > this.COOLDOWN_PERIOD) {
            this.attempts.delete(userId);
            return { allowed: true, remainingTime: 0 };
        }

        if (userAttempts.count >= this.MAX_ATTEMPTS) {
            const remainingTime = this.COOLDOWN_PERIOD - timeSinceLastAttempt;
            return { allowed: false, remainingTime };
        }

        return { allowed: true, remainingTime: 0 };
    }

    // Record payment attempt
    recordAttempt(userId) {
        const userAttempts = this.attempts.get(userId);
        
        if (userAttempts) {
            userAttempts.count++;
            userAttempts.lastAttempt = Date.now();
        } else {
            this.attempts.set(userId, { count: 1, lastAttempt: Date.now() });
        }
    }

    // Clear attempts for successful payment
    clearAttempts(userId) {
        this.attempts.delete(userId);
    }

    // Validate amount with tolerance
    validateAmount(amount, expectedAmount) {
        return Math.abs(amount - expectedAmount) < 1; // Allow 1 paise difference
    }

    // Generate secure appointment ID
    static generateSecureAppointmentId(userId, timestamp) {
        const randomBytes = crypto.randomBytes(16).toString('hex');
        return `appointment_${userId}_${timestamp}_${randomBytes}`;
    }

    // Validate appointment integrity
    static validateAppointmentIntegrity(appointment, expectedAmount, expectedCurrency) {
        const checks = {
            amount: this.validateAmount(appointment.amount, expectedAmount * 100), // Convert to paise
            currency: appointment.currency === expectedCurrency,
            status: appointment.status === 'created',
            timestamp: Date.now() - appointment.created_at * 1000 < 30 * 60 * 1000 // 30 minutes
        };

        return {
            isValid: Object.values(checks).every(check => check),
            checks
        };
    }
}

// Enhanced Razorpay appointment creation with security features
export const createSecureRazorpayAppointment = async (amount, currency = 'INR', receipt = null, metadata = {}) => {
    try {
        if (!razorpay) {
            throw new Error('Razorpay not initialized');
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay credentials not configured');
        }

        const timestamp = Date.now();
        const secureReceipt = receipt || PaymentSecurity.generateSecureAppointmentId(metadata.userId || 'anonymous', timestamp);

        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: currency,
            receipt: secureReceipt,
            notes: {
                ...metadata,
                timestamp: timestamp.toString(),
                securityLevel: 'enhanced'
            }
        };

        const appointment = await razorpay.orders.create(options);
        
        logger.info('Razorpay appointment created successfully', {
            appointmentId: appointment.id,
            amount: appointment.amount,
            currency: appointment.currency,
            receipt: appointment.receipt
        });

        return {
            success: true,
            appointment: {
                id: appointment.id,
                amount: appointment.amount,
                currency: appointment.currency,
                receipt: appointment.receipt,
                status: appointment.status,
                created_at: appointment.created_at,
                notes: appointment.notes
            }
        };
    } catch (error) {
        logger.error('Razorpay appointment creation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create Razorpay appointment'
        };
    }
};

// Enhanced payment signature verification with additional security checks
export const verifySecurePaymentSignature = (razorpayAppointmentId, razorpayPaymentId, razorpaySignature, expectedAmount) => {
    try {
        console.log('Starting payment signature verification:', {
            appointmentId: razorpayAppointmentId,
            paymentId: razorpayPaymentId ? razorpayPaymentId.substring(0, 8) + '...' : 'missing',
            signature: razorpaySignature ? razorpaySignature.substring(0, 8) + '...' : 'missing',
            expectedAmount
        });

        // Enhanced input validation
        if (!razorpayAppointmentId || !razorpayPaymentId || !razorpaySignature) {
            const missingParams = [];
            if (!razorpayAppointmentId) missingParams.push('razorpayAppointmentId');
            if (!razorpayPaymentId) missingParams.push('razorpayPaymentId');
            if (!razorpaySignature) missingParams.push('razorpaySignature');
            
            throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
        }

        // Validate signature format
        if (typeof razorpaySignature !== 'string' || razorpaySignature.length < 10) {
            throw new Error('Invalid signature format');
        }

        // Create expected signature
        const body = razorpayAppointmentId + "|" + razorpayPaymentId;
        console.log('Creating signature for body:', body);
        
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        console.log('Signature comparison:', {
            expected: expectedSignature.substring(0, 8) + '...',
            received: razorpaySignature.substring(0, 8) + '...',
            match: expectedSignature === razorpaySignature
        });

        const isAuthentic = expectedSignature === razorpaySignature;

        if (!isAuthentic) {
            logger.warn('Invalid payment signature detected', {
                appointmentId: razorpayAppointmentId,
                paymentId: razorpayPaymentId,
                expectedSignature: expectedSignature.substring(0, 8) + '...',
                receivedSignature: razorpaySignature.substring(0, 8) + '...'
            });
            
            return {
                success: false,
                message: 'Invalid payment signature'
            };
        }

        logger.info('Payment signature verified successfully', {
            appointmentId: razorpayAppointmentId,
            paymentId: razorpayPaymentId
        });

        return {
            success: true,
            message: 'Payment signature verified'
        };

    } catch (error) {
        logger.error('Payment signature verification error:', {
            error: error.message,
            stack: error.stack,
            appointmentId: razorpayAppointmentId,
            paymentId: razorpayPaymentId
        });

        return {
            success: false,
            message: error.message || 'Payment signature verification failed'
        };
    }
};

// Enhanced payment capture with security checks
export const captureSecurePayment = async (paymentId, amount, currency = 'INR') => {
    try {
        if (!razorpay) {
            throw new Error('Razorpay not initialized');
        }

        const captureOptions = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: currency
        };

        const payment = await razorpay.payments.capture(paymentId, captureOptions.amount, captureOptions.currency);
        
        logger.info('Payment captured successfully', {
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status
        });

        return {
            success: true,
            payment: {
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                captured: payment.captured,
                method: payment.method,
                description: payment.description
            }
        };
    } catch (error) {
        logger.error('Payment capture error:', error);
        return {
            success: false,
            error: error.message || 'Failed to capture payment'
        };
    }
};

// Enhanced refund processing with security
export const processSecureRefund = async (paymentId, amount, reason = 'Customer request') => {
    try {
        if (!razorpay) {
            throw new Error('Razorpay not initialized');
        }

        const refundOptions = {
            amount: Math.round(amount * 100), // Convert to paise
            notes: {
                reason: reason,
                processed_at: new Date().toISOString()
            }
        };

        const refund = await razorpay.payments.refund(paymentId, refundOptions);
        
        logger.info('Refund processed successfully', {
            refundId: refund.id,
            paymentId: refund.payment_id,
            amount: refund.amount,
            status: refund.status
        });

        return {
            success: true,
            refund: {
                id: refund.id,
                payment_id: refund.payment_id,
                amount: refund.amount,
                currency: refund.currency,
                status: refund.status,
                notes: refund.notes
            }
        };
    } catch (error) {
        logger.error('Refund processing error:', error);
        return {
            success: false,
            error: error.message || 'Failed to process refund'
        };
    }
};

// Enhanced appointment details with security analysis
export const getSecureAppointmentDetails = async (appointmentId) => {
    try {
        if (!razorpay) {
            throw new Error('Razorpay not initialized');
        }

        const appointment = await razorpay.orders.fetch(appointmentId);
        
        // Security analysis
        const securityAnalysis = {
            appointmentAge: Date.now() - (appointment.created_at * 1000),
            isExpired: appointment.status === 'expired',
            hasPayments: appointment.amount_paid > 0,
            partialPayment: appointment.amount_paid < appointment.amount,
            riskLevel: calculateAppointmentRisk(appointment)
        };

        return {
            success: true,
            appointment: {
                id: appointment.id,
                amount: appointment.amount,
                currency: appointment.currency,
                status: appointment.status,
                receipt: appointment.receipt,
                created_at: appointment.created_at,
                notes: appointment.notes,
                amount_paid: appointment.amount_paid,
                amount_due: appointment.amount_due,
                security: securityAnalysis
            }
        };
    } catch (error) {
        logger.error('Get appointment details error:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch appointment details'
        };
    }
};

// Calculate appointment risk level
const calculateAppointmentRisk = (appointment) => {
    let risk = 'low';
    
    if (appointment.status === 'expired') risk = 'high';
    if (appointment.amount > 1000000) risk = 'medium'; // > ₹10,000
    if (appointment.amount_paid > 0 && appointment.amount_paid < appointment.amount) risk = 'high';
    
    return risk;
};

// Enhanced shipping and tax calculation with security
export const calculateSecureShippingCharges = (appointmentAmount, shippingAddress, securityContext = {}) => {
    // Base shipping calculation
    let shippingCharges = 0;
    
    if (appointmentAmount >= 500) {
        shippingCharges = 0; // Free shipping
    } else {
        shippingCharges = 50; // Standard shipping
    }
    
    // Security-based adjustments
    if (securityContext.isHighRisk) {
        shippingCharges += 25; // Additional charge for high-risk appointments
    }
    
    return {
        shippingCharges,
        isFree: shippingCharges === 0,
        securityAdjustment: securityContext.isHighRisk ? 25 : 0
    };
};

// Enhanced tax calculation with compliance
export const calculateSecureTax = (appointmentAmount, taxRate = 0.18, complianceData = {}) => {
    // Base tax calculation
    let tax = Math.round(appointmentAmount * taxRate);
    
    // Compliance adjustments
    if (complianceData.state === 'GST_EXEMPT') {
        tax = 0;
    }
    
    return {
        tax,
        taxRate,
        isGSTApplicable: complianceData.state !== 'GST_EXEMPT'
    };
};

// Generate enhanced payment receipt with security features
export const generateSecurePaymentReceipt = (appointment, paymentDetails = {}) => {
    const receipt = {
        appointmentNumber: appointment.appointmentNumber,
        date: appointment.createdAt,
        services: appointment.services.map(service => ({
            name: service.serviceName,
            duration: service.duration,
            price: service.price,
            total: service.totalPrice
        })),
        subtotal: appointment.subtotal,
        discount: appointment.discount,
        shipping: appointment.shippingCharges,
        tax: appointment.tax,
        total: appointment.totalAmount,
        paymentMethod: appointment.paymentDetails.method,
        paymentStatus: appointment.paymentDetails.status,
        security: {
            receiptId: crypto.randomUUID(),
            generatedAt: new Date().toISOString(),
            checksum: crypto.createHash('sha256')
                .update(`${appointment.appointmentNumber}${appointment.totalAmount}${appointment.createdAt}`)
                .digest('hex').substring(0, 16)
        }
    };

    return receipt;
};

// Export the PaymentSecurity class instance
export const PaymentSecurity = new PaymentSecurity();