import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

// Verify JWT token
export const verifyJWT = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }

        if (!user.isActive) {
            throw new ApiError(403, "User account is deactivated");
        }

        req.user = user;
        next();
    } catch (error) {
        // Provide more specific error messages
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, "Invalid token format");
        } else if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, "Token expired");
        } else if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError(401, "Invalid access token");
        }
    }
};

// Role-based access control
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Authentication required");
        }

        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, "You do not have permission to access this resource");
        }

        next();
    };
};

// Guest access (limited access)
export const guestAccess = (req, res, next) => {
    if (!req.user) {
        // Allow guest access without authentication
        req.user = { role: "guest" };
    }
    next();
};

// Admin only access
export const adminOnly = authorize("admin");

// Customer and Admin access
export const customerAndAdmin = authorize("customer", "admin");

// All authenticated users
export const authenticatedUsers = authorize("customer", "admin");
