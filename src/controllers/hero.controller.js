import { Hero } from "../models/hero.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// Get all hero sections (Public - only active)
export const getAllHeroSections = asyncHandler(async (req, res) => {
    const { 
        isActive = true, 
        sortBy = 'sortOrder', 
        sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const heroSections = await Hero.find(filter)
        .sort(sort);

    res.status(200).json(
        new ApiResponse(200, { heroSections }, "Hero sections retrieved successfully")
    );
});

// Get single hero section (Public)
export const getHeroSection = asyncHandler(async (req, res) => {
    const { heroId } = req.params;

    const heroSection = await Hero.findById(heroId);

    if (!heroSection) {
        throw new ApiError(404, "Hero section not found");
    }

    res.status(200).json(
        new ApiResponse(200, heroSection, "Hero section retrieved successfully")
    );
});

// Create hero section (Admin only)
export const createHeroSection = asyncHandler(async (req, res) => {
    const {
        title,
        subtitle,
        description,
        backgroundImage,
        ctaPrimary,
        ctaSecondary,
        stats,
        isActive = true,
        sortOrder = 0
    } = req.body;

    // Handle background image upload if file is provided
    let backgroundImageUrl = backgroundImage;

    if (req.file) {
        try {
            const uploadResult = await uploadToCloudinary(req.file, {
                folder: 'salon-hero',
                category: 'banners'
            });
            backgroundImageUrl = uploadResult.secure_url;
        } catch (error) {
            throw new ApiError(500, `Background image upload failed: ${error.message}`);
        }
    }

    if (!backgroundImageUrl) {
        throw new ApiError(400, "Background image is required");
    }

    // Parse stats if it's a string
    let parsedStats = [];
    if (stats) {
        if (typeof stats === 'string') {
            try {
                parsedStats = JSON.parse(stats);
            } catch {
                throw new ApiError(400, "Invalid stats format");
            }
        } else if (Array.isArray(stats)) {
            parsedStats = stats;
        }
    }

    // Parse CTA objects if they're strings
    let parsedCtaPrimary = {};
    if (ctaPrimary) {
        if (typeof ctaPrimary === 'string') {
            try {
                parsedCtaPrimary = JSON.parse(ctaPrimary);
            } catch {
                throw new ApiError(400, "Invalid primary CTA format");
            }
        } else {
            parsedCtaPrimary = ctaPrimary;
        }
    }

    let parsedCtaSecondary = {};
    if (ctaSecondary) {
        if (typeof ctaSecondary === 'string') {
            try {
                parsedCtaSecondary = JSON.parse(ctaSecondary);
            } catch {
                throw new ApiError(400, "Invalid secondary CTA format");
            }
        } else {
            parsedCtaSecondary = ctaSecondary;
        }
    }

    // Validate CTA primary
    if (!parsedCtaPrimary.text || !parsedCtaPrimary.link) {
        throw new ApiError(400, "Primary CTA text and link are required");
    }

    const heroSection = await Hero.create({
        title,
        subtitle,
        description,
        backgroundImage: backgroundImageUrl,
        ctaPrimary: parsedCtaPrimary,
        ctaSecondary: parsedCtaSecondary,
        stats: parsedStats,
        isActive,
        sortOrder
    });

    res.status(201).json(
        new ApiResponse(201, heroSection, "Hero section created successfully")
    );
});

// Update hero section (Admin only)
export const updateHeroSection = asyncHandler(async (req, res) => {
    const { heroId } = req.params;
    const updateData = { ...req.body };

    // Check if hero section exists
    const heroSection = await Hero.findById(heroId);
    if (!heroSection) {
        throw new ApiError(404, "Hero section not found");
    }

    // Handle background image upload if file is provided
    if (req.file) {
        try {
            const uploadResult = await uploadToCloudinary(req.file, {
                folder: 'salon-hero',
                category: 'banners'
            });
            updateData.backgroundImage = uploadResult.secure_url;
        } catch (error) {
            throw new ApiError(500, `Background image upload failed: ${error.message}`);
        }
    }

    // Parse stats if it's a string
    if (updateData.stats !== undefined) {
        if (typeof updateData.stats === 'string') {
            try {
                updateData.stats = JSON.parse(updateData.stats);
            } catch {
                throw new ApiError(400, "Invalid stats format");
            }
        }
    }

    // Parse CTA objects if they're strings
    if (updateData.ctaPrimary !== undefined) {
        if (typeof updateData.ctaPrimary === 'string') {
            try {
                updateData.ctaPrimary = JSON.parse(updateData.ctaPrimary);
            } catch {
                throw new ApiError(400, "Invalid primary CTA format");
            }
        }
    }

    if (updateData.ctaSecondary !== undefined) {
        if (typeof updateData.ctaSecondary === 'string') {
            try {
                updateData.ctaSecondary = JSON.parse(updateData.ctaSecondary);
            } catch {
                throw new ApiError(400, "Invalid secondary CTA format");
            }
        }
    }

    const updatedHeroSection = await Hero.findByIdAndUpdate(
        heroId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedHeroSection, "Hero section updated successfully")
    );
});

// Delete hero section (Admin only)
export const deleteHeroSection = asyncHandler(async (req, res) => {
    const { heroId } = req.params;

    const heroSection = await Hero.findByIdAndDelete(heroId);

    if (!heroSection) {
        throw new ApiError(404, "Hero section not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Hero section deleted successfully")
    );
});

// Deactivate hero section (Admin only)
export const deactivateHeroSection = asyncHandler(async (req, res) => {
    const { heroId } = req.params;

    const heroSection = await Hero.findByIdAndUpdate(
        heroId,
        { isActive: false },
        { new: true }
    );

    if (!heroSection) {
        throw new ApiError(404, "Hero section not found");
    }

    res.status(200).json(
        new ApiResponse(200, heroSection, "Hero section deactivated successfully")
    );
});

// Reactivate hero section (Admin only)
export const reactivateHeroSection = asyncHandler(async (req, res) => {
    const { heroId } = req.params;

    const heroSection = await Hero.findByIdAndUpdate(
        heroId,
        { isActive: true },
        { new: true }
    );

    if (!heroSection) {
        throw new ApiError(404, "Hero section not found");
    }

    res.status(200).json(
        new ApiResponse(200, heroSection, "Hero section reactivated successfully")
    );
});

// Get all hero sections for admin (Admin only)
export const getAllHeroSectionsAdmin = asyncHandler(async (req, res) => {
    const { 
        isActive, 
        sortBy = 'sortOrder', 
        sortOrder = 'asc',
        search
    } = req.query;

    // Build filter object - admin can see all hero sections
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Add search functionality
    if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { title: searchRegex },
            { subtitle: searchRegex },
            { description: searchRegex }
        ];
    }

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const heroSections = await Hero.find(filter)
        .sort(sort);

    res.status(200).json(
        new ApiResponse(200, { heroSections }, "Admin hero sections retrieved successfully")
    );
});

