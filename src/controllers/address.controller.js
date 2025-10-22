import { Address } from "../models/address.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get user's addresses
export const getUserAddresses = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { includeInactive = false } = req.query;

    const addresses = await Address.getUserAddresses(userId, includeInactive === 'true');

    res.status(200).json(
        new ApiResponse(200, addresses, "User addresses retrieved successfully")
    );
});

// Get single address
export const getAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user._id;

    const address = await Address.findOne({
        _id: addressId,
        userId: userId
    });

    if (!address) {
        throw new ApiError(404, "Address not found");
    }

    res.status(200).json(
        new ApiResponse(200, address, "Address retrieved successfully")
    );
});

// Create new address
export const createAddress = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {
        label,
        street,
        city,
        state,
        pincode,
        country = "India",
        landmark,
        isDefault = false,
        addressType = "home",
        coordinates,
        contactNumber,
        instructions
    } = req.body;

    // Check if user already has an address with the same label
    const existingAddress = await Address.findOne({
        userId,
        label: { $regex: new RegExp(`^${label}$`, 'i') },
        isActive: true
    });

    if (existingAddress) {
        throw new ApiError(400, "An address with this label already exists");
    }

    // If this is being set as default, unset other default addresses
    if (isDefault) {
        await Address.updateMany(
            { userId, isDefault: true },
            { isDefault: false }
        );
    }

    const address = await Address.create({
        userId,
        label,
        street,
        city,
        state,
        pincode,
        country,
        landmark,
        isDefault,
        addressType,
        coordinates,
        contactNumber,
        instructions
    });

    res.status(201).json(
        new ApiResponse(201, address, "Address created successfully")
    );
});

// Update address
export const updateAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    const address = await Address.findOne({
        _id: addressId,
        userId: userId
    });

    if (!address) {
        throw new ApiError(404, "Address not found");
    }

    // Check if label is being updated and if it conflicts with existing address
    if (updateData.label && updateData.label !== address.label) {
        const existingAddress = await Address.findOne({
            userId,
            label: { $regex: new RegExp(`^${updateData.label}$`, 'i') },
            _id: { $ne: addressId },
            isActive: true
        });

        if (existingAddress) {
            throw new ApiError(400, "An address with this label already exists");
        }
    }

    // If this is being set as default, unset other default addresses
    if (updateData.isDefault && updateData.isDefault !== address.isDefault) {
        await Address.updateMany(
            { userId, _id: { $ne: addressId } },
            { isDefault: false }
        );
    }

    const updatedAddress = await Address.findByIdAndUpdate(
        addressId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedAddress, "Address updated successfully")
    );
});

// Delete address (soft delete)
export const deleteAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user._id;

    const address = await Address.findOne({
        _id: addressId,
        userId: userId
    });

    if (!address) {
        throw new ApiError(404, "Address not found");
    }

    // If this is the default address, set another address as default
    if (address.isDefault) {
        const nextAddress = await Address.findOne({
            userId,
            _id: { $ne: addressId },
            isActive: true
        });

        if (nextAddress) {
            nextAddress.isDefault = true;
            await nextAddress.save();
        }
    }

    // Soft delete the address
    address.isActive = false;
    await address.save();

    res.status(200).json(
        new ApiResponse(200, {}, "Address deleted successfully")
    );
});

// Set default address
export const setDefaultAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user._id;

    const address = await Address.findOne({
        _id: addressId,
        userId: userId,
        isActive: true
    });

    if (!address) {
        throw new ApiError(404, "Address not found");
    }

    const updatedAddress = await Address.setDefaultAddress(userId, addressId);

    res.status(200).json(
        new ApiResponse(200, updatedAddress, "Default address updated successfully")
    );
});

// Get default address
export const getDefaultAddress = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const address = await Address.getUserDefaultAddress(userId);

    if (!address) {
        throw new ApiError(404, "No default address found");
    }

    res.status(200).json(
        new ApiResponse(200, address, "Default address retrieved successfully")
    );
});

// Search addresses by location
export const searchAddressesByLocation = asyncHandler(async (req, res) => {
    const { city, state, pincode } = req.query;

    if (!city && !state && !pincode) {
        throw new ApiError(400, "At least one search parameter (city, state, pincode) is required");
    }

    const addresses = await Address.getAddressesByLocation(city, state, pincode);

    res.status(200).json(
        new ApiResponse(200, addresses, "Addresses found successfully")
    );
});

// Validate address
export const validateAddress = asyncHandler(async (req, res) => {
    const { street, city, state, pincode } = req.body;

    // Basic validation
    const validation = {
        isValid: true,
        errors: []
    };

    if (!street || street.trim().length < 5) {
        validation.isValid = false;
        validation.errors.push("Street address must be at least 5 characters long");
    }

    if (!city || city.trim().length < 2) {
        validation.isValid = false;
        validation.errors.push("City name must be at least 2 characters long");
    }

    if (!state || state.trim().length < 2) {
        validation.isValid = false;
        validation.errors.push("State name must be at least 2 characters long");
    }

    if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
        validation.isValid = false;
        validation.errors.push("Pincode must be a valid 6-digit number");
    }

    res.status(200).json(
        new ApiResponse(200, validation, "Address validation completed")
    );
});

// Get address statistics
export const getAddressStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const stats = await Address.aggregate([
        { $match: { userId, isActive: true } },
        {
            $group: {
                _id: null,
                totalAddresses: { $sum: 1 },
                defaultAddress: {
                    $sum: { $cond: [{ $eq: ["$isDefault", true] }, 1, 0] }
                },
                homeAddresses: {
                    $sum: { $cond: [{ $eq: ["$addressType", "home"] }, 1, 0] }
                },
                workAddresses: {
                    $sum: { $cond: [{ $eq: ["$addressType", "work"] }, 1, 0] }
                },
                otherAddresses: {
                    $sum: { $cond: [{ $eq: ["$addressType", "other"] }, 1, 0] }
                }
            }
        }
    ]);

    const cityStats = await Address.aggregate([
        { $match: { userId, isActive: true } },
        {
            $group: {
                _id: "$city",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);

    const stateStats = await Address.aggregate([
        { $match: { userId, isActive: true } },
        {
            $group: {
                _id: "$state",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalAddresses: 0,
                defaultAddress: 0,
                homeAddresses: 0,
                workAddresses: 0,
                otherAddresses: 0
            },
            cityStats,
            stateStats
        }, "Address statistics retrieved successfully")
    );
});

// Duplicate address
export const duplicateAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user._id;
    const { newLabel } = req.body;

    const originalAddress = await Address.findOne({
        _id: addressId,
        userId: userId,
        isActive: true
    });

    if (!originalAddress) {
        throw new ApiError(404, "Address not found");
    }

    // Check if new label already exists
    if (newLabel) {
        const existingAddress = await Address.findOne({
            userId,
            label: { $regex: new RegExp(`^${newLabel}$`, 'i') },
            isActive: true
        });

        if (existingAddress) {
            throw new ApiError(400, "An address with this label already exists");
        }
    }

    // Create duplicate address
    const duplicateData = {
        userId,
        label: newLabel || `${originalAddress.label} (Copy)`,
        street: originalAddress.street,
        city: originalAddress.city,
        state: originalAddress.state,
        pincode: originalAddress.pincode,
        country: originalAddress.country,
        landmark: originalAddress.landmark,
        isDefault: false, // Duplicated addresses are never default
        addressType: originalAddress.addressType,
        coordinates: originalAddress.coordinates,
        contactNumber: originalAddress.contactNumber,
        instructions: originalAddress.instructions
    };

    const duplicatedAddress = await Address.create(duplicateData);

    res.status(201).json(
        new ApiResponse(201, duplicatedAddress, "Address duplicated successfully")
    );
});

// Bulk update addresses
export const bulkUpdateAddresses = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ApiError(400, "Updates array is required and cannot be empty");
    }

    const results = [];

    for (const update of updates) {
        const { addressId, ...updateData } = update;

        if (!addressId) {
            results.push({
                addressId: null,
                success: false,
                error: "Address ID is required"
            });
            continue;
        }

        try {
            const address = await Address.findOne({
                _id: addressId,
                userId: userId,
                isActive: true
            });

            if (!address) {
                results.push({
                    addressId,
                    success: false,
                    error: "Address not found"
                });
                continue;
            }

            const updatedAddress = await Address.findByIdAndUpdate(
                addressId,
                updateData,
                { new: true, runValidators: true }
            );

            results.push({
                addressId,
                success: true,
                data: updatedAddress
            });
        } catch (error) {
            results.push({
                addressId,
                success: false,
                error: error.message
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, "Bulk update completed")
    );
});

