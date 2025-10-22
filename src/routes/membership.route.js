import express from "express";
import {
    getUserActiveMemberships,
    getUserAllMemberships,
    getMembership,
    purchaseMembership,
    verifyPayment,
    getPaymentStatus,
    handlePaymentFailure,
    updatePaymentStatus,
    cancelMembership,
    extendMembership,
    useAppointment,
    getUserMembershipStats,
    getAllMemberships,
    getMembershipById,
    updateMembership,
    adminCancelMembership,
    getMembershipStats,
    searchMemberships,
    upgradeMembershipTier,
    setAutoRenewal,
    suspendMembership,
    reactivateMembership,
    getMembershipAnalytics
} from "../controllers/membership.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// User routes (authentication required)
router.use(verifyJWT);

// Get user's active memberships
router.get(
    "/my/active",
    getUserActiveMemberships
);

// Get user's all memberships
router.get(
    "/my/all",
    [
        query("status")
            .optional()
            .isIn(["active", "expired", "pending_payment", "expiring_soon"])
            .withMessage("Invalid status filter"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100")
    ],
    validate,
    getUserAllMemberships
);

// Get user membership statistics
router.get(
    "/my/stats",
    getUserMembershipStats
);

// Get single membership
router.get(
    "/my/:membershipId",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required")
    ],
    validate,
    getMembership
);

// Purchase membership
router.post(
    "/purchase",
    [
        body("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required"),
        body("notes")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Notes cannot exceed 500 characters"),
        body("autoRenewal")
            .optional()
            .isBoolean()
            .withMessage("Auto-renewal must be a boolean")
    ],
    validate,
    purchaseMembership
);

// Verify payment
router.post(
    "/verify-payment",
    [
        body("razorpay_order_id")
            .notEmpty()
            .withMessage("Razorpay order ID is required"),
        body("razorpay_payment_id")
            .notEmpty()
            .withMessage("Razorpay payment ID is required"),
        body("razorpay_signature")
            .notEmpty()
            .withMessage("Razorpay signature is required")
    ],
    validate,
    verifyPayment
);

// Get payment status
router.get(
    "/payment-status/:orderId",
    [
        param("orderId")
            .notEmpty()
            .withMessage("Order ID is required")
    ],
    validate,
    getPaymentStatus
);

// Handle payment failure
router.post(
    "/:membershipId/payment-failure",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("reason")
            .notEmpty()
            .withMessage("Failure reason is required")
    ],
    validate,
    handlePaymentFailure
);

// Update payment status
router.patch(
    "/:membershipId/payment-status",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("paymentStatus")
            .isIn(["pending", "paid", "failed", "refunded"])
            .withMessage("Invalid payment status"),
        body("paymentId")
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage("Payment ID must be between 1 and 100 characters")
    ],
    validate,
    updatePaymentStatus
);

// Cancel membership
router.patch(
    "/my/:membershipId/cancel",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("reason")
            .optional()
            .isLength({ max: 200 })
            .withMessage("Cancellation reason cannot exceed 200 characters")
    ],
    validate,
    cancelMembership
);

// Extend membership
router.patch(
    "/my/:membershipId/extend",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("additionalDays")
            .isInt({ min: 1 })
            .withMessage("Additional days must be a positive integer")
    ],
    validate,
    extendMembership
);

// Use appointment
router.patch(
    "/my/:membershipId/use-appointment",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required")
    ],
    validate,
    useAppointment
);

// Admin routes (admin only)
// Get all memberships
router.get(
    "/admin/all",
    [
        query("status")
            .optional()
            .isIn(["active", "expired", "expiring_soon"])
            .withMessage("Invalid status filter"),
        query("userId")
            .optional()
            .isMongoId()
            .withMessage("Invalid user ID"),
        query("packageId")
            .optional()
            .isMongoId()
            .withMessage("Invalid package ID"),
        query("paymentStatus")
            .optional()
            .isIn(["pending", "paid", "failed", "refunded"])
            .withMessage("Invalid payment status"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100")
    ],
    validate,
    adminOnly,
    getAllMemberships
);

// Get membership by ID (Admin)
router.get(
    "/admin/:membershipId",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required")
    ],
    validate,
    adminOnly,
    getMembershipById
);

// Update membership (Admin)
router.put(
    "/admin/:membershipId",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("paymentStatus")
            .optional()
            .isIn(["pending", "paid", "failed", "refunded"])
            .withMessage("Invalid payment status"),
        body("paymentId")
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage("Payment ID must be between 1 and 100 characters"),
        body("paymentMethod")
            .optional()
            .isIn(["razorpay", "cash", "card", "upi", "wallet"])
            .withMessage("Invalid payment method"),
        body("amountPaid")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Amount paid must be a positive number"),
        body("discountApplied")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Discount applied must be a positive number"),
        body("remainingAppointments")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Remaining appointments must be a non-negative integer"),
        body("notes")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Notes cannot exceed 500 characters")
    ],
    validate,
    adminOnly,
    updateMembership
);

// Cancel membership (Admin)
router.patch(
    "/admin/:membershipId/cancel",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("reason")
            .optional()
            .isLength({ max: 200 })
            .withMessage("Cancellation reason cannot exceed 200 characters")
    ],
    validate,
    adminOnly,
    adminCancelMembership
);

// Get membership statistics (Admin)
router.get(
    "/admin/stats",
    adminOnly,
    getMembershipStats
);

// Search memberships (Admin)
router.get(
    "/admin/search",
    [
        query("q")
            .isLength({ min: 2 })
            .withMessage("Search query must be at least 2 characters long"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100")
    ],
    validate,
    adminOnly,
    searchMemberships
);

// Upgrade membership tier (Admin)
router.patch(
    "/admin/:membershipId/upgrade-tier",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("newTier")
            .isIn(["basic", "premium", "vip", "platinum"])
            .withMessage("Invalid membership tier")
    ],
    validate,
    adminOnly,
    upgradeMembershipTier
);

// Suspend membership (Admin)
router.patch(
    "/admin/:membershipId/suspend",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("reason")
            .notEmpty()
            .withMessage("Suspension reason is required")
    ],
    validate,
    adminOnly,
    suspendMembership
);

// Reactivate membership (Admin)
router.patch(
    "/admin/:membershipId/reactivate",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required")
    ],
    validate,
    adminOnly,
    reactivateMembership
);

// Get membership analytics (Admin)
router.get(
    "/admin/analytics",
    [
        query("period")
            .optional()
            .isIn(["7d", "30d", "90d", "1y"])
            .withMessage("Invalid period filter")
    ],
    validate,
    adminOnly,
    getMembershipAnalytics
);

// User routes for membership management
// Set auto-renewal
router.patch(
    "/:membershipId/auto-renewal",
    [
        param("membershipId")
            .isMongoId()
            .withMessage("Valid membership ID is required"),
        body("enabled")
            .isBoolean()
            .withMessage("Auto-renewal status must be a boolean")
    ],
    validate,
    setAutoRenewal
);

export default router;

