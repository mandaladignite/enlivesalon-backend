import { Package } from "../models/package.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all packages (Public)
export const getAllPackages = asyncHandler(async (req, res) => {
    const { 
        isActive = true, 
        isPopular, 
        minPrice, 
        maxPrice, 
        sortBy = 'sortOrder', 
        sortOrder = 'asc',
        page = 1, 
        limit = 10 
    } = req.query;

    // Build filter object
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isPopular !== undefined) filter.isPopular = isPopular === 'true';
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const packages = await Package.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Package.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            packages,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalPackages: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Packages retrieved successfully")
    );
});

// Get single package (Public)
export const getPackage = asyncHandler(async (req, res) => {
    const { packageId } = req.params;

    const packageDoc = await Package.findById(packageId);

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    res.status(200).json(
        new ApiResponse(200, packageDoc, "Package retrieved successfully")
    );
});

// Get popular packages (Public)
export const getPopularPackages = asyncHandler(async (req, res) => {
    const packages = await Package.getPopularPackages();

    res.status(200).json(
        new ApiResponse(200, packages, "Popular packages retrieved successfully")
    );
});

// Get packages by price range (Public)
export const getPackagesByPriceRange = asyncHandler(async (req, res) => {
    const { minPrice, maxPrice } = req.query;

    if (!minPrice || !maxPrice) {
        throw new ApiError(400, "Both minPrice and maxPrice are required");
    }

    const packages = await Package.getPackagesByPriceRange(
        parseFloat(minPrice), 
        parseFloat(maxPrice)
    );

    res.status(200).json(
        new ApiResponse(200, packages, "Packages retrieved successfully")
    );
});

// Create package (Admin only)
export const createPackage = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        price,
        duration,
        durationUnit = "months",
        benefits = [],
        services = [],
        discountPercentage = 0,
        maxAppointments = null,
        isPopular = false,
        sortOrder = 0,
        termsAndConditions
    } = req.body;

    // Check if package with same name already exists
    const existingPackage = await Package.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    if (existingPackage) {
        throw new ApiError(400, "Package with this name already exists");
    }

    // Validate duration unit
    const validDurationUnits = ["days", "weeks", "months", "years"];
    if (!validDurationUnits.includes(durationUnit)) {
        throw new ApiError(400, "Invalid duration unit. Must be one of: days, weeks, months, years");
    }

    // Validate discount percentage
    if (discountPercentage < 0 || discountPercentage > 100) {
        throw new ApiError(400, "Discount percentage must be between 0 and 100");
    }

    const packageDoc = await Package.create({
        name,
        description,
        price,
        duration,
        durationUnit,
        benefits,
        services,
        discountPercentage,
        maxAppointments,
        isPopular,
        sortOrder,
        termsAndConditions
    });

    res.status(201).json(
        new ApiResponse(201, packageDoc, "Package created successfully")
    );
});

// Update package (Admin only)
export const updatePackage = asyncHandler(async (req, res) => {
    const { packageId } = req.params;
    const updateData = req.body;

    // Check if package exists
    const packageDoc = await Package.findById(packageId);
    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    // Check if name is being updated and if it conflicts with existing package
    if (updateData.name && updateData.name !== packageDoc.name) {
        const existingPackage = await Package.findOne({ 
            name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
            _id: { $ne: packageId }
        });
        if (existingPackage) {
            throw new ApiError(400, "Package with this name already exists");
        }
    }

    // Validate duration unit if being updated
    if (updateData.durationUnit) {
        const validDurationUnits = ["days", "weeks", "months", "years"];
        if (!validDurationUnits.includes(updateData.durationUnit)) {
            throw new ApiError(400, "Invalid duration unit. Must be one of: days, weeks, months, years");
        }
    }

    // Validate discount percentage if being updated
    if (updateData.discountPercentage !== undefined) {
        if (updateData.discountPercentage < 0 || updateData.discountPercentage > 100) {
            throw new ApiError(400, "Discount percentage must be between 0 and 100");
        }
    }

    const updatedPackage = await Package.findByIdAndUpdate(
        packageId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedPackage, "Package updated successfully")
    );
});

// Delete package (Admin only)
export const deletePackage = asyncHandler(async (req, res) => {
    const { packageId } = req.params;

    const packageDoc = await Package.findByIdAndDelete(packageId);

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Package deleted successfully")
    );
});

// Deactivate package (Admin only)
export const deactivatePackage = asyncHandler(async (req, res) => {
    const { packageId } = req.params;

    const packageDoc = await Package.findByIdAndUpdate(
        packageId,
        { isActive: false },
        { new: true }
    );

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    res.status(200).json(
        new ApiResponse(200, packageDoc, "Package deactivated successfully")
    );
});

// Reactivate package (Admin only)
export const reactivatePackage = asyncHandler(async (req, res) => {
    const { packageId } = req.params;

    const packageDoc = await Package.findByIdAndUpdate(
        packageId,
        { isActive: true },
        { new: true }
    );

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    res.status(200).json(
        new ApiResponse(200, packageDoc, "Package reactivated successfully")
    );
});

// Toggle popular status (Admin only)
export const togglePopularStatus = asyncHandler(async (req, res) => {
    const { packageId } = req.params;

    const packageDoc = await Package.findById(packageId);

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    packageDoc.isPopular = !packageDoc.isPopular;
    await packageDoc.save();

    res.status(200).json(
        new ApiResponse(200, packageDoc, `Package ${packageDoc.isPopular ? 'marked as' : 'removed from'} popular successfully`)
    );
});

// Update package sort order (Admin only)
export const updateSortOrder = asyncHandler(async (req, res) => {
    const { packageId } = req.params;
    const { sortOrder } = req.body;

    if (sortOrder < 0) {
        throw new ApiError(400, "Sort order cannot be negative");
    }

    const packageDoc = await Package.findByIdAndUpdate(
        packageId,
        { sortOrder },
        { new: true }
    );

    if (!packageDoc) {
        throw new ApiError(404, "Package not found");
    }

    res.status(200).json(
        new ApiResponse(200, packageDoc, "Package sort order updated successfully")
    );
});

// Get package statistics (Admin only)
export const getPackageStats = asyncHandler(async (req, res) => {
    const stats = await Package.aggregate([
        {
            $group: {
                _id: null,
                totalPackages: { $sum: 1 },
                activePackages: {
                    $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
                },
                popularPackages: {
                    $sum: { $cond: [{ $eq: ["$isPopular", true] }, 1, 0] }
                },
                averagePrice: { $avg: "$price" },
                minPrice: { $min: "$price" },
                maxPrice: { $max: "$price" },
                totalRevenue: { $sum: "$price" }
            }
        }
    ]);

    const durationStats = await Package.aggregate([
        {
            $group: {
                _id: "$durationUnit",
                count: { $sum: 1 },
                averageDuration: { $avg: "$duration" },
                averagePrice: { $avg: "$price" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const discountStats = await Package.aggregate([
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$discountPercentage", 0] }, then: "No Discount" },
                            { case: { $lt: ["$discountPercentage", 10] }, then: "0-10%" },
                            { case: { $lt: ["$discountPercentage", 25] }, then: "10-25%" },
                            { case: { $lt: ["$discountPercentage", 50] }, then: "25-50%" }
                        ],
                        default: "50%+"
                    }
                },
                count: { $sum: 1 },
                averagePrice: { $avg: "$price" }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalPackages: 0,
                activePackages: 0,
                popularPackages: 0,
                averagePrice: 0,
                minPrice: 0,
                maxPrice: 0,
                totalRevenue: 0
            },
            durationStats,
            discountStats
        }, "Package statistics retrieved successfully")
    );
});

// Get all packages for admin (Admin only)
export const getAllPackagesAdmin = asyncHandler(async (req, res) => {
    const { 
        isActive, 
        isPopular, 
        minPrice, 
        maxPrice, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1, 
        limit = 10,
        search
    } = req.query;

    // Build filter object - admin can see all packages including inactive ones
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isPopular !== undefined) filter.isPopular = isPopular === 'true';
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Add search functionality
    if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { name: searchRegex },
            { description: searchRegex }
        ];
    }

    // Build sort object
    const sort = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sort[sortBy] = sortDirection;

    const packages = await Package.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Package.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            packages,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalPackages: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Admin packages retrieved successfully")
    );
});

// Search packages (Public)
export const searchPackages = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
        throw new ApiError(400, "Search query must be at least 2 characters long");
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    
    const packages = await Package.find({
        isActive: true,
        $or: [
            { name: searchRegex },
            { description: searchRegex },
            { benefits: { $in: [searchRegex] } }
        ]
    })
    .sort({ sortOrder: 1, price: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Package.countDocuments({
        isActive: true,
        $or: [
            { name: searchRegex },
            { description: searchRegex },
            { benefits: { $in: [searchRegex] } }
        ]
    });

    res.status(200).json(
        new ApiResponse(200, {
            packages,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalPackages: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            },
            searchQuery: q
        }, "Search results retrieved successfully")
    );
});

