import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay instance
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
} else {
    console.warn('Razorpay credentials not configured. Payment features will be disabled.');
}

// Create Razorpay order
export const createRazorpayOrder = async (amount, currency = 'INR', receipt = null) => {
    try {
        if (!razorpay) {
            return {
                success: false,
                error: 'Razorpay service not configured'
            };
        }

        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: {
                source: 'salon-management-api'
            }
        };

        const order = await razorpay.orders.create(options);
        return {
            success: true,
            appointment: {
                id: appointment.id,
                amount: appointment.amount,
                currency: appointment.currency,
                receipt: appointment.receipt,
                status: appointment.status,
                created_at: appointment.created_at
            }
        };
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create Razorpay order'
        };
    }
};

// Verify Razorpay payment signature
export const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    try {
        const body = razorpayOrderId + "|" + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpaySignature;
        
        return {
            success: isAuthentic,
            message: isAuthentic ? 'Payment signature verified' : 'Invalid payment signature'
        };
    } catch (error) {
        console.error('Payment verification error:', error);
        return {
            success: false,
            message: 'Payment verification failed'
        };
    }
};

// Capture Razorpay payment
export const capturePayment = async (paymentId, amount, currency = 'INR') => {
    try {
        if (!razorpay) {
            return {
                success: false,
                error: 'Razorpay service not configured'
            };
        }

        const payment = await razorpay.payments.capture(paymentId, amount, currency);
        return {
            success: true,
            payment: {
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                captured: payment.captured,
                method: payment.method,
                created_at: payment.created_at
            }
        };
    } catch (error) {
        console.error('Payment capture error:', error);
        return {
            success: false,
            error: error.message || 'Failed to capture payment'
        };
    }
};

// Refund Razorpay payment
export const refundPayment = async (paymentId, amount, notes = {}) => {
    try {
        if (!razorpay) {
            return {
                success: false,
                error: 'Razorpay service not configured'
            };
        }

        const refund = await razorpay.payments.refund(paymentId, {
            amount: Math.round(amount * 100), // Convert to paise
            notes: {
                reason: notes.reason || 'Customer request',
                source: 'salon-management-api',
                ...notes
            }
        });

        return {
            success: true,
            refund: {
                id: refund.id,
                amount: refund.amount,
                currency: refund.currency,
                status: refund.status,
                notes: refund.notes,
                created_at: refund.created_at
            }
        };
    } catch (error) {
        console.error('Payment refund error:', error);
        return {
            success: false,
            error: error.message || 'Failed to refund payment'
        };
    }
};

// Get Razorpay payment details
export const getPaymentDetails = async (paymentId) => {
    try {
        if (!razorpay) {
            return {
                success: false,
                error: 'Razorpay service not configured'
            };
        }

        const payment = await razorpay.payments.fetch(paymentId);
        return {
            success: true,
            payment: {
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                method: payment.method,
                captured: payment.captured,
                created_at: payment.created_at,
                notes: payment.notes
            }
        };
    } catch (error) {
        console.error('Get payment details error:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch payment details'
        };
    }
};

// Get Razorpay order details
export const getOrderDetails = async (orderId) => {
    try {
        if (!razorpay) {
            return {
                success: false,
                error: 'Razorpay service not configured'
            };
        }

        const order = await razorpay.orders.fetch(orderId);
        return {
            success: true,
            appointment: {
                id: appointment.id,
                amount: appointment.amount,
                currency: appointment.currency,
                status: appointment.status,
                receipt: appointment.receipt,
                created_at: appointment.created_at,
                notes: appointment.notes
            }
        };
    } catch (error) {
        console.error('Get order details error:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch order details'
        };
    }
};

// Calculate shipping charges based on order amount
export const calculateShippingCharges = (orderAmount, shippingAddress) => {
    // Free shipping for orders above ₹500
    if (orderAmount >= 500) {
        return 0;
    }
    
    // Standard shipping charges
    return 50; // ₹50 for orders below ₹500
};

// Calculate tax based on order amount
export const calculateTax = (orderAmount, taxRate = 0.18) => {
    return Math.round(orderAmount * taxRate);
};

// Generate payment receipt for appointments
export const generatePaymentReceipt = (appointment) => {
    return {
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
        paymentStatus: appointment.paymentDetails.status
    };
};

export default razorpay;
