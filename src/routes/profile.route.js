import express from "express";
import {
    getUserProfile,
    updateUserProfile,
    changePassword,
    updateUserPreferences,
    getUserStats,
    uploadProfilePicture,
    deleteUserAccount,
    getUserActivityLog,
    exportUserData
} from "../controllers/profile.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { body, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get user profile
router.get(
    "/",
    getUserProfile
);

// Update user profile
router.put(
    "/",
    [
        body("name")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage("Name must be between 1 and 50 characters"),
        body("phone")
            .optional()
            .isMobilePhone()
            .withMessage("Please enter a valid phone number"),
        body("dateOfBirth")
            .optional()
            .isISO8601()
            .withMessage("Please enter a valid date of birth"),
        body("gender")
            .optional()
            .isIn(["male", "female", "other", "prefer_not_to_say"])
            .withMessage("Invalid gender value"),
        body("bio")
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Bio cannot exceed 500 characters")
    ],
    validate,
    updateUserProfile
);

// Change password
router.put(
    "/change-password",
    [
        body("currentPassword")
            .notEmpty()
            .withMessage("Current password is required"),
        body("newPassword")
            .isLength({ min: 6 })
            .withMessage("New password must be at least 6 characters long")
    ],
    validate,
    changePassword
);

// Update user preferences
router.put(
    "/preferences",
    [
        body("notifications")
            .optional()
            .isBoolean()
            .withMessage("Notifications must be a boolean value"),
        body("emailNotifications")
            .optional()
            .isBoolean()
            .withMessage("Email notifications must be a boolean value"),
        body("smsNotifications")
            .optional()
            .isBoolean()
            .withMessage("SMS notifications must be a boolean value"),
        body("language")
            .optional()
            .isIn(["en", "hi", "es", "fr", "de", "zh", "ja", "ko"])
            .withMessage("Invalid language code"),
        body("timezone")
            .optional()
            .isLength({ min: 1, max: 50 })
            .withMessage("Timezone must be between 1 and 50 characters"),
        body("theme")
            .optional()
            .isIn(["light", "dark", "auto"])
            .withMessage("Theme must be light, dark, or auto")
    ],
    validate,
    updateUserPreferences
);

// Get user statistics
router.get(
    "/stats",
    getUserStats
);

// Upload profile picture
router.put(
    "/profile-picture",
    [
        body("profilePictureUrl")
            .isURL()
            .withMessage("Please provide a valid profile picture URL")
    ],
    validate,
    uploadProfilePicture
);

// Get user activity log
router.get(
    "/activity",
    [
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
    getUserActivityLog
);

// Export user data
router.get(
    "/export",
    exportUserData
);

// Delete user account
router.delete(
    "/account",
    [
        body("password")
            .notEmpty()
            .withMessage("Password is required for account deletion")
    ],
    validate,
    deleteUserAccount
);

export default router;

