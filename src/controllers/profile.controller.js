import { User } from "../models/user.model.js";
import { Address } from "../models/address.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get user profile
export const getUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Get user's default address
    const defaultAddress = await Address.getUserDefaultAddress(userId);

    res.status(200).json(
        new ApiResponse(200, {
            user,
            defaultAddress
        }, "User profile retrieved successfully")
    );
});

// Update user profile
export const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, phone, dateOfBirth, gender, bio } = req.body;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;

    await user.save({ validateBeforeSave: false });

    // Get updated user without password
    const updatedUser = await User.findById(userId).select("-password -refreshToken");

    res.status(200).json(
        new ApiResponse(200, updatedUser, "User profile updated successfully")
    );
});

// Change user password
export const changePassword = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
        throw new ApiError(400, "Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    );
});

// Update user preferences
export const updateUserPreferences = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { 
        notifications, 
        emailNotifications, 
        smsNotifications, 
        language, 
        timezone,
        theme 
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Initialize preferences if not exists
    if (!user.preferences) {
        user.preferences = {};
    }

    // Update preferences
    if (notifications !== undefined) user.preferences.notifications = notifications;
    if (emailNotifications !== undefined) user.preferences.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) user.preferences.smsNotifications = smsNotifications;
    if (language !== undefined) user.preferences.language = language;
    if (timezone !== undefined) user.preferences.timezone = timezone;
    if (theme !== undefined) user.preferences.theme = theme;

    await user.save({ validateBeforeSave: false });

    res.status(200).json(
        new ApiResponse(200, user.preferences, "User preferences updated successfully")
    );
});

// Get user statistics
export const getUserStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Get user's address count
    const addressCount = await Address.countDocuments({ userId, isActive: true });

    // Get user's default address
    const defaultAddress = await Address.getUserDefaultAddress(userId);

    // Get user's recent addresses
    const recentAddresses = await Address.find({ userId, isActive: true })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select('label city state pincode isDefault addressType');

    res.status(200).json(
        new ApiResponse(200, {
            addressCount,
            hasDefaultAddress: !!defaultAddress,
            defaultAddress: defaultAddress ? defaultAddress.getSummary() : null,
            recentAddresses
        }, "User statistics retrieved successfully")
    );
});

// Upload profile picture (placeholder - would need multer for file upload)
export const uploadProfilePicture = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { profilePictureUrl } = req.body;

    if (!profilePictureUrl) {
        throw new ApiError(400, "Profile picture URL is required");
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { profilePicture: profilePictureUrl },
        { new: true }
    ).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.status(200).json(
        new ApiResponse(200, user, "Profile picture updated successfully")
    );
});

// Delete user account
export const deleteUserAccount = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { password } = req.body;

    const user = await User.findById(userId).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(400, "Password is incorrect");
    }

    // Soft delete user account
    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    // Deactivate all user's addresses
    await Address.updateMany(
        { userId },
        { isActive: false }
    );

    res.status(200).json(
        new ApiResponse(200, {}, "User account deleted successfully")
    );
});

// Get user activity log (placeholder for future implementation)
export const getUserActivityLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // This would typically come from an activity log collection
    // For now, return a placeholder response
    const activities = [
        {
            id: "1",
            type: "profile_updated",
            description: "Profile information updated",
            timestamp: new Date(),
            details: {
                fields: ["name", "phone"]
            }
        },
        {
            id: "2",
            type: "address_added",
            description: "New address added",
            timestamp: new Date(),
            details: {
                addressLabel: "Home"
            }
        }
    ];

    res.status(200).json(
        new ApiResponse(200, {
            activities,
            pagination: {
                currentPage: parseInt(page),
                totalPages: 1,
                totalActivities: activities.length,
                hasNext: false,
                hasPrev: false
            }
        }, "User activity log retrieved successfully")
    );
});

// Export user data (GDPR compliance)
export const exportUserData = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const addresses = await Address.find({ userId, isActive: true });

    const userData = {
        profile: user,
        addresses: addresses,
        exportDate: new Date(),
        dataVersion: "1.0"
    };

    res.status(200).json(
        new ApiResponse(200, userData, "User data exported successfully")
    );
});

