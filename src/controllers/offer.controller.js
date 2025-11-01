import { Offer } from "../models/offer.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// Get all offers (Public - only active and valid)
export const getAllOffers = asyncHandler(async (req, res) => {
    const { 
        isActive = true, 
        sortBy = 'sortOrder', 
        sortOrder = 'asc',
        page = 1, 
        limit = 10 
    } = req.query;

    const now = new Date();
    
    // Build filter object
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // For active offers, only show currently valid ones
    if (isActive === 'true' || isActive === true) {
        filter.validFrom = { $lte: now };
        filter.validUntil = { $gte: now };
    }

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const offers = await Offer.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-usedCount'); // Don't expose usage count to public

    const total = await Offer.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            offers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalOffers: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Offers retrieved successfully")
    );
});

// Get single offer (Public)
export const getOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId).select('-usedCount');

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    res.status(200).json(
        new ApiResponse(200, offer, "Offer retrieved successfully")
    );
});

// Get offer by code (Public)
export const getOfferByCode = asyncHandler(async (req, res) => {
    const { code } = req.params;

    const offer = await Offer.findOne({ code: code.toUpperCase() }).select('-usedCount');

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    const now = new Date();
    if (!offer.isActive || now < offer.validFrom || now > offer.validUntil) {
        throw new ApiError(400, "Offer is not currently valid");
    }

    res.status(200).json(
        new ApiResponse(200, offer, "Offer retrieved successfully")
    );
});

// Create offer (Admin only)
export const createOffer = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        code,
        discountType = "percentage",
        discountValue,
        minPurchaseAmount = 0,
        maxDiscountAmount = null,
        validFrom,
        validUntil,
        applicableServices: applicableServicesRaw,
        applicableCategories: applicableCategoriesRaw,
        usageLimit = null,
        isActive = true,
        sortOrder = 0,
        bannerImage, // Can be URL or will be set from uploaded file
        termsAndConditions
    } = req.body;

    // Handle FormData arrays - they can come as arrays or from FormData notation
    let applicableServices = [];
    if (Array.isArray(applicableServicesRaw)) {
        applicableServices = applicableServicesRaw;
    } else if (applicableServicesRaw) {
        if (typeof applicableServicesRaw === 'string') {
            try {
                applicableServices = JSON.parse(applicableServicesRaw);
            } catch {
                applicableServices = [applicableServicesRaw];
            }
        }
    }
    
    // Also check for FormData array notation (applicableServices[0], applicableServices[1], etc.)
    if (applicableServices.length === 0) {
        const serviceKeys = Object.keys(req.body)
            .filter(key => /^applicableServices\[\d+\]$/.test(key))
            .sort((a, b) => {
                const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                return aIndex - bIndex;
            })
            .map(key => req.body[key]);
        if (serviceKeys.length > 0) {
            applicableServices = serviceKeys;
        }
    }

    let applicableCategories = [];
    if (Array.isArray(applicableCategoriesRaw)) {
        applicableCategories = applicableCategoriesRaw;
    } else if (applicableCategoriesRaw) {
        if (typeof applicableCategoriesRaw === 'string') {
            try {
                applicableCategories = JSON.parse(applicableCategoriesRaw);
            } catch {
                applicableCategories = [applicableCategoriesRaw];
            }
        }
    }
    
    // Also check for FormData array notation
    if (applicableCategories.length === 0) {
        const categoryKeys = Object.keys(req.body)
            .filter(key => /^applicableCategories\[\d+\]$/.test(key))
            .sort((a, b) => {
                const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                return aIndex - bIndex;
            })
            .map(key => req.body[key]);
        if (categoryKeys.length > 0) {
            applicableCategories = categoryKeys;
        }
    }

    let bannerImageUrl = bannerImage;

    // Handle banner image upload if file is provided
    if (req.file) {
        try {
            const uploadResult = await uploadToCloudinary(req.file, {
                folder: 'salon-offers',
                category: 'banners'
            });
            bannerImageUrl = uploadResult.secure_url;
        } catch (error) {
            throw new ApiError(500, `Banner image upload failed: ${error.message}`);
        }
    }

    // Check if offer code already exists
    const existingOffer = await Offer.findOne({ 
        code: code.toUpperCase() 
    });
    if (existingOffer) {
        throw new ApiError(400, "Offer code already exists");
    }

    // Validate dates
    const validFromDate = new Date(validFrom);
    const validUntilDate = new Date(validUntil);
    
    if (validUntilDate <= validFromDate) {
        throw new ApiError(400, "Valid until date must be after valid from date");
    }

    // Validate discount value
    if (discountType === "percentage" && (discountValue < 0 || discountValue > 100)) {
        throw new ApiError(400, "Discount percentage must be between 0 and 100");
    }

    if (discountType === "fixed" && discountValue < 0) {
        throw new ApiError(400, "Fixed discount value cannot be negative");
    }

    const offer = await Offer.create({
        title,
        description,
        code: code.toUpperCase(),
        discountType,
        discountValue,
        minPurchaseAmount,
        maxDiscountAmount,
        validFrom: validFromDate,
        validUntil: validUntilDate,
        applicableServices,
        applicableCategories,
        usageLimit,
        isActive,
        sortOrder,
        bannerImage: bannerImageUrl,
        termsAndConditions
    });

    res.status(201).json(
        new ApiResponse(201, offer, "Offer created successfully")
    );
});

// Update offer (Admin only)
export const updateOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;
    const updateData = { ...req.body };

    // Handle FormData arrays for applicableServices
    if (updateData.applicableServices !== undefined) {
        if (Array.isArray(updateData.applicableServices)) {
            // Already an array
        } else if (typeof updateData.applicableServices === 'string') {
            try {
                updateData.applicableServices = JSON.parse(updateData.applicableServices);
            } catch {
                updateData.applicableServices = [updateData.applicableServices];
            }
        }
        
        // Also check for FormData array notation
        if (!Array.isArray(updateData.applicableServices) || updateData.applicableServices.length === 0) {
            const serviceKeys = Object.keys(req.body)
                .filter(key => /^applicableServices\[\d+\]$/.test(key))
                .sort((a, b) => {
                    const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                    const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                    return aIndex - bIndex;
                })
                .map(key => req.body[key]);
            if (serviceKeys.length > 0) {
                updateData.applicableServices = serviceKeys;
            } else if (updateData.applicableServices === undefined) {
                updateData.applicableServices = [];
            }
        }
    }

    // Handle FormData arrays for applicableCategories
    if (updateData.applicableCategories !== undefined) {
        if (Array.isArray(updateData.applicableCategories)) {
            // Already an array
        } else if (typeof updateData.applicableCategories === 'string') {
            try {
                updateData.applicableCategories = JSON.parse(updateData.applicableCategories);
            } catch {
                updateData.applicableCategories = [updateData.applicableCategories];
            }
        }
        
        // Also check for FormData array notation
        if (!Array.isArray(updateData.applicableCategories) || updateData.applicableCategories.length === 0) {
            const categoryKeys = Object.keys(req.body)
                .filter(key => /^applicableCategories\[\d+\]$/.test(key))
                .sort((a, b) => {
                    const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                    const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                    return aIndex - bIndex;
                })
                .map(key => req.body[key]);
            if (categoryKeys.length > 0) {
                updateData.applicableCategories = categoryKeys;
            } else if (updateData.applicableCategories === undefined) {
                updateData.applicableCategories = [];
            }
        }
    }

    // Handle banner image upload if file is provided
    if (req.file) {
        try {
            const uploadResult = await uploadToCloudinary(req.file, {
                folder: 'salon-offers',
                category: 'banners'
            });
            updateData.bannerImage = uploadResult.secure_url;
        } catch (error) {
            throw new ApiError(500, `Banner image upload failed: ${error.message}`);
        }
    }

    // Check if offer exists
    const offer = await Offer.findById(offerId);
    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    // If code is being updated, check for conflicts
    if (updateData.code && updateData.code.toUpperCase() !== offer.code) {
        const existingOffer = await Offer.findOne({ 
            code: updateData.code.toUpperCase(),
            _id: { $ne: offerId }
        });
        if (existingOffer) {
            throw new ApiError(400, "Offer code already exists");
        }
        updateData.code = updateData.code.toUpperCase();
    }

    // Validate dates if being updated
    if (updateData.validFrom || updateData.validUntil) {
        const validFromDate = updateData.validFrom ? new Date(updateData.validFrom) : offer.validFrom;
        const validUntilDate = updateData.validUntil ? new Date(updateData.validUntil) : offer.validUntil;
        
        if (validUntilDate <= validFromDate) {
            throw new ApiError(400, "Valid until date must be after valid from date");
        }
    }

    // Validate discount value if being updated
    if (updateData.discountValue !== undefined) {
        const discountType = updateData.discountType || offer.discountType;
        if (discountType === "percentage" && (updateData.discountValue < 0 || updateData.discountValue > 100)) {
            throw new ApiError(400, "Discount percentage must be between 0 and 100");
        }
        if (discountType === "fixed" && updateData.discountValue < 0) {
            throw new ApiError(400, "Fixed discount value cannot be negative");
        }
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
        offerId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedOffer, "Offer updated successfully")
    );
});

// Delete offer (Admin only)
export const deleteOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findByIdAndDelete(offerId);

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Offer deleted successfully")
    );
});

// Deactivate offer (Admin only)
export const deactivateOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findByIdAndUpdate(
        offerId,
        { isActive: false },
        { new: true }
    );

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    res.status(200).json(
        new ApiResponse(200, offer, "Offer deactivated successfully")
    );
});

// Reactivate offer (Admin only)
export const reactivateOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findByIdAndUpdate(
        offerId,
        { isActive: true },
        { new: true }
    );

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    res.status(200).json(
        new ApiResponse(200, offer, "Offer reactivated successfully")
    );
});

// Get all offers for admin (Admin only)
export const getAllOffersAdmin = asyncHandler(async (req, res) => {
    const { 
        isActive, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1, 
        limit = 10,
        search
    } = req.query;

    // Build filter object - admin can see all offers
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Add search functionality
    if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { title: searchRegex },
            { description: searchRegex },
            { code: searchRegex }
        ];
    }

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const offers = await Offer.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Offer.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            offers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalOffers: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Admin offers retrieved successfully")
    );
});

// Get offer statistics (Admin only)
export const getOfferStats = asyncHandler(async (req, res) => {
    const now = new Date();
    
    const stats = await Offer.aggregate([
        {
            $group: {
                _id: null,
                totalOffers: { $sum: 1 },
                activeOffers: {
                    $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
                },
                expiredOffers: {
                    $sum: { 
                        $cond: [
                            { $lt: ["$validUntil", now] }, 
                            1, 
                            0
                        ] 
                    }
                },
                upcomingOffers: {
                    $sum: { 
                        $cond: [
                            { $gt: ["$validFrom", now] }, 
                            1, 
                            0
                        ] 
                    }
                },
                totalUsage: { $sum: "$usedCount" }
            }
        }
    ]);

    const discountTypeStats = await Offer.aggregate([
        {
            $group: {
                _id: "$discountType",
                count: { $sum: 1 },
                averageDiscountValue: { $avg: "$discountValue" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const categoryStats = await Offer.aggregate([
        { $unwind: { path: "$applicableCategories", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$applicableCategories",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalOffers: 0,
                activeOffers: 0,
                expiredOffers: 0,
                upcomingOffers: 0,
                totalUsage: 0
            },
            discountTypeStats,
            categoryStats
        }, "Offer statistics retrieved successfully")
    );
});

// Increment usage count (called when offer is used)
export const incrementUsageCount = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findByIdAndUpdate(
        offerId,
        { $inc: { usedCount: 1 } },
        { new: true }
    );

    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    res.status(200).json(
        new ApiResponse(200, offer, "Usage count updated successfully")
    );
});

