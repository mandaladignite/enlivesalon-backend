import express from "express";
import {
    getDashboardStats,
    getRecentBookings,
    getRevenueAnalytics,
    getUpcomingAppointments,
    getDashboardOverview
} from "../controllers/admin.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { clearRateLimit } from "../middleware/security.middleware.js";
import { query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// Validation middleware
const dashboardStatsValidation = [
    query("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be 'week', 'month', or 'year'")
];

const recentBookingsValidation = [
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    query("status")
        .optional()
        .isIn(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"])
        .withMessage("Invalid status")
];

const revenueAnalyticsValidation = [
    query("period")
        .optional()
        .isIn(["week", "month", "year"])
        .withMessage("Period must be 'week', 'month', or 'year'")
];

const upcomingAppointmentsValidation = [
    query("limit")
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage("Limit must be between 1 and 50")
];

// Admin dashboard routes (all require admin authentication)
router.get(
    "/dashboard/stats",
    verifyJWT,
    adminOnly,
    dashboardStatsValidation,
    validate,
    getDashboardStats
);

router.get(
    "/dashboard/recent-bookings",
    verifyJWT,
    adminOnly,
    recentBookingsValidation,
    validate,
    getRecentBookings
);

router.get(
    "/dashboard/revenue-analytics",
    verifyJWT,
    adminOnly,
    revenueAnalyticsValidation,
    validate,
    getRevenueAnalytics
);

router.get(
    "/dashboard/upcoming-appointments",
    verifyJWT,
    adminOnly,
    upcomingAppointmentsValidation,
    validate,
    getUpcomingAppointments
);

// Combined dashboard overview endpoint
router.get(
    "/dashboard/overview",
    verifyJWT,
    adminOnly,
    getDashboardOverview
);

// Rate limit management endpoint (admin only)
router.post(
    "/rate-limit/clear",
    verifyJWT,
    adminOnly,
    clearRateLimit,
    (req, res) => {
        res.json({
            success: true,
            message: "Rate limit cleared successfully"
        });
    }
);

export default router;
