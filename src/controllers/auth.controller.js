import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

// Generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
};

// Register a new user (Customer or Guest only)
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role = "customer", phone } = req.body;

    // Restrict admin registration through regular signup
    if (role === "admin") {
        throw new ApiError(403, "Admin accounts cannot be created through regular registration. Contact system administrator.");
    }

    // Ensure only customer or guest roles are allowed
    if (role && !["customer", "guest"].includes(role)) {
        throw new ApiError(400, "Invalid role. Only 'customer' or 'guest' roles are allowed for registration.");
    }

    // Check if user already exists
    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User with email already exists");
    }

    // Create new user
    const user = await User.create({
        name,
        email,
        password,
        role: role || "customer", // Default to customer if no role specified
        phone
    });

    // Get user details without password
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
});


// Login user
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email and include password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // Check if user is active
    if (!user.isActive) {
        throw new ApiError(403, "User account is deactivated");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Update last login
    await user.updateLastLogin();

    // Get user details without password
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Set cookie options
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );
});

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User profile retrieved successfully")
    );
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    const userId = req.user._id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    await user.save({ validateBeforeSave: false });

    // Get updated user without password
    const updatedUser = await User.findById(userId).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User profile updated successfully")
    );
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Remove refresh token from database
    await User.findByIdAndUpdate(
        userId,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    );

    // Clear cookies
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;


    if (!incomingRefreshToken) {
        throw new ApiError(401, "No refresh token provided");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );


        const user = await User.findById(decodedToken._id);

        if (!user) {
            throw new ApiError(401, "User not found");
        }

        if (!user.refreshToken) {
            throw new ApiError(401, "No refresh token stored for user");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token mismatch");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        // Update user's refresh token in database
        await User.findByIdAndUpdate(user._id, { refreshToken: newRefreshToken });

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        };


        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            );
    } catch (error) {
        console.error('Refresh token error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, "Invalid refresh token format");
        } else if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, "Refresh token expired");
        } else if (error instanceof ApiError) {
            throw error;
        } else {
            throw new ApiError(401, "Invalid refresh token");
        }
    }
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId).select("+password");

    const isPasswordCorrect = await user.comparePassword(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

// Get all users (Admin only)
const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role, search } = req.query;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (search) {
        // Search parameter is already sanitized by middleware
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        select: "-password -refreshToken"
    };

    const users = await User.paginate(filter, options);

    return res.status(200).json(
        new ApiResponse(200, users, "Users retrieved successfully")
    );
});

// Get user by ID (Admin only)
const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User retrieved successfully")
    );
});

// Update user by ID (Admin only)
const updateUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { name, email, role, phone, isActive } = req.body;

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(409, "Email already exists");
        }
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(userId).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "User updated successfully")
    );
});

// Delete user by ID (Admin only)
const deleteUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Soft delete - deactivate user instead of hard delete
    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, {}, "User deactivated successfully")
    );
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal if user exists or not for security
        return res.status(200).json(
            new ApiResponse(200, {}, "If an account with that email exists, we've sent a password reset link.")
        );
    }

    // Generate reset token (simple implementation - in production use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user (you might want to add these fields to your User model)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save({ validateBeforeSave: false });

    // In a real application, you would send an email here
    // For now, we'll just return success
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: ${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`);

    return res.status(200).json(
        new ApiResponse(200, {}, "If an account with that email exists, we've sent a password reset link.")
    );
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        throw new ApiError(400, "Token and new password are required");
    }

    // Find user by reset token
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset token");
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password has been reset successfully")
    );
});

export {
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
};
