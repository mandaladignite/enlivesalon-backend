import express from "express";
import {
    getAllPackages,
    getAllPackagesAdmin,
    getPackage,
    getPopularPackages,
    getPackagesByPriceRange,
    searchPackages,
    createPackage,
    updatePackage,
    deletePackage,
    deactivatePackage,
    reactivatePackage,
    togglePopularStatus,
    updateSortOrder,
    getPackageStats
} from "../controllers/package.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
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
        query("isPopular")
            .optional()
            .isBoolean()
            .withMessage("isPopular must be a boolean"),
        query("minPrice")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("minPrice must be a positive number"),
        query("maxPrice")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("maxPrice must be a positive number"),
        query("sortBy")
            .optional()
            .isIn(["sortOrder", "price", "name", "createdAt"])
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
    getAllPackages
);

router.get(
    "/popular",
    getPopularPackages
);

router.get(
    "/price-range",
    [
        query("minPrice")
            .isFloat({ min: 0 })
            .withMessage("minPrice is required and must be a positive number"),
        query("maxPrice")
            .isFloat({ min: 0 })
            .withMessage("maxPrice is required and must be a positive number")
    ],
    validate,
    getPackagesByPriceRange
);

router.get(
    "/search",
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
    searchPackages
);

router.get(
    "/:packageId",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required")
    ],
    validate,
    getPackage
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Create package (Admin only)
router.post(
    "/",
    [
        body("name")
            .isLength({ min: 1, max: 100 })
            .withMessage("Package name is required and cannot exceed 100 characters"),
        body("description")
            .isLength({ min: 1, max: 500 })
            .withMessage("Description is required and cannot exceed 500 characters"),
        body("price")
            .isFloat({ min: 0 })
            .withMessage("Price must be a positive number"),
        body("duration")
            .isInt({ min: 1 })
            .withMessage("Duration must be a positive integer"),
        body("durationUnit")
            .optional()
            .isIn(["days", "weeks", "months", "years"])
            .withMessage("Duration unit must be one of: days, weeks, months, years"),
        body("benefits")
            .optional()
            .isArray()
            .withMessage("Benefits must be an array"),
        body("benefits.*")
            .optional()
            .isLength({ max: 200 })
            .withMessage("Each benefit cannot exceed 200 characters"),
        body("services")
            .optional()
            .isArray()
            .withMessage("Services must be an array"),
        body("services.*")
            .optional()
            .isMongoId()
            .withMessage("Each service must be a valid MongoDB ObjectId"),
        body("discountPercentage")
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage("Discount percentage must be between 0 and 100"),
        body("maxAppointments")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Max appointments must be a non-negative integer"),
        body("isPopular")
            .optional()
            .isBoolean()
            .withMessage("isPopular must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("termsAndConditions")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Terms and conditions cannot exceed 1000 characters")
    ],
    validate,
    adminOnly,
    createPackage
);

// Update package (Admin only)
router.put(
    "/:packageId",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required"),
        body("name")
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage("Package name cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ min: 1, max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("price")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("Price must be a positive number"),
        body("duration")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Duration must be a positive integer"),
        body("durationUnit")
            .optional()
            .isIn(["days", "weeks", "months", "years"])
            .withMessage("Duration unit must be one of: days, weeks, months, years"),
        body("benefits")
            .optional()
            .isArray()
            .withMessage("Benefits must be an array"),
        body("benefits.*")
            .optional()
            .isLength({ max: 200 })
            .withMessage("Each benefit cannot exceed 200 characters"),
        body("services")
            .optional()
            .isArray()
            .withMessage("Services must be an array"),
        body("services.*")
            .optional()
            .isMongoId()
            .withMessage("Each service must be a valid MongoDB ObjectId"),
        body("discountPercentage")
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage("Discount percentage must be between 0 and 100"),
        body("maxAppointments")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Max appointments must be a non-negative integer"),
        body("isPopular")
            .optional()
            .isBoolean()
            .withMessage("isPopular must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("termsAndConditions")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Terms and conditions cannot exceed 1000 characters")
    ],
    validate,
    adminOnly,
    updatePackage
);

// Delete package (Admin only)
router.delete(
    "/:packageId",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required")
    ],
    validate,
    adminOnly,
    deletePackage
);

// Deactivate package (Admin only)
router.patch(
    "/:packageId/deactivate",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required")
    ],
    validate,
    adminOnly,
    deactivatePackage
);

// Reactivate package (Admin only)
router.patch(
    "/:packageId/reactivate",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required")
    ],
    validate,
    adminOnly,
    reactivatePackage
);

// Toggle popular status (Admin only)
router.patch(
    "/:packageId/toggle-popular",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required")
    ],
    validate,
    adminOnly,
    togglePopularStatus
);

// Update sort order (Admin only)
router.patch(
    "/:packageId/sort-order",
    [
        param("packageId")
            .isMongoId()
            .withMessage("Valid package ID is required"),
        body("sortOrder")
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    updateSortOrder
);

// Get all packages for admin (Admin only)
router.get(
    "/admin/all",
    [
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        query("isPopular")
            .optional()
            .isBoolean()
            .withMessage("isPopular must be a boolean"),
        query("minPrice")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("minPrice must be a positive number"),
        query("maxPrice")
            .optional()
            .isFloat({ min: 0 })
            .withMessage("maxPrice must be a positive number"),
        query("sortBy")
            .optional()
            .isIn(["sortOrder", "price", "name", "createdAt"])
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
    getAllPackagesAdmin
);

// Get package statistics (Admin only)
router.get(
    "/admin/stats",
    adminOnly,
    getPackageStats
);

export default router;

