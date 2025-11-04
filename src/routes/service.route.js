import express from "express";
import { 
    getAllServices, 
    getService, 
    createService, 
    updateService, 
    deleteService, 
    deactivateService, 
    reactivateService, 
    getServiceStats,
    getServicesByCategory,
    getServicesBySubCategory,
    getFeaturedServices,
    getServiceCategories,
    getServiceSubCategories,
    uploadServicePhoto,
    toggleFeatured,
    updateSortOrder,
    bulkUpdateServices,
    getAllServicesAdmin
} from "../controllers/service.controller.js";
import { verifyJWT, adminOnly } from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";
import { uploadSingle } from "../middleware/upload.middleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.get(
    "/",
    [
        query("category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        query("isActive")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('isActive must be a boolean');
            }),
        query("isFeatured")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('isFeatured must be a boolean');
            }),
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
            .isIn(["name", "price", "duration", "createdAt", "sortOrder"])
            .withMessage("Invalid sort field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("Sort order must be asc or desc")
    ],
    validate,
    getAllServices
);

// Get services by category
router.get(
    "/category/:category",
    [
        param("category")
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean")
    ],
    validate,
    getServicesByCategory
);

// Get services by subcategory
router.get(
    "/subcategory/:subCategory",
    [
        param("subCategory")
            .isLength({ min: 1, max: 50 })
            .withMessage("Valid sub-category is required"),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean")
    ],
    validate,
    getServicesBySubCategory
);

// Get featured services
router.get(
    "/featured/list",
    [
        query("category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Limit must be between 1 and 50")
    ],
    validate,
    getFeaturedServices
);

// Get service categories
router.get(
    "/categories/list",
    getServiceCategories
);

// Get service subcategories
router.get(
    "/subcategories/list",
    [
        query("category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category")
    ],
    validate,
    getServiceSubCategories
);

router.get(
    "/:serviceId",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    getService
);

// Admin routes (authentication required)
router.use(verifyJWT);

// Create service (Admin only)
router.post(
    "/",
    (req, res, next) => {
        next();
    },
    uploadSingle('photo'),
    [
        body("name")
            .isLength({ min: 1, max: 100 })
            .withMessage("Service name is required and cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Description cannot exceed 1000 characters"),
        body("duration")
            .isInt({ min: 15, max: 480 })
            .withMessage("Duration must be between 15 and 480 minutes"),
        body("price")
            .isFloat({ min: 0, max: 999999 })
            .withMessage("Price must be between 0 and 999999"),
        body("category")
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Valid category is required"),
        body("subCategory")
            .isLength({ min: 1, max: 50 })
            .withMessage("Service sub-category is required and cannot exceed 50 characters"),
        body("icon")
            .isLength({ min: 1, max: 50 })
            .withMessage("Service icon is required and cannot exceed 50 characters"),
        body("tags")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    const tags = value.split(',').map(tag => tag.trim());
                    return tags.every(tag => tag.length <= 30);
                }
                if (Array.isArray(value)) {
                    return value.every(tag => typeof tag === 'string' && tag.length <= 30);
                }
                return true;
            })
            .withMessage("Tags must be valid and each tag cannot exceed 30 characters"),
        body("availableAtHome")
            .optional()
            .isBoolean()
            .withMessage("availableAtHome must be a boolean"),
        body("availableAtSalon")
            .optional()
            .isBoolean()
            .withMessage("availableAtSalon must be a boolean"),
        body("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    createService
);

// Update service (Admin only)
router.put(
    "/:serviceId",
    uploadSingle('photo'),
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required"),
        body("name")
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage("Service name cannot exceed 100 characters"),
        body("description")
            .optional()
            .isLength({ max: 1000 })
            .withMessage("Description cannot exceed 1000 characters"),
        body("duration")
            .optional()
            .isInt({ min: 15, max: 480 })
            .withMessage("Duration must be between 15 and 480 minutes"),
        body("price")
            .optional()
            .isFloat({ min: 0, max: 999999 })
            .withMessage("Price must be between 0 and 999999"),
        body("category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        body("subCategory")
            .optional()
            .isLength({ min: 1, max: 50 })
            .withMessage("Service sub-category cannot exceed 50 characters"),
        body("icon")
            .optional()
            .isLength({ min: 1, max: 50 })
            .withMessage("Service icon cannot exceed 50 characters"),
        body("tags")
            .optional()
            .custom((value) => {
                if (typeof value === 'string') {
                    const tags = value.split(',').map(tag => tag.trim());
                    return tags.every(tag => tag.length <= 30);
                }
                if (Array.isArray(value)) {
                    return value.every(tag => typeof tag === 'string' && tag.length <= 30);
                }
                return true;
            })
            .withMessage("Tags must be valid and each tag cannot exceed 30 characters"),
        body("availableAtHome")
            .optional()
            .isBoolean()
            .withMessage("availableAtHome must be a boolean"),
        body("availableAtSalon")
            .optional()
            .isBoolean()
            .withMessage("availableAtSalon must be a boolean"),
        body("isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean"),
        body("sortOrder")
            .optional()
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    updateService
);

// Delete service (Admin only)
router.delete(
    "/:serviceId",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    adminOnly,
    deleteService
);

// Deactivate service (Admin only)
router.patch(
    "/:serviceId/deactivate",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    adminOnly,
    deactivateService
);

// Reactivate service (Admin only)
router.patch(
    "/:serviceId/reactivate",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    adminOnly,
    reactivateService
);

// Get all services for admin with pagination and filtering
router.get(
    "/admin/all",
    [
        query("category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        query("subCategory")
            .optional()
            .isString()
            .withMessage("Subcategory must be a string"),
        query("isActive")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('isActive must be a boolean');
            }),
        query("isFeatured")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('isFeatured must be a boolean');
            }),
        query("availableAtHome")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('availableAtHome must be a boolean');
            }),
        query("availableAtSalon")
            .optional()
            .custom((value) => {
                if (value === 'true' || value === 'false' || value === true || value === false) {
                    return true;
                }
                throw new Error('availableAtSalon must be a boolean');
            }),
        query("search")
            .optional()
            .isString()
            .withMessage("Search must be a string"),
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
            .isIn(["name", "price", "duration", "createdAt", "updatedAt", "sortOrder"])
            .withMessage("Invalid sort field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("Sort order must be asc or desc")
    ],
    validate,
    adminOnly,
    getAllServicesAdmin
);

// Get service statistics (Admin only)
router.get(
    "/admin/stats",
    adminOnly,
    getServiceStats
);

// Upload service photo (Admin only)
router.post(
    "/:serviceId/photo",
    uploadSingle('photo'),
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    adminOnly,
    uploadServicePhoto
);

// Toggle featured status (Admin only)
router.patch(
    "/:serviceId/featured",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required")
    ],
    validate,
    adminOnly,
    toggleFeatured
);

// Update sort order (Admin only)
router.patch(
    "/:serviceId/sort-order",
    [
        param("serviceId")
            .isMongoId()
            .withMessage("Valid service ID is required"),
        body("sortOrder")
            .isInt({ min: 0 })
            .withMessage("Sort order must be a non-negative integer")
    ],
    validate,
    adminOnly,
    updateSortOrder
);

// Bulk update services (Admin only)
router.patch(
    "/bulk-update",
    [
        body("serviceIds")
            .isArray({ min: 1 })
            .withMessage("Service IDs array is required and cannot be empty"),
        body("serviceIds.*")
            .isMongoId()
            .withMessage("Each service ID must be a valid MongoDB ObjectId"),
        body("updateData")
            .isObject()
            .withMessage("Update data is required"),
        body("updateData.category")
            .optional()
            .isIn(["hair", "nail", "body", "skin"])
            .withMessage("Invalid category"),
        body("updateData.subCategory")
            .optional()
            .isLength({ min: 1, max: 50 })
            .withMessage("Sub-category cannot exceed 50 characters"),
        body("updateData.availableAtHome")
            .optional()
            .isBoolean()
            .withMessage("availableAtHome must be a boolean"),
        body("updateData.availableAtSalon")
            .optional()
            .isBoolean()
            .withMessage("availableAtSalon must be a boolean"),
        body("updateData.isActive")
            .optional()
            .isBoolean()
            .withMessage("isActive must be a boolean"),
        body("updateData.isFeatured")
            .optional()
            .isBoolean()
            .withMessage("isFeatured must be a boolean"),
        body("updateData.discount.percentage")
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage("Discount percentage must be between 0 and 100"),
        body("updateData.discount.isActive")
            .optional()
            .isBoolean()
            .withMessage("Discount isActive must be a boolean"),
        body("updateData.discount.validFrom")
            .optional()
            .isISO8601()
            .withMessage("Valid from date must be a valid ISO 8601 date"),
        body("updateData.discount.validUntil")
            .optional()
            .isISO8601()
            .withMessage("Valid until date must be a valid ISO 8601 date")
    ],
    validate,
    adminOnly,
    bulkUpdateServices
);

export default router;
