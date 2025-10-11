import express from "express";
import { getHealthStatus, getDetailedHealthStatus } from "../utils/healthCheck.js";
import { clearAllRateLimits, getRateLimitStatus } from "../middleware/security.middleware.js";

const router = express.Router();

// Basic health check
router.get("/", getHealthStatus);

// Detailed health check
router.get("/detailed", getDetailedHealthStatus);

// Development endpoint to clear rate limits
router.post("/clear-rate-limits", clearAllRateLimits, (req, res) => {
    res.json({
        success: true,
        message: "Rate limits cleared successfully"
    });
});

// Development endpoint to check rate limit status
router.get("/rate-limit-status", getRateLimitStatus);

export default router;
