import express from "express";
import {
    getAllOffers,
    getAllOffersAdmin,
    getOffer,
    getOfferByCode,
    createOffer,
    updateOffer,
    deleteOffer,
    deactivateOffer,
    reactivateOffer,
    getOfferStats,
    incrementUsageCount
} from "../controllers/offer.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { uploadSingle } from "../middleware/upload.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.get(
    "/",
    [
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        query("sortBy")
            .optional()
            .isIn(["sortOrder", "createdAt", "validFrom", "validUntil"])
            .withMessage("Invalid sortBy field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("sortOrder must be 'asc' or 'desc'"),
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
    getAllOffers
);

router.get(
    "/code/:code",
    [
        param("code")
            .trim()
            .isLength({ min: 1, max: 20 })
            .withMessage("Valid offer code is required")
    ],
    validate,
    getOfferByCode
);

router.get(
    "/:offerId",
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required")
    ],
    validate,
    getOffer
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Create offer (Admin only)
router.post(
    "/",
    uploadSingle('bannerImage'),
    [
        body("title")
            .isLength({ min: 1, max: 100 })
            .withMessage("Title is required and cannot exceed 100 characters"),
        body("description")
            .isLength({ min: 1, max: 500 })
            .withMessage("Description is required and cannot exceed 500 characters"),
        body("code")
            .isLength({ min: 1, max: 20 })
            .withMessage("Code is required and cannot exceed 20 characters"),
        body("discountType")
            .optional()
            .isIn(["percentage", "fixed", "free"])
            .withMessage("Discount type must be one of: percentage, fixed, free"),
        body("discountValue")
            .isFloat({ min: 0 })
            .withMessage("Discount value must be a positive number"),
        body("minPurchaseAmount")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Minimum purchase amount must be a positive number"),
        body("maxDiscountAmount")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Max discount amount must be a positive number"),
        body("validFrom")
            .isISO8601()
            .withMessage("Valid from must be a valid date"),
        body("validUntil")
            .isISO8601()
            .withMessage("Valid until must be a valid date"),
        body("applicableServices")
            .optional()
            .isArray()
            .withMessage("Applicable services must be an array"),
        body("applicableServices.*")
            .optional()
            .isMongoId()
            .withMessage("Each service must be a valid MongoDB ObjectId"),
        body("applicableCategories")
            .optional()
            .isArray()
            .withMessage("Applicable categories must be an array"),
        body("applicableCategories.*")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Each category must be one of: hair, nail, body, skin"),
        body("usageLimit")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Usage limit must be a non-negative integer"),
        body("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("bannerImage")
            .optional()
            .custom((value, { req }) => {
                // Allow file upload or URL
                if (req.file) return true; // File upload takes precedence
                if (!value) return true; // Optional field
                if (typeof value === 'string') {
                    // If it's a string, check if it's a valid URL (for backward compatibility)
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return false;
            })
            .withMessage("Banner image must be a valid URL or file"),
        body("termsAndConditions")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Terms and conditions cannot exceed 1000 characters")
    ],
    validate,
    adminOnly,
    createOffer
);

// Update offer (Admin only)
router.put(
    "/:offerId",
    uploadSingle('bannerImage'),
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required"),
        body("title")
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage("Title cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ min: 1, max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("code")
            .optional()
            .isLength({ min: 1, max: 20 })
            .withMessage("Code cannot exceed 20 characters"),
        body("discountType")
            .optional()
            .isIn(["percentage", "fixed", "free"])
            .withMessage("Discount type must be one of: percentage, fixed, free"),
        body("discountValue")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Discount value must be a positive number"),
        body("minPurchaseAmount")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Minimum purchase amount must be a positive number"),
        body("maxDiscountAmount")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Max discount amount must be a positive number"),
        body("validFrom")
            .optional()
            .isISO8601()
            .withMessage("Valid from must be a valid date"),
        body("validUntil")
            .optional()
            .isISO8601()
            .withMessage("Valid until must be a valid date"),
        body("applicableServices")
            .optional()
            .isArray()
            .withMessage("Applicable services must be an array"),
        body("applicableServices.*")
            .optional()
            .isMongoId()
            .withMessage("Each service must be a valid MongoDB ObjectId"),
        body("applicableCategories")
            .optional()
            .isArray()
            .withMessage("Applicable categories must be an array"),
        body("applicableCategories.*")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Each category must be one of: hair, nail, body, skin"),
        body("usageLimit")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Usage limit must be a non-negative integer"),
        body("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("bannerImage")
            .optional()
            .custom((value, { req }) => {
                // Allow file upload or URL
                if (req.file) return true; // File upload takes precedence
                if (!value) return true; // Optional field
                if (typeof value === 'string') {
                    // If it's a string, check if it's a valid URL (for backward compatibility)
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return false;
            })
            .withMessage("Banner image must be a valid URL or file"),
        body("termsAndConditions")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Terms and conditions cannot exceed 1000 characters")
    ],
    validate,
    adminOnly,
    updateOffer
);

// Delete offer (Admin only)
router.delete(
    "/:offerId",
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required")
    ],
    validate,
    adminOnly,
    deleteOffer
);

// Deactivate offer (Admin only)
router.patch(
    "/:offerId/deactivate",
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required")
    ],
    validate,
    adminOnly,
    deactivateOffer
);

// Reactivate offer (Admin only)
router.patch(
    "/:offerId/reactivate",
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required")
    ],
    validate,
    adminOnly,
    reactivateOffer
);

// Increment usage count (Admin only)
router.patch(
    "/:offerId/increment-usage",
    [
        param("offerId")
            .isMongoId()
            .withMessage("Valid offer ID is required")
    ],
    validate,
    adminOnly,
    incrementUsageCount
);

// Get all offers for admin (Admin only)
router.get(
    "/admin/all",
    [
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        query("sortBy")
            .optional()
            .isIn(["sortOrder", "createdAt", "validFrom", "validUntil"])
            .withMessage("Invalid sortBy field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("sortOrder must be 'asc' or 'desc'"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("search")
            .optional()
            .isLength({ min: 1 })
            .withMessage("Search query must not be empty")
    ],
    validate,
    adminOnly,
    getAllOffersAdmin
);

// Get offer statistics (Admin only)
router.get(
    "/admin/stats",
    adminOnly,
    getOfferStats
);

export default router;

