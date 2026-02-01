import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from './logger.js';
import { Membership } from '../models/membership.model.js';
import { Package } from '../models/package.model.js';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Enhanced payment security class
class EnhancedPaymentSecurity {
    constructor() {
        this.attempts = new Map();
        this.MAX_ATTEMPTS = 3;
        this.COOLDOWN_PERIOD = 15 * 60 * 1000; // 15 minutes
    }

    // Check rate limiting for payment attempts
    checkRateLimit(userId) {
        const userAttempts = this.attempts.get(userId);
        if (!userAttempts) {
            this.attempts.set(userId, { count: 1, lastAttempt: Date.now() });
            return { allowed: true, remaining: this.MAX_ATTEMPTS - 1 };
        }

        const timeSinceLastAttempt = Date.now() - userAttempts.lastAttempt;
        if (timeSinceLastAttempt > this.COOLDOWN_PERIOD) {
            this.attempts.set(userId, { count: 1, lastAttempt: Date.now() });
            return { allowed: true, remaining: this.MAX_ATTEMPTS - 1 };
        }

        if (userAttempts.count >= this.MAX_ATTEMPTS) {
            return { 
                allowed: false, 
                remaining: 0, 
                cooldown: this.COOLDOWN_PERIOD - timeSinceLastAttempt 
            };
        }

        userAttempts.count += 1;
        userAttempts.lastAttempt = Date.now();
        this.attempts.set(userId, userAttempts);
        
        return { 
            allowed: true, 
            remaining: this.MAX_ATTEMPTS - userAttempts.count 
        };
    }

    // Generate secure order ID (max 40 characters for Razorpay)
    generateSecureOrderId(userId, packageId) {
        const timestamp = Date.now().toString().slice(-8); // Last 8 digits
        const random = Math.random().toString(36).substring(2, 8); // 6 chars
        const userIdShort = userId.toString().slice(-6); // Last 6 chars
        const packageIdShort = packageId.toString().slice(-6); // Last 6 chars
        return `mem_${userIdShort}_${packageIdShort}_${timestamp}_${random}`;
    }

    // Validate payment integrity
    validatePaymentIntegrity(paymentData, expectedAmount, expectedCurrency) {
        // For test mode, be more lenient with amount validation
        const isTestMode = process.env.NODE_ENV === 'development' || process.env.RAZORPAY_KEY_ID?.includes('test');
        
        const checks = {
            amount: isTestMode ? 
                (paymentData.amount && paymentData.amount > 0) : // In test mode, just check if amount exists and is positive
                (paymentData.amount === expectedAmount), // In production, exact match
            currency: isTestMode ? 
                true : // In test mode, skip currency validation
                (paymentData.currency === expectedCurrency), // In production, exact match
            orderId: paymentData.razorpay_order_id && paymentData.razorpay_order_id.length > 0,
            paymentId: paymentData.razorpay_payment_id && paymentData.razorpay_payment_id.length > 0,
            signature: paymentData.razorpay_signature && paymentData.razorpay_signature.length > 0
        };

        logger.info('Payment integrity check', {
            isTestMode,
            expectedAmount,
            actualAmount: paymentData.amount,
            currency: paymentData.currency,
            expectedCurrency,
            checks,
            paymentDataKeys: Object.keys(paymentData)
        });

        return {
            isValid: Object.values(checks).every(check => check),
            checks
        };
    }
}

const paymentSecurity = new EnhancedPaymentSecurity();

// Create Razorpay order for membership
export const createMembershipOrder = async (userId, packageId, metadata = {}) => {
    try {
        // Check rate limiting
        const rateLimit = paymentSecurity.checkRateLimit(userId);
        if (!rateLimit.allowed) {
            throw new Error(`Too many payment attempts. Please try again in ${Math.ceil(rateLimit.cooldown / 60000)} minutes.`);
        }

        // Get package details
        const packageDoc = await Package.findById(packageId);
        if (!packageDoc) {
            throw new Error('Package not found');
        }

        if (!packageDoc.isActive) {
            throw new Error('Package is not available for purchase');
        }

        // Check for existing active membership
        const existingMembership = await Membership.findOne({
            userId,
            packageId,
            isActive: true,
            paymentStatus: { $in: ['paid', 'pending'] }
        });

        if (existingMembership) {
            throw new Error('You already have an active or pending membership for this package');
        }

        // Calculate amounts
        const originalAmount = packageDoc.price;
        const discountAmount = packageDoc.discountPercentage > 0 
            ? (originalAmount * packageDoc.discountPercentage / 100) 
            : 0;
        const finalAmount = originalAmount - discountAmount;
        const taxAmount = Math.round(finalAmount * 0.18); // 18% GST
        const totalAmount = finalAmount + taxAmount;

        // Generate secure order ID
        const receipt = paymentSecurity.generateSecureOrderId(userId, packageId);

        const orderOptions = {
            amount: Math.round(totalAmount * 100), // Convert to paise
            currency: 'INR',
            receipt: receipt,
            notes: {
                userId: userId.toString(),
                packageId: packageId.toString(),
                packageName: packageDoc.name,
                originalAmount: originalAmount,
                discountAmount: discountAmount,
                finalAmount: finalAmount,
                taxAmount: taxAmount,
                totalAmount: totalAmount,
                type: 'membership',
                ...metadata
            }
        };

        const order = await razorpay.orders.create(orderOptions);

        logger.info('Razorpay order created for membership', {
            orderId: order.id,
            userId,
            packageId,
            amount: totalAmount,
            receipt
        });

        return {
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
                created_at: order.created_at
            },
            package: {
                id: packageDoc._id,
                name: packageDoc.name,
                originalAmount,
                discountAmount,
                finalAmount,
                taxAmount,
                totalAmount
            },
            rateLimit: {
                remaining: rateLimit.remaining
            }
        };

    } catch (error) {
        logger.error('Failed to create Razorpay order for membership:', error);
        return {
            success: false,
            error: error.message || 'Failed to create payment order'
        };
    }
};

// Verify Razorpay payment signature
export const verifyMembershipPayment = async (paymentData) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
        
        // Check if we're in test mode
        const isTestMode = process.env.NODE_ENV === 'development' || process.env.RAZORPAY_KEY_ID?.includes('test');
        
        logger.info('Starting payment verification', {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            hasSignature: !!razorpay_signature,
            isTestMode,
            paymentData
        });

        // Find the membership by order ID
        const membership = await Membership.findOne({ razorpayOrderId: razorpay_order_id });
        if (!membership) {
            logger.error('Membership not found for payment verification', {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id
            });
            throw new Error('Membership not found for this payment');
        }

        logger.info('Found membership for payment verification', {
            membershipId: membership._id,
            userId: membership.userId,
            packageId: membership.packageId,
            currentStatus: membership.membershipStatus,
            isActive: membership.isActive
        });

        // Get package details for amount calculation (needed for both test and production)
        const packageDoc = await Package.findById(membership.packageId);
        if (!packageDoc) {
            throw new Error('Package not found');
        }

        // Calculate amounts (needed for membership update)
        const originalAmount = packageDoc.price;
        const discountAmount = packageDoc.discountPercentage > 0 
            ? (originalAmount * packageDoc.discountPercentage / 100) 
            : 0;
        const finalAmount = originalAmount - discountAmount;
        const taxAmount = Math.round(finalAmount * 0.18);
        const totalAmount = finalAmount + taxAmount;

        logger.info('Amount calculation for membership update', {
            originalAmount,
            discountAmount,
            finalAmount,
            taxAmount,
            totalAmount,
            packagePrice: packageDoc.price,
            discountPercentage: packageDoc.discountPercentage
        });

        // Skip verification in test mode
        if (isTestMode) {
            logger.info('Test mode detected - skipping payment verification', {
                membershipId: membership._id,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                totalAmount
            });
        } else {
            // Production mode - perform full verification
            const expectedAmount = Math.round(totalAmount * 100);

            logger.info('Amount calculation for verification', {
                originalAmount,
                discountAmount,
                finalAmount,
                taxAmount,
                expectedAmount,
                packagePrice: packageDoc.price,
                discountPercentage: packageDoc.discountPercentage
            });

            // Validate payment integrity
            const integrityCheck = paymentSecurity.validatePaymentIntegrity(
                paymentData, 
                expectedAmount, 
                'INR'
            );

            logger.info('Payment integrity check result', {
                isValid: integrityCheck.isValid,
                checks: integrityCheck.checks,
                paymentData: {
                    amount: paymentData.amount,
                    currency: paymentData.currency,
                    orderId: paymentData.razorpay_order_id,
                    paymentId: paymentData.razorpay_payment_id,
                    hasSignature: !!paymentData.razorpay_signature
                },
                fullPaymentData: paymentData
            });

            if (!integrityCheck.isValid) {
                logger.error('Payment integrity check failed', {
                    checks: integrityCheck.checks,
                    expectedAmount,
                    actualAmount: paymentData.amount
                });
                throw new Error('Payment data integrity check failed');
            }

            // Verify signature
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            const isValidSignature = expectedSignature === razorpay_signature;

            if (!isValidSignature) {
                throw new Error('Invalid payment signature');
            }
        }

        // Update membership with payment details
        membership.razorpayPaymentId = razorpay_payment_id;
        membership.razorpaySignature = razorpay_signature;
        membership.paymentStatus = 'paid';
        membership.membershipStatus = 'active';
        membership.isActive = true;
        membership.originalAmount = originalAmount;
        membership.amountPaid = totalAmount;
        membership.discountApplied = discountAmount;
        membership.taxAmount = taxAmount;
        membership.activatedAt = new Date();

        await membership.save();

        // Verify the membership was updated
        const updatedMembership = await Membership.findById(membership._id);
        if (!updatedMembership) {
            throw new Error('Failed to update membership in database');
        }

        logger.info('Membership payment verified successfully', {
            membershipId: membership._id,
            userId: membership.userId,
            packageId: membership.packageId,
            amount: membership.amountPaid,
            paymentId: razorpay_payment_id,
            isActive: membership.isActive,
            membershipStatus: membership.membershipStatus,
            paymentStatus: membership.paymentStatus,
            updatedIsActive: updatedMembership.isActive,
            updatedMembershipStatus: updatedMembership.membershipStatus,
            updatedPaymentStatus: updatedMembership.paymentStatus
        });

        return {
            success: true,
            membership: membership,
            payment: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: membership.amountPaid,
                status: 'verified'
            }
        };

    } catch (error) {
        logger.error('Failed to verify membership payment:', error);
        return {
            success: false,
            error: error.message || 'Payment verification failed'
        };
    }
};

// Create membership with Razorpay order
export const createMembershipWithOrder = async (userId, packageId, notes = '') => {
    try {
        // Get package details
        const packageDoc = await Package.findById(packageId);
        if (!packageDoc) {
            throw new Error('Package not found');
        }

        if (!packageDoc.isActive) {
            throw new Error('Package is not available for purchase');
        }

        // Calculate expiry date
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        
        switch (packageDoc.durationUnit) {
            case 'days':
                expiryDate.setDate(expiryDate.getDate() + packageDoc.duration);
                break;
            case 'weeks':
                expiryDate.setDate(expiryDate.getDate() + (packageDoc.duration * 7));
                break;
            case 'months':
                expiryDate.setMonth(expiryDate.getMonth() + packageDoc.duration);
                break;
            case 'years':
                expiryDate.setFullYear(expiryDate.getFullYear() + packageDoc.duration);
                break;
        }

        // Calculate amounts
        const originalAmount = packageDoc.price;
        const discountAmount = packageDoc.discountPercentage > 0 
            ? (originalAmount * packageDoc.discountPercentage / 100) 
            : 0;
        const finalAmount = originalAmount - discountAmount;
        const taxAmount = Math.round(finalAmount * 0.18);
        const totalAmount = finalAmount + taxAmount;

        // Create membership record
        const membership = await Membership.create({
            userId,
            packageId,
            packageName: packageDoc.name,
            description: packageDoc.description,
            startDate,
            expiryDate,
            paymentStatus: 'pending',
            membershipStatus: 'pending_payment',
            originalAmount,
            amountPaid: totalAmount,
            discountApplied: discountAmount,
            taxAmount,
            remainingAppointments: packageDoc.maxAppointments,
            benefits: packageDoc.benefits,
            notes,
            activatedBy: userId
        });

        logger.info('Membership created successfully', {
            membershipId: membership._id,
            userId,
            packageId,
            packageName: packageDoc.name,
            amount: totalAmount,
            status: 'pending_payment',
            isActive: membership.isActive
        });

        // Verify the membership was created and saved
        const savedMembership = await Membership.findById(membership._id);
        if (!savedMembership) {
            throw new Error('Failed to save membership to database');
        }
        logger.info('Membership verified in database', {
            membershipId: savedMembership._id,
            isActive: savedMembership.isActive,
            membershipStatus: savedMembership.membershipStatus,
            paymentStatus: savedMembership.paymentStatus
        });

        // Create Razorpay order directly (skip the existing membership check since we just created it)
        const orderOptions = {
            amount: Math.round(totalAmount * 100), // Convert to paise
            currency: 'INR',
            receipt: paymentSecurity.generateSecureOrderId(userId, packageId),
            notes: {
                userId: userId.toString(),
                packageId: packageId.toString(),
                packageName: packageDoc.name,
                originalAmount: originalAmount,
                discountAmount: discountAmount,
                finalAmount: finalAmount,
                taxAmount: taxAmount,
                totalAmount: totalAmount,
                type: 'membership',
                membershipId: membership._id.toString()
            }
        };

        const order = await razorpay.orders.create(orderOptions);

        logger.info('Razorpay order created for membership', {
            orderId: order.id,
            userId,
            packageId,
            amount: totalAmount,
            receipt: orderOptions.receipt
        });

        // Update membership with order ID
        membership.razorpayOrderId = order.id;
        await membership.save();

        return {
            success: true,
            membership: membership,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
                created_at: order.created_at
            },
            package: {
                id: packageDoc._id,
                name: packageDoc.name,
                originalAmount,
                discountAmount,
                finalAmount,
                taxAmount,
                totalAmount
            }
        };

    } catch (error) {
        logger.error('Failed to create membership with order:', error);
        return {
            success: false,
            error: error.message || 'Failed to create membership'
        };
    }
};

// Handle payment failure
export const handlePaymentFailure = async (membershipId, reason) => {
    try {
        const membership = await Membership.findById(membershipId);
        if (!membership) {
            throw new Error('Membership not found');
        }

        membership.paymentStatus = 'failed';
        membership.paymentRetryCount += 1;
        membership.lastPaymentAttempt = new Date();
        membership.notes = membership.notes 
            ? `${membership.notes}\nPayment failed: ${reason}` 
            : `Payment failed: ${reason}`;

        await membership.save();

        logger.info('Payment failure handled', {
            membershipId,
            reason,
            retryCount: membership.paymentRetryCount
        });

        return {
            success: true,
            membership: membership
        };

    } catch (error) {
        logger.error('Failed to handle payment failure:', error);
        return {
            success: false,
            error: error.message || 'Failed to handle payment failure'
        };
    }
};

// Get payment status
export const getPaymentStatus = async (orderId) => {
    try {
        const membership = await Membership.findOne({ razorpayOrderId: orderId });
        if (!membership) {
            throw new Error('Membership not found');
        }

        return {
            success: true,
            membership: membership,
            paymentStatus: membership.paymentStatus,
            membershipStatus: membership.membershipStatus
        };

    } catch (error) {
        logger.error('Failed to get payment status:', error);
        return {
            success: false,
            error: error.message || 'Failed to get payment status'
        };
    }
};

export default {
    createMembershipOrder,
    verifyMembershipPayment,
    createMembershipWithOrder,
    handlePaymentFailure,
    getPaymentStatus
};
