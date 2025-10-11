import express from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    refreshAccessToken,
    changePassword,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    forgotPassword,
    resetPassword
} from "../controllers/auth.controller.js";
import { verifyJWT, adminOnly, authenticatedUsers } from "../middleware/auth.middleware.js";
import { authRateLimit, lenientAuthRateLimit, devAuthRateLimit, smartDevAuthRateLimit } from "../middleware/security.middleware.js";
import { body } from "express-validator";

const router = express.Router();

// Validation middleware
const registerValidation = [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 50 }).withMessage("Name cannot exceed 50 characters"),
    body("email").isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").optional().isIn(["guest", "customer"]).withMessage("Invalid role. Only 'guest' or 'customer' roles are allowed for registration"),
    body("phone").optional().isMobilePhone().withMessage("Please enter a valid phone number")
];


const loginValidation = [
    body("email").isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required")
];

const updateProfileValidation = [
    body("name").optional().trim().isLength({ max: 50 }).withMessage("Name cannot exceed 50 characters"),
    body("phone").optional().isMobilePhone().withMessage("Please enter a valid phone number")
];

const changePasswordValidation = [
    body("oldPassword").notEmpty().withMessage("Old password is required"),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters")
];

const updateUserValidation = [
    body("name").optional().trim().isLength({ max: 50 }).withMessage("Name cannot exceed 50 characters"),
    body("email").optional().isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body("role").optional().isIn(["guest", "customer", "admin"]).withMessage("Invalid role"),
    body("phone").optional().isMobilePhone().withMessage("Please enter a valid phone number"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean")
];

// Public routes with enhanced rate limiting
router.post("/register", smartDevAuthRateLimit, registerValidation, registerUser);
router.post("/login", smartDevAuthRateLimit, loginValidation, loginUser);
router.post("/refresh-token", smartDevAuthRateLimit, refreshAccessToken);
router.post("/forgot-password", smartDevAuthRateLimit, forgotPassword);
router.post("/reset-password", smartDevAuthRateLimit, resetPassword);


// Protected routes (require authentication)
router.post("/logout", verifyJWT, logoutUser);
router.get("/profile", verifyJWT, getUserProfile);
router.put("/profile", verifyJWT, updateProfileValidation, updateUserProfile);
router.put("/change-password", verifyJWT, changePasswordValidation, changePassword);

// Admin only routes
router.get("/users", verifyJWT, adminOnly, getAllUsers);
router.get("/users/:userId", verifyJWT, adminOnly, getUserById);
router.put("/users/:userId", verifyJWT, adminOnly, updateUserValidation, updateUserById);
router.delete("/users/:userId", verifyJWT, adminOnly, deleteUserById);

export default router;