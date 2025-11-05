import express from "express";
import {
    getAllHeroSections,
    getAllHeroSectionsAdmin,
    getHeroSection,
    createHeroSection,
    updateHeroSection,
    deleteHeroSection,
    deactivateHeroSection,
    reactivateHeroSection
} from "../controllers/hero.controller.js";
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
            .isIn(["sortOrder", "createdAt", "title"])
            .withMessage("Invalid sortBy field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("sortOrder must be 'asc' or 'desc'")
    ],
    validate,
    getAllHeroSections
);

router.get(
    "/:heroId",
    [
        param("heroId")
            .isMongoId()
            .withMessage("Valid hero ID is required")
    ],
    validate,
    getHeroSection
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Create hero section (Admin only)
router.post(
    "/",
    uploadSingle('backgroundImage'),
    [
        body("title")
            .isLength({ min: 1, max: 200 })
            .withMessage("Title is required and cannot exceed 200 characters"),
        body("subtitle")
            .optional()
            .isLength({ max: 100 })
            .withMessage("Subtitle cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("backgroundImage")
            .optional()
            .custom((value, { req }) => {
                // Allow file upload or URL
                if (req.file) return true; // File upload takes precedence
                if (!value) return true; // Optional field
                if (typeof value === 'string') {
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return false;
            })
            .withMessage("Background image must be a valid URL or file"),
        body("ctaPrimary")
            .custom((value) => {
                if (!value) return false;
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return parsed.text && parsed.link;
            })
            .withMessage("Primary CTA must have text and link"),
        body("ctaSecondary")
            .optional()
            .custom((value) => {
                if (!value) return true; // Optional
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return !parsed.text || parsed.link; // If text exists, link must exist
            })
            .withMessage("Secondary CTA must have link if text is provided"),
        body("stats")
            .optional()
            .custom((value) => {
                if (!value) return true;
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return Array.isArray(parsed);
            })
            .withMessage("Stats must be an array"),
        body("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    createHeroSection
);

// Update hero section (Admin only)
router.put(
    "/:heroId",
    uploadSingle('backgroundImage'),
    [
        param("heroId")
            .isMongoId()
            .withMessage("Valid hero ID is required"),
        body("title")
            .optional()
            .isLength({ min: 1, max: 200 })
            .withMessage("Title cannot exceed 200 characters"),
        body("subtitle")
            .optional()
            .isLength({ max: 100 })
            .withMessage("Subtitle cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("backgroundImage")
            .optional()
            .custom((value, { req }) => {
                if (req.file) return true;
                if (!value) return true;
                if (typeof value === 'string') {
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return false;
            })
            .withMessage("Background image must be a valid URL or file"),
        body("ctaPrimary")
            .optional()
            .custom((value) => {
                if (!value) return true;
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return parsed.text && parsed.link;
            })
            .withMessage("Primary CTA must have text and link"),
        body("ctaSecondary")
            .optional()
            .custom((value) => {
                if (!value) return true;
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return !parsed.text || parsed.link;
            })
            .withMessage("Secondary CTA must have link if text is provided"),
        body("stats")
            .optional()
            .custom((value) => {
                if (!value) return true;
                let parsed;
                if (typeof value === 'string') {
                    try {
                        parsed = JSON.parse(value);
                    } catch {
                        return false;
                    }
                } else {
                    parsed = value;
                }
                return Array.isArray(parsed);
            })
            .withMessage("Stats must be an array"),
        body("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    updateHeroSection
);

// Delete hero section (Admin only)
router.delete(
    "/:heroId",
    [
        param("heroId")
            .isMongoId()
            .withMessage("Valid hero ID is required")
    ],
    validate,
    adminOnly,
    deleteHeroSection
);

// Deactivate hero section (Admin only)
router.patch(
    "/:heroId/deactivate",
    [
        param("heroId")
            .isMongoId()
            .withMessage("Valid hero ID is required")
    ],
    validate,
    adminOnly,
    deactivateHeroSection
);

// Reactivate hero section (Admin only)
router.patch(
    "/:heroId/reactivate",
    [
        param("heroId")
            .isMongoId()
            .withMessage("Valid hero ID is required")
    ],
    validate,
    adminOnly,
    reactivateHeroSection
);

// Get all hero sections for admin (Admin only)
router.get(
    "/admin/all",
    [
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        query("sortBy")
            .optional()
            .isIn(["sortOrder", "createdAt", "title"])
            .withMessage("Invalid sortBy field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("sortOrder must be 'asc' or 'desc'"),
        query("search")
            .optional()
            .isLength({ min: 1 })
            .withMessage("Search query must not be empty")
    ],
    validate,
    adminOnly,
    getAllHeroSectionsAdmin
);

export default router;

