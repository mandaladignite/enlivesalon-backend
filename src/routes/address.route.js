import express from "express";
import {
    getUserAddresses,
    getAddress,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    searchAddressesByLocation,
    validateAddress,
    getAddressStats,
    duplicateAddress,
    bulkUpdateAddresses
} from "../controllers/address.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validation.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get user's addresses
router.get(
    "/",
    [
        query("includeInactive")
            .optional()
            .isBoolean()
            .withMessage("includeInactive must be a boolean value")
    ],
    validate,
    getUserAddresses
);

// Get single address
router.get(
    "/:addressId",
    [
        param("addressId")
            .isMongoId()
            .withMessage("Valid address ID is required")
    ],
    validate,
    getAddress
);

// Create new address
router.post(
    "/",
    [
        body("label")
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage("Label is required and must be between 1 and 50 characters"),
        body("street")
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage("Street address is required and must be between 5 and 200 characters"),
        body("city")
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("City is required and must be between 2 and 50 characters"),
        body("state")
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("State is required and must be between 2 and 50 characters"),
        body("pincode")
            .matches(/^[1-9][0-9]{5}$/)
            .withMessage("Pincode must be a valid 6-digit number"),
        body("country")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Country name cannot exceed 50 characters"),
        body("landmark")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Landmark cannot exceed 100 characters"),
        body("isDefault")
            .optional()
            .isBoolean()
            .withMessage("isDefault must be a boolean value"),
        body("addressType")
            .optional()
            .isIn(["home", "work", "other"])
            .withMessage("Address type must be home, work, or other"),
        body("coordinates.latitude")
            .optional()
            .isFloat({ min: -90, max: 90 })
            .withMessage("Latitude must be between -90 and 90"),
        body("coordinates.longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be between -180 and 180"),
        body("contactNumber")
            .optional()
            .matches(/^[\+]?[1-9][\d]{0,15}$/)
            .withMessage("Please enter a valid contact number"),
        body("instructions")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Instructions cannot exceed 200 characters")
    ],
    validate,
    createAddress
);

// Update address
router.put(
    "/:addressId",
    [
        param("addressId")
            .isMongoId()
            .withMessage("Valid address ID is required"),
        body("label")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage("Label must be between 1 and 50 characters"),
        body("street")
            .optional()
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage("Street address must be between 5 and 200 characters"),
        body("city")
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("City must be between 2 and 50 characters"),
        body("state")
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("State must be between 2 and 50 characters"),
        body("pincode")
            .optional()
            .matches(/^[1-9][0-9]{5}$/)
            .withMessage("Pincode must be a valid 6-digit number"),
        body("country")
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage("Country name cannot exceed 50 characters"),
        body("landmark")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Landmark cannot exceed 100 characters"),
        body("isDefault")
            .optional()
            .isBoolean()
            .withMessage("isDefault must be a boolean value"),
        body("addressType")
            .optional()
            .isIn(["home", "work", "other"])
            .withMessage("Address type must be home, work, or other"),
        body("coordinates.latitude")
            .optional()
            .isFloat({ min: -90, max: 90 })
            .withMessage("Latitude must be between -90 and 90"),
        body("coordinates.longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be between -180 and 180"),
        body("contactNumber")
            .optional()
            .matches(/^[\+]?[1-9][\d]{0,15}$/)
            .withMessage("Please enter a valid contact number"),
        body("instructions")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Instructions cannot exceed 200 characters")
    ],
    validate,
    updateAddress
);

// Delete address
router.delete(
    "/:addressId",
    [
        param("addressId")
            .isMongoId()
            .withMessage("Valid address ID is required")
    ],
    validate,
    deleteAddress
);

// Set default address
router.patch(
    "/:addressId/set-default",
    [
        param("addressId")
            .isMongoId()
            .withMessage("Valid address ID is required")
    ],
    validate,
    setDefaultAddress
);

// Get default address
router.get(
    "/default/current",
    getDefaultAddress
);

// Search addresses by location
router.get(
    "/search/location",
    [
        query("city")
            .optional()
            .trim()
            .isLength({ min: 2 })
            .withMessage("City must be at least 2 characters long"),
        query("state")
            .optional()
            .trim()
            .isLength({ min: 2 })
            .withMessage("State must be at least 2 characters long"),
        query("pincode")
            .optional()
            .matches(/^[1-9][0-9]{5}$/)
            .withMessage("Pincode must be a valid 6-digit number")
    ],
    validate,
    searchAddressesByLocation
);

// Validate address
router.post(
    "/validate",
    [
        body("street")
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage("Street address is required and must be between 5 and 200 characters"),
        body("city")
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("City is required and must be between 2 and 50 characters"),
        body("state")
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("State is required and must be between 2 and 50 characters"),
        body("pincode")
            .matches(/^[1-9][0-9]{5}$/)
            .withMessage("Pincode must be a valid 6-digit number")
    ],
    validate,
    validateAddress
);

// Get address statistics
router.get(
    "/stats/overview",
    getAddressStats
);

// Duplicate address
router.post(
    "/:addressId/duplicate",
    [
        param("addressId")
            .isMongoId()
            .withMessage("Valid address ID is required"),
        body("newLabel")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage("New label must be between 1 and 50 characters")
    ],
    validate,
    duplicateAddress
);

// Bulk update addresses
router.put(
    "/bulk/update",
    [
        body("updates")
            .isArray({ min: 1 })
            .withMessage("Updates array is required and cannot be empty"),
        body("updates.*.addressId")
            .isMongoId()
            .withMessage("Each update must have a valid address ID"),
        body("updates.*.label")
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage("Label must be between 1 and 50 characters"),
        body("updates.*.street")
            .optional()
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage("Street address must be between 5 and 200 characters"),
        body("updates.*.city")
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("City must be between 2 and 50 characters"),
        body("updates.*.state")
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage("State must be between 2 and 50 characters"),
        body("updates.*.pincode")
            .optional()
            .matches(/^[1-9][0-9]{5}$/)
            .withMessage("Pincode must be a valid 6-digit number"),
        body("updates.*.isDefault")
            .optional()
            .isBoolean()
            .withMessage("isDefault must be a boolean value"),
        body("updates.*.addressType")
            .optional()
            .isIn(["home", "work", "other"])
            .withMessage("Address type must be home, work, or other")
    ],
    validate,
    bulkUpdateAddresses
);

export default router;

