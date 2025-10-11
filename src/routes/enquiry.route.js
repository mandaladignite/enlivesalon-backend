import express from "express";
import {
    createEnquiry,
    getAllEnquiries,
    getEnquiry,
    updateEnquiry,
    deleteEnquiry,
    respondToEnquiry,
    assignEnquiry,
    updateEnquiryStatus,
    getEnquiryStats,
    getUserEnquiries,
    searchEnquiries,
    getEnquiriesByPriority,
    bulkUpdateEnquiries
} from "../controllers/enquiry.controller.js";
import { verifyJWT, adminOnly, customerAndAdmin } from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// Public route - Create enquiry (no authentication required)
router.post(
    "/",
    [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Name is required")
            .isLength({ max: 100 })
            .withMessage("Name cannot exceed 100 characters"),
        body("email")
            .isEmail()
            .withMessage("Please enter a valid email")
            .normalizeEmail()
            .isLength({ max: 100 })
            .withMessage("Email cannot exceed 100 characters"),
        body("phone")
            .trim()
            .notEmpty()
            .withMessage("Phone number is required")
            .isLength({ max: 20 })
            .withMessage("Phone number cannot exceed 20 characters"),
        body("subject")
            .trim()
            .notEmpty()
            .withMessage("Subject is required")
            .isLength({ max: 200 })
            .withMessage("Subject cannot exceed 200 characters"),
        body("message")
            .trim()
            .notEmpty()
            .withMessage("Message is required")
            .isLength({ max: 2000 })
            .withMessage("Message cannot exceed 2000 characters"),
        body("enquiryType")
            .optional()
            .isIn(["general", "appointment", "service", "product", "membership", "complaint", "feedback", "other"])
            .withMessage("Invalid enquiry type"),
        body("priority")
            .optional()
            .isIn(["low", "medium", "high", "urgent"])
            .withMessage("Invalid priority level"),
        body("source")
            .optional()
            .isIn(["website", "phone", "email", "walk_in", "social_media", "referral", "other"])
            .withMessage("Invalid source"),
        body("tags")
            .optional()
            .isArray()
            .withMessage("Tags must be an array"),
        body("tags.*")
            .optional()
            .trim()
            .isLength({ max: 30 })
            .withMessage("Each tag cannot exceed 30 characters")
    ],
    validate,
    createEnquiry
);

// Apply JWT authentication to all routes below
router.use(verifyJWT);

// Get user's enquiries
router.get(
    "/my-enquiries",
    [
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("status")
            .optional()
            .isIn(["all", "new", "in_progress", "responded", "resolved", "closed"])
            .withMessage("Invalid status"),
        query("enquiryType")
            .optional()
            .isIn(["general", "appointment", "service", "product", "membership", "complaint", "feedback", "other"])
            .withMessage("Invalid enquiry type")
    ],
    validate,
    getUserEnquiries
);

// Admin routes
router.get(
    "/",
    [
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Page must be a positive integer"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Limit must be between 1 and 100"),
        query("status")
            .optional()
            .isIn(["all", "new", "in_progress", "responded", "resolved", "closed"])
            .withMessage("Invalid status"),
        query("enquiryType")
            .optional()
            .isIn(["general", "appointment", "service", "product", "membership", "complaint", "feedback", "other"])
            .withMessage("Invalid enquiry type"),
        query("priority")
            .optional()
            .isIn(["low", "medium", "high", "urgent"])
            .withMessage("Invalid priority level"),
        query("assignedTo")
            .optional()
            .isMongoId()
            .withMessage("Invalid assigned user ID"),
        query("search")
            .optional()
            .trim()
            .isLength({ min: 1 })
            .withMessage("Search query cannot be empty"),
        query("sortBy")
            .optional()
            .isIn(["createdAt", "updatedAt", "priority", "status", "name", "subject"])
            .withMessage("Invalid sort field"),
        query("sortOrder")
            .optional()
            .isIn(["asc", "desc"])
            .withMessage("Sort order must be 'asc' or 'desc'")
    ],
    validate,
    adminOnly,
    getAllEnquiries
);

// Search enquiries
router.get(
    "/search",
    [
        query("q")
            .trim()
            .notEmpty()
            .withMessage("Search query is required")
            .isLength({ min: 1 })
            .withMessage("Search query cannot be empty"),
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
    adminOnly,
    searchEnquiries
);

// Get enquiries by priority
router.get(
    "/priority/:priority",
    [
        param("priority")
            .isIn(["low", "medium", "high", "urgent"])
            .withMessage("Invalid priority level"),
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
    adminOnly,
    getEnquiriesByPriority
);

// Get enquiry statistics
router.get(
    "/stats",
    adminOnly,
    getEnquiryStats
);

// Get single enquiry
router.get(
    "/:id",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID")
    ],
    validate,
    customerAndAdmin,
    getEnquiry
);

// Update enquiry
router.put(
    "/:id",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID"),
        body("name")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Name cannot exceed 100 characters"),
        body("email")
            .optional()
            .isEmail()
            .withMessage("Please enter a valid email")
            .normalizeEmail()
            .isLength({ max: 100 })
            .withMessage("Email cannot exceed 100 characters"),
        body("phone")
            .optional()
            .trim()
            .isLength({ max: 20 })
            .withMessage("Phone number cannot exceed 20 characters"),
        body("subject")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Subject cannot exceed 200 characters"),
        body("message")
            .optional()
            .trim()
            .isLength({ max: 2000 })
            .withMessage("Message cannot exceed 2000 characters"),
        body("enquiryType")
            .optional()
            .isIn(["general", "appointment", "service", "product", "membership", "complaint", "feedback", "other"])
            .withMessage("Invalid enquiry type"),
        body("priority")
            .optional()
            .isIn(["low", "medium", "high", "urgent"])
            .withMessage("Invalid priority level"),
        body("status")
            .optional()
            .isIn(["all", "new", "in_progress", "responded", "resolved", "closed"])
            .withMessage("Invalid status"),
        body("assignedTo")
            .optional()
            .isMongoId()
            .withMessage("Invalid assigned user ID"),
        body("tags")
            .optional()
            .isArray()
            .withMessage("Tags must be an array"),
        body("tags.*")
            .optional()
            .trim()
            .isLength({ max: 30 })
            .withMessage("Each tag cannot exceed 30 characters")
    ],
    validate,
    customerAndAdmin,
    updateEnquiry
);

// Respond to enquiry
router.post(
    "/:id/respond",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID"),
        body("message")
            .trim()
            .notEmpty()
            .withMessage("Response message is required")
            .isLength({ max: 2000 })
            .withMessage("Response message cannot exceed 2000 characters"),
        body("responseMethod")
            .optional()
            .isIn(["email", "phone", "whatsapp", "in_person"])
            .withMessage("Invalid response method")
    ],
    validate,
    adminOnly,
    respondToEnquiry
);

// Assign enquiry
router.post(
    "/:id/assign",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID"),
        body("assignedTo")
            .isMongoId()
            .withMessage("Assigned user ID is required")
    ],
    validate,
    adminOnly,
    assignEnquiry
);

// Update enquiry status
router.patch(
    "/:id/status",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID"),
        body("status")
            .isIn(["all", "new", "in_progress", "responded", "resolved", "closed"])
            .withMessage("Invalid status")
    ],
    validate,
    adminOnly,
    updateEnquiryStatus
);

// Bulk update enquiries
router.patch(
    "/bulk-update",
    [
        body("enquiryIds")
            .isArray({ min: 1 })
            .withMessage("Enquiry IDs array is required"),
        body("enquiryIds.*")
            .isMongoId()
            .withMessage("Invalid enquiry ID"),
        body("updateData")
            .isObject()
            .withMessage("Update data is required")
    ],
    validate,
    adminOnly,
    bulkUpdateEnquiries
);

// Delete enquiry (soft delete)
router.delete(
    "/:id",
    [
        param("id")
            .isMongoId()
            .withMessage("Invalid enquiry ID")
    ],
    validate,
    adminOnly,
    deleteEnquiry
);

export default router;
