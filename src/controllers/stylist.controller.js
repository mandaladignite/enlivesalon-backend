import { Stylist } from "../models/stylist.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all stylists (Public)
export const getAllStylists = asyncHandler(async (req, res) => {
    const { specialty, isActive, availableForHome, availableForSalon, page = 1, limit = 10 } = req.query;

    const query = {};
    if (specialty) query.specialties = specialty;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (availableForHome !== undefined) query.availableForHome = availableForHome === 'true';
    if (availableForSalon !== undefined) query.availableForSalon = availableForSalon === 'true';

    const stylists = await Stylist.find(query)
        .sort({ rating: -1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Stylist.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            stylists,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalStylists: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Stylists retrieved successfully")
    );
});

// Get single stylist (Public)
export const getStylist = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;

    const stylist = await Stylist.findById(stylistId);

    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    res.status(200).json(
        new ApiResponse(200, stylist, "Stylist retrieved successfully")
    );
});

// Create stylist (Admin only)
export const createStylist = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        phone,
        specialties,
        experience,
        rating,
        bio,
        workingHours,
        workingDays,
        availableForHome,
        availableForSalon
    } = req.body;

    // Check if stylist with same email already exists
    const existingStylist = await Stylist.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    if (existingStylist) {
        throw new ApiError(400, "Stylist with this email already exists");
    }

    // Validate working hours
    if (workingHours && workingHours.start && workingHours.end) {
        const startTime = new Date(`2000-01-01T${workingHours.start}:00`);
        const endTime = new Date(`2000-01-01T${workingHours.end}:00`);
        
        if (startTime >= endTime) {
            throw new ApiError(400, "Working start time must be before end time");
        }
    }

    // Validate working days
    if (workingDays && workingDays.length === 0) {
        throw new ApiError(400, "At least one working day is required");
    }

    const stylist = await Stylist.create({
        name,
        email,
        phone,
        specialties: specialties || [],
        experience: experience || 0,
        rating: rating || 0,
        bio,
        workingHours: workingHours || { start: '09:00', end: '18:00' },
        workingDays: workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        availableForHome: availableForHome || false,
        availableForSalon: availableForSalon !== undefined ? availableForSalon : true
    });

    res.status(201).json(
        new ApiResponse(201, stylist, "Stylist created successfully")
    );
});

// Update stylist (Admin only)
export const updateStylist = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;
    const updateData = req.body;

    // Check if stylist exists
    const stylist = await Stylist.findById(stylistId);
    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    // Check if email is being updated and if it conflicts with existing stylist
    if (updateData.email && updateData.email !== stylist.email) {
        const existingStylist = await Stylist.findOne({ 
            email: { $regex: new RegExp(`^${updateData.email}$`, 'i') },
            _id: { $ne: stylistId }
        });
        if (existingStylist) {
            throw new ApiError(400, "Stylist with this email already exists");
        }
    }

    // Validate working hours if being updated
    if (updateData.workingHours) {
        const { start, end } = updateData.workingHours;
        if (start && end) {
            const startTime = new Date(`2000-01-01T${start}:00`);
            const endTime = new Date(`2000-01-01T${end}:00`);
            
            if (startTime >= endTime) {
                throw new ApiError(400, "Working start time must be before end time");
            }
        }
    }

    // Validate working days if being updated
    if (updateData.workingDays && updateData.workingDays.length === 0) {
        throw new ApiError(400, "At least one working day is required");
    }

    const updatedStylist = await Stylist.findByIdAndUpdate(
        stylistId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedStylist, "Stylist updated successfully")
    );
});

// Delete stylist (Admin only)
export const deleteStylist = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;

    const stylist = await Stylist.findByIdAndDelete(stylistId);

    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Stylist deleted successfully")
    );
});

// Deactivate stylist (Admin only)
export const deactivateStylist = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;

    const stylist = await Stylist.findByIdAndUpdate(
        stylistId,
        { isActive: false },
        { new: true }
    );

    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    res.status(200).json(
        new ApiResponse(200, stylist, "Stylist deactivated successfully")
    );
});

// Reactivate stylist (Admin only)
export const reactivateStylist = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;

    const stylist = await Stylist.findByIdAndUpdate(
        stylistId,
        { isActive: true },
        { new: true }
    );

    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    res.status(200).json(
        new ApiResponse(200, stylist, "Stylist reactivated successfully")
    );
});

// Update stylist rating (Admin only)
export const updateStylistRating = asyncHandler(async (req, res) => {
    const { stylistId } = req.params;
    const { rating } = req.body;

    if (rating < 0 || rating > 5) {
        throw new ApiError(400, "Rating must be between 0 and 5");
    }

    const stylist = await Stylist.findByIdAndUpdate(
        stylistId,
        { rating },
        { new: true }
    );

    if (!stylist) {
        throw new ApiError(404, "Stylist not found");
    }

    res.status(200).json(
        new ApiResponse(200, stylist, "Stylist rating updated successfully")
    );
});

// Get stylist statistics (Admin only)
export const getStylistStats = asyncHandler(async (req, res) => {
    const stats = await Stylist.aggregate([
        {
            $group: {
                _id: null,
                totalStylists: { $sum: 1 },
                activeStylists: {
                    $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
                },
                averageRating: { $avg: "$rating" },
                averageExperience: { $avg: "$experience" }
            }
        }
    ]);

    const specialtyStats = await Stylist.aggregate([
        { $unwind: "$specialties" },
        {
            $group: {
                _id: "$specialties",
                count: { $sum: 1 },
                averageRating: { $avg: "$rating" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const availabilityStats = await Stylist.aggregate([
        {
            $group: {
                _id: null,
                homeStylists: {
                    $sum: { $cond: [{ $eq: ["$availableForHome", true] }, 1, 0] }
                },
                salonStylists: {
                    $sum: { $cond: [{ $eq: ["$availableForSalon", true] }, 1, 0] }
                }
            }
        }
    ]);

    const experienceStats = await Stylist.aggregate([
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $lt: ["$experience", 1] }, then: "0-1 years" },
                            { case: { $lt: ["$experience", 3] }, then: "1-3 years" },
                            { case: { $lt: ["$experience", 5] }, then: "3-5 years" },
                            { case: { $lt: ["$experience", 10] }, then: "5-10 years" }
                        ],
                        default: "10+ years"
                    }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalStylists: 0,
                activeStylists: 0,
                averageRating: 0,
                averageExperience: 0
            },
            specialtyStats,
            availability: availabilityStats[0] || {
                homeStylists: 0,
                salonStylists: 0
            },
            experienceDistribution: experienceStats
        }, "Stylist statistics retrieved successfully")
    );
});
