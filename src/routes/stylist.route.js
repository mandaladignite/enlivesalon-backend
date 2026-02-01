import express from "express";
import { 
    getAllStylists, 
    getStylist, 
    createStylist, 
    updateStylist, 
    deleteStylist, 
    deactivateStylist, 
    reactivateStylist, 
    updateStylistRating, 
    getStylistStats 
} from "../controllers/stylist.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { uploadSingle } from "../middleware/upload.middleware.js";
import { parseFormData } from "../middleware/formDataParser.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.get(
    "/",
    [
        query("specialty")
            .optional()
            .isIn(["hair", "nails", "skincare", "massage", "makeup", "other"])
            .withMessage("Invalid specialty"),
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        query("availableForHome")
            .optional()
            .isBoolean()
            .withMessage("availableForHome must be a boolean"),
        query("availableForSalon")
            .optional()
            .isBoolean()
            .withMessage("availableForSalon must be a boolean"),
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
    getAllStylists
);

router.get(
    "/:stylistId",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required")
    ],
    validate,
    getStylist
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Create stylist (Admin only)
router.post(
    "/",
    [],
    adminOnly,
    uploadSingle('image'),
    parseFormData,
    createStylist
);

// Update stylist (Admin only)
router.put(
    "/:stylistId",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required")
    ],
    adminOnly,
    uploadSingle('image'),
    parseFormData,
    updateStylist
);

// Delete stylist (Admin only)
router.delete(
    "/:stylistId",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required")
    ],
    validate,
    adminOnly,
    deleteStylist
);

// Deactivate stylist (Admin only)
router.patch(
    "/:stylistId/deactivate",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required")
    ],
    validate,
    adminOnly,
    deactivateStylist
);

// Reactivate stylist (Admin only)
router.patch(
    "/:stylistId/reactivate",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required")
    ],
    validate,
    adminOnly,
    reactivateStylist
);

// Update stylist rating (Admin only)
router.patch(
    "/:stylistId/rating",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required"),
        body("rating")
            .isFloat({ min: 0, max: 5 })
            .withMessage("Rating must be between 0 and 5")
    ],
    validate,
    adminOnly,
    updateStylistRating
);

// Get stylist statistics (Admin only)
router.get(
    "/admin/stats",
    adminOnly,
    getStylistStats
);

export default router;
