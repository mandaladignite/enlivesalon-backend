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
    [
        body("name")
            .isLength({ min: 1, max: 50 })
            .withMessage("Stylist name is required and cannot exceed 50 characters"),
        body("email")
            .isEmail()
            .withMessage("Valid email is required"),
        body("phone")
            .isLength({ min: 1, max: 15 })
            .withMessage("Phone number is required and cannot exceed 15 characters"),
        body("specialties")
            .optional()
            .isArray()
            .withMessage("Specialties must be an array"),
        body("specialties.*")
            .optional()
            .isIn(["hair", "nails", "skincare", "massage", "makeup", "other"])
            .withMessage("Invalid specialty"),
        body("experience")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Experience must be a non-negative integer"),
        body("rating")
            .optional()
            .isFloat({ min: 0, max: 5 })
            .withMessage("Rating must be between 0 and 5"),
        body("bio")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Bio cannot exceed 500 characters"),
        body("workingHours.start")
            .optional()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage("Working start time must be in HH:MM format"),
        body("workingHours.end")
            .optional()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage("Working end time must be in HH:MM format"),
        body("workingDays")
            .optional()
            .isArray({ min: 1 })
            .withMessage("At least one working day is required"),
        body("workingDays.*")
            .optional()
            .isIn(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
            .withMessage("Invalid working day"),
        body("availableForHome")
            .optional()
            .isBoolean()
            .withMessage("availableForHome must be a boolean"),
        body("availableForSalon")
            .optional()
            .isBoolean()
            .withMessage("availableForSalon must be a boolean")
    ],
    validate,
    adminOnly,
    createStylist
);

// Update stylist (Admin only)
router.put(
    "/:stylistId",
    [
        param("stylistId")
            .isMongoId()
            .withMessage("Valid stylist ID is required"),
        body("name")
            .optional()
            .isLength({ min: 1, max: 50 })
            .withMessage("Stylist name cannot exceed 50 characters"),
        body("email")
            .optional()
            .isEmail()
            .withMessage("Valid email is required"),
        body("phone")
            .optional()
            .isLength({ min: 1, max: 15 })
            .withMessage("Phone number cannot exceed 15 characters"),
        body("specialties")
            .optional()
            .isArray()
            .withMessage("Specialties must be an array"),
        body("specialties.*")
            .optional()
            .isIn(["hair", "nails", "skincare", "massage", "makeup", "other"])
            .withMessage("Invalid specialty"),
        body("experience")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Experience must be a non-negative integer"),
        body("rating")
            .optional()
            .isFloat({ min: 0, max: 5 })
            .withMessage("Rating must be between 0 and 5"),
        body("bio")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Bio cannot exceed 500 characters"),
        body("workingHours.start")
            .optional()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage("Working start time must be in HH:MM format"),
        body("workingHours.end")
            .optional()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .withMessage("Working end time must be in HH:MM format"),
        body("workingDays")
            .optional()
            .isArray({ min: 1 })
            .withMessage("At least one working day is required"),
        body("workingDays.*")
            .optional()
            .isIn(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
            .withMessage("Invalid working day"),
        body("availableForHome")
            .optional()
            .isBoolean()
            .withMessage("availableForHome must be a boolean"),
        body("availableForSalon")
            .optional()
            .isBoolean()
            .withMessage("availableForSalon must be a boolean")
    ],
    validate,
    adminOnly,
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
