import express from "express";
import {
    getAllGalleryImages,
    getGalleryImage,
    getImagesByCategory,
    getFeaturedImages,
    searchGalleryImages,
    getGalleryStats,
    uploadImage,
    uploadMultipleImages,
    updateImage,
    deleteImage,
    toggleFeatured,
    updateSortOrder,
    bulkUpdateImages,
    getAllImagesAdmin,
    getImageAnalytics,
    getGalleryDashboardStats
} from "../controllers/gallery.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { uploadSingle, uploadMultiple } from "../middleware/upload.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// Public routes
router.get(
    "/",
    [
        query("category")
            .optional()
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        query("featured")
            .optional()
            .isBoolean()
            .withMessage("Featured must be a boolean value"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("sortBy")
            .optional()
            .isIn(["createdAt", "title", "sortOrder"])
            .withMessage("Invalid sort field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("Sort order must be asc or desc")
    ],
    validate,
    getAllGalleryImages
);

router.get(
    "/category/:category",
    [
        param("category")
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        query("subcategory")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Subcategory cannot exceed 50 characters"),
        query("featured")
            .optional()
            .isBoolean()
            .withMessage("Featured must be a boolean value"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100")
    ],
    validate,
    getImagesByCategory
);

router.get(
    "/featured/images",
    [
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Limit must be between 1 and 50")
    ],
    validate,
    getFeaturedImages
);

router.get(
    "/search/images",
    [
        query("q")
            .notEmpty()
            .withMessage("Search query is required"),
        query("category")
            .optional()
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Limit must be between 1 and 50")
    ],
    validate,
    searchGalleryImages
);

router.get(
    "/stats/overview",
    getGalleryStats
);

// Get single image by ID (must be last in public routes)
router.get(
    "/:imageId",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required")
    ],
    validate,
    getGalleryImage
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Upload single image
router.post(
    "/upload/single",
    uploadSingle('image'),
    [
        body("title")
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Title is required and must be between 1 and 100 characters"),
        body("category")
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("subcategory")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Subcategory cannot exceed 50 characters"),
        body("tags")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    const tags = value.split(',').map(tag => tag.trim());
                    if (tags.length > 10) {
                        throw new Error('Maximum 10 tags allowed');
                    }
                    for (const tag of tags) {
                        if (tag.length > 30) {
                            throw new Error('Each tag cannot exceed 30 characters');
                        }
                    }
                }
                return true;
            }),
        body("altText")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Alt text cannot exceed 200 characters"),
        body("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean value"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("metadata")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    try {
                        JSON.parse(value);
                    } catch (error) {
                        throw new Error('Invalid JSON format for metadata');
                    }
                }
                return true;
            })
    ],
    validate,
    adminOnly,
    uploadImage
);

// Upload multiple images
router.post(
    "/upload/multiple",
    uploadMultiple('images', 10),
    adminOnly,
    [
        body("category")
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        body("subcategory")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Subcategory cannot exceed 50 characters"),
        body("tags")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    const tags = value.split(',').map(tag => tag.trim());
                    if (tags.length > 10) {
                        throw new Error('Maximum 10 tags allowed');
                    }
                    for (const tag of tags) {
                        if (tag.length > 30) {
                            throw new Error('Each tag cannot exceed 30 characters');
                        }
                    }
                }
                return true;
            }),
        body("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean value"),
        body("metadata")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    try {
                        JSON.parse(value);
                    } catch (error) {
                        throw new Error('Invalid JSON format for metadata');
                    }
                }
                return true;
            })
    ],
    validate,
    uploadMultipleImages
);

// Update image
router.put(
    "/:imageId",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required"),
        body("title")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Title must be between 1 and 100 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("subcategory")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Subcategory cannot exceed 50 characters"),
        body("tags")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    const tags = value.split(',').map(tag => tag.trim());
                    if (tags.length > 10) {
                        throw new Error('Maximum 10 tags allowed');
                    }
                    for (const tag of tags) {
                        if (tag.length > 30) {
                            throw new Error('Each tag cannot exceed 30 characters');
                        }
                    }
                }
                return true;
            }),
        body("altText")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Alt text cannot exceed 200 characters"),
        body("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean value"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer"),
        body("metadata")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    try {
                        JSON.parse(value);
                    } catch (error) {
                        throw new Error('Invalid JSON format for metadata');
                    }
                }
                return true;
            })
    ],
    validate,
    adminOnly,
    updateImage
);

// Delete image
router.delete(
    "/:imageId",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required")
    ],
    validate,
    adminOnly,
    deleteImage
);

// Toggle featured status
router.patch(
    "/:imageId/toggle-featured",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required")
    ],
    validate,
    adminOnly,
    toggleFeatured
);

// Update sort order
router.patch(
    "/:imageId/sort-order",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required"),
        body("sortOrder")
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    updateSortOrder
);

// Bulk update images
router.put(
    "/bulk/update",
    [
        body("imageIds")
            .isArray({ min: 1 })
            .withMessage("Image IDs array is required and cannot be empty"),
        body("imageIds.*")
            .isMongoId()
            .withMessage("Each image ID must be valid"),
        body("updateData")
            .isObject()
            .withMessage("Update data must be an object"),
        body("updateData.title")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Title must be between 1 and 100 characters"),
        body("updateData.description")
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Description cannot exceed 500 characters"),
        body("updateData.isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean value"),
        body("updateData.sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    bulkUpdateImages
);

// Get all images (admin)
router.get(
    "/admin/all",
    [
        query("category")
            .optional()
            .isIn(["Hair", "Skin", "Nail", "Body"])
            .withMessage("Category must be one of: Hair, Skin, Nail, Body"),
        query("subcategory")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Subcategory cannot exceed 50 characters"),
        query("featured")
            .optional()
            .isBoolean()
            .withMessage("Featured must be a boolean value"),
        query("isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean value"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("sortBy")
            .optional()
            .isIn(["createdAt", "title", "sortOrder"])
            .withMessage("Invalid sort field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("Sort order must be asc or desc")
    ],
    validate,
    adminOnly,
    getAllImagesAdmin
);

// Get image analytics
router.get(
    "/admin/:imageId/analytics",
    [
        param("imageId")
            .isMongoId()
            .withMessage("Valid image ID is required")
    ],
    validate,
    adminOnly,
    getImageAnalytics
);

// Get gallery dashboard stats
router.get(
    "/admin/dashboard/stats",
    adminOnly,
    getGalleryDashboardStats
);

export default router;






