import { Service } from "../models/service.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// Get all services (Public)
export const getAllServices = asyncHandler(async (req, res) => {
    const { category, isActive, isFeatured, page = 1, limit = 10, sortBy = 'sortOrder', sortOrder = 'asc' } = req.query;

    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const services = await Service.find(query)
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Service.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            services,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalServices: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Services retrieved successfully")
    );
});

// Get services by category (Public) - New API
export const getServicesByCategory = asyncHandler(async (req, res) => {
    const { category } = req.params;
    const { page = 1, limit = 10, isFeatured = null } = req.query;

    // Validate category
    if (!['hair', 'nail', 'body', 'skin'].includes(category)) {
        throw new ApiError(400, "Invalid category. Must be one of: hair, nail, body, skin");
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        isActive: true,
        isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : null
    };

    const services = await Service.getByCategory(category, options);
    const total = await Service.countDocuments({ 
        category, 
        isActive: true,
        ...(options.isFeatured !== null && { isFeatured: options.isFeatured })
    });

    res.status(200).json(
        new ApiResponse(200, {
            services,
            category,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalServices: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, `${category.charAt(0).toUpperCase() + category.slice(1)} services retrieved successfully`)
    );
});

// Get services by subcategory (Public) - New API
export const getServicesBySubCategory = asyncHandler(async (req, res) => {
    const { subCategory } = req.params;
    const { page = 1, limit = 10, isFeatured = null } = req.query;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        isActive: true,
        isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : null
    };

    const services = await Service.getBySubCategory(subCategory, options);
    const total = await Service.countDocuments({ 
        subCategory, 
        isActive: true,
        ...(options.isFeatured !== null && { isFeatured: options.isFeatured })
    });

    res.status(200).json(
        new ApiResponse(200, {
            services,
            subCategory,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalServices: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, `Services in subcategory "${subCategory}" retrieved successfully`)
    );
});

// Get featured services (Public) - New API
export const getFeaturedServices = asyncHandler(async (req, res) => {
    const { category, limit = 8 } = req.query;

    const services = await Service.getFeatured(category);

    res.status(200).json(
        new ApiResponse(200, services, "Featured services retrieved successfully")
    );
});

// Get service categories (Public) - New API
export const getServiceCategories = asyncHandler(async (req, res) => {
    const categories = await Service.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 },
                averagePrice: { $avg: "$price" },
                averageDuration: { $avg: "$duration" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Add display names and icons for categories
    const categoryInfo = {
        hair: { name: "Hair Services", icon: "Scissors", color: "#D4AF37" },
        nail: { name: "Nail Services", icon: "Sparkles", color: "#E91E63" },
        body: { name: "Body Services", icon: "Heart", color: "#4CAF50" },
        skin: { name: "Skin Services", icon: "Zap", color: "#FF9800" }
    };

    const formattedCategories = categories.map(cat => ({
        ...cat,
        displayName: categoryInfo[cat._id]?.name || cat._id,
        icon: categoryInfo[cat._id]?.icon || "Circle",
        color: categoryInfo[cat._id]?.color || "#6B7280"
    }));

    res.status(200).json(
        new ApiResponse(200, formattedCategories, "Service categories retrieved successfully")
    );
});

// Get service subcategories (Public) - New API
export const getServiceSubCategories = asyncHandler(async (req, res) => {
    const { category } = req.query;
    
    const matchStage = { isActive: true };
    if (category) {
        matchStage.category = category;
    }
    
    const subCategories = await Service.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$subCategory",
                category: { $first: "$category" },
                count: { $sum: 1 },
                averagePrice: { $avg: "$price" },
                averageDuration: { $avg: "$duration" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, subCategories, "Service subcategories retrieved successfully")
    );
});

// Get single service (Public)
export const getService = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    const service = await Service.findById(serviceId);

    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    res.status(200).json(
        new ApiResponse(200, service, "Service retrieved successfully")
    );
});

// Create service (Admin only)
export const createService = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        duration,
        price,
        category,
        subCategory,
        icon,
        tags,
        availableAtHome,
        availableAtSalon,
        isFeatured,
        sortOrder
    } = req.body;

    // Check if service with same name already exists
    // Note: name is already sanitized by validation middleware
    const existingService = await Service.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingService) {
        throw new ApiError(400, "Service with this name already exists");
    }

    // Handle photo upload if present
    let photoUrl = null;
    if (req.file) {
        try {
            
            const result = await uploadToCloudinary(req.file, {
                folder: 'services',
                category: 'service-photos',
                transformation: [
                    { width: 800, height: 600, crop: 'fill', quality: 'auto' }
                ]
            });
            photoUrl = result.secure_url;
        } catch (error) {
            console.error('Service photo upload error:', error);
            throw new ApiError(400, "Failed to upload service photo: " + error.message);
        }
    }

    // Parse tags if they're sent as a string
    let parsedTags = [];
    if (tags) {
        if (typeof tags === 'string') {
            parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        } else if (Array.isArray(tags)) {
            parsedTags = tags;
        }
    }

    const service = await Service.create({
        name,
        description,
        duration,
        price,
        currency: "INR",
        category,
        subCategory,
        icon,
        photo: photoUrl,
        tags: parsedTags,
        availableAtHome: availableAtHome || false,
        availableAtSalon: availableAtSalon !== undefined ? availableAtSalon : true,
        isFeatured: isFeatured || false,
        sortOrder: sortOrder || 0
    });

    res.status(201).json(
        new ApiResponse(201, service, "Service created successfully")
    );
});

// Update service (Admin only)
export const updateService = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;
    const updateData = { ...req.body };

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    // Check if name is being updated and if it conflicts with existing service
    if (updateData.name && updateData.name !== service.name) {
        const existingService = await Service.findOne({ 
            name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
            _id: { $ne: serviceId }
        });
        if (existingService) {
            throw new ApiError(400, "Service with this name already exists");
        }
    }

    // Handle photo upload if present
    if (req.file) {
        try {
            
            const result = await uploadToCloudinary(req.file, {
                folder: 'services',
                category: 'service-photos',
                transformation: [
                    { width: 800, height: 600, crop: 'fill', quality: 'auto' }
                ]
            });
            updateData.photo = result.secure_url;
        } catch (error) {
            console.error('Service photo update error:', error);
            throw new ApiError(400, "Failed to upload service photo: " + error.message);
        }
    }

    // Parse tags if they're being updated
    if (updateData.tags) {
        if (typeof updateData.tags === 'string') {
            updateData.tags = updateData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }
    }

    const updatedService = await Service.findByIdAndUpdate(
        serviceId,
        updateData,
        { new: true, runValidators: true }
    );

    res.status(200).json(
        new ApiResponse(200, updatedService, "Service updated successfully")
    );
});

// Upload service photo (Admin only) - New API
export const uploadServicePhoto = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    if (!req.file) {
        throw new ApiError(400, "No photo file provided");
    }

    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    try {
        
        const result = await uploadToCloudinary(req.file, {
            folder: 'services',
            category: 'service-photos',
            transformation: [
                { width: 800, height: 600, crop: 'fill', quality: 'auto' }
            ]
        });

        service.photo = result.secure_url;
        await service.save();

        res.status(200).json(
            new ApiResponse(200, { photo: service.photo }, "Service photo uploaded successfully")
        );
    } catch (error) {
        console.error('Service photo upload API error:', error);
        throw new ApiError(400, "Failed to upload service photo: " + error.message);
    }
});

// Toggle service featured status (Admin only) - New API
export const toggleFeatured = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    const service = await Service.findById(serviceId);
    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    service.isFeatured = !service.isFeatured;
    await service.save();

    res.status(200).json(
        new ApiResponse(200, service, `Service ${service.isFeatured ? 'featured' : 'unfeatured'} successfully`)
    );
});

// Update service sort order (Admin only) - New API
export const updateSortOrder = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;
    const { sortOrder } = req.body;

    if (sortOrder === undefined || sortOrder < 0) {
        throw new ApiError(400, "Valid sort order is required");
    }

    const service = await Service.findByIdAndUpdate(
        serviceId,
        { sortOrder },
        { new: true, runValidators: true }
    );

    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    res.status(200).json(
        new ApiResponse(200, service, "Service sort order updated successfully")
    );
});

// Delete service (Admin only)
export const deleteService = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    const service = await Service.findByIdAndDelete(serviceId);

    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    res.status(200).json(
        new ApiResponse(200, null, "Service deleted successfully")
    );
});

// Deactivate service (Admin only)
export const deactivateService = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    const service = await Service.findByIdAndUpdate(
        serviceId,
        { isActive: false },
        { new: true }
    );

    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    res.status(200).json(
        new ApiResponse(200, service, "Service deactivated successfully")
    );
});

// Reactivate service (Admin only)
export const reactivateService = asyncHandler(async (req, res) => {
    const { serviceId } = req.params;

    const service = await Service.findByIdAndUpdate(
        serviceId,
        { isActive: true },
        { new: true }
    );

    if (!service) {
        throw new ApiError(404, "Service not found");
    }

    res.status(200).json(
        new ApiResponse(200, service, "Service reactivated successfully")
    );
});

// Get all services for admin with enhanced filtering and pagination
export const getAllServicesAdmin = asyncHandler(async (req, res) => {
    const { 
        category, 
        subCategory, 
        isActive, 
        isFeatured, 
        availableAtHome, 
        availableAtSalon,
        search,
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
    } = req.query;

    // Build query object
    const query = {};
    
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (availableAtHome !== undefined) query.availableAtHome = availableAtHome === 'true';
    if (availableAtSalon !== undefined) query.availableAtSalon = availableAtSalon === 'true';
    
    // Add text search
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { subCategory: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
        ];
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const services = await Service.find(query)
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Service.countDocuments(query);

    // Get unique subcategories for filtering
    const subCategories = await Service.distinct('subCategory', query);

    res.status(200).json(
        new ApiResponse(200, {
            services,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalServices: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
                limit: parseInt(limit)
            },
            filters: {
                categories: ['hair', 'nail', 'body', 'skin'],
                subCategories: subCategories.sort(),
                statusOptions: [
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                ],
                availabilityOptions: [
                    { value: 'home', label: 'Available at Home' },
                    { value: 'salon', label: 'Available at Salon' }
                ]
            }
        }, "Admin services retrieved successfully")
    );
});

// Get service statistics (Admin only)
export const getServiceStats = asyncHandler(async (req, res) => {
    const stats = await Service.aggregate([
        {
            $group: {
                _id: null,
                totalServices: { $sum: 1 },
                activeServices: {
                    $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
                },
                averagePrice: { $avg: "$price" },
                averageDuration: { $avg: "$duration" }
            }
        }
    ]);

    const categoryStats = await Service.aggregate([
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 },
                averagePrice: { $avg: "$price" },
                averageDuration: { $avg: "$duration" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    const homeServices = await Service.countDocuments({ availableAtHome: true, isActive: true });
    const salonServices = await Service.countDocuments({ availableAtSalon: true, isActive: true });

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalServices: 0,
                activeServices: 0,
                averagePrice: 0,
                averageDuration: 0
            },
            categoryStats,
            availability: {
                homeServices,
                salonServices
            }
        }, "Service statistics retrieved successfully")
    );
});

// Bulk update services (Admin only)
export const bulkUpdateServices = asyncHandler(async (req, res) => {
    const { serviceIds, updateData } = req.body;

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        throw new ApiError(400, "Service IDs array is required and cannot be empty");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
        throw new ApiError(400, "Update data is required");
    }

    // Validate update data
    const allowedFields = [
        'category', 'subCategory', 'availableAtHome', 'availableAtSalon', 'isActive', 'isFeatured',
        'discount.percentage', 'discount.isActive', 'discount.validFrom', 'discount.validUntil'
    ];
    
    const invalidFields = Object.keys(updateData).filter(field => {
        if (field.startsWith('discount.')) {
            const discountField = field.replace('discount.', '');
            return !['percentage', 'isActive', 'validFrom', 'validUntil'].includes(discountField);
        }
        return !allowedFields.includes(field);
    });

    if (invalidFields.length > 0) {
        throw new ApiError(400, `Invalid fields for bulk update: ${invalidFields.join(', ')}`);
    }

    // Validate category if being updated
    if (updateData.category && !['hair', 'nail', 'body', 'skin'].includes(updateData.category)) {
        throw new ApiError(400, "Invalid category. Must be one of: hair, nail, body, skin");
    }

    // Validate discount percentage if being updated
    if (updateData['discount.percentage'] !== undefined) {
        const percentage = updateData['discount.percentage'];
        if (percentage < 0 || percentage > 100) {
            throw new ApiError(400, "Discount percentage must be between 0 and 100");
        }
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const serviceId of serviceIds) {
        try {
            const service = await Service.findById(serviceId);
            if (!service) {
                results.push({
                    serviceId,
                    success: false,
                    error: "Service not found"
                });
                errorCount++;
                continue;
            }

            // Prepare update data for this service
            const serviceUpdateData = { ...updateData };
            
            // Handle nested discount fields
            if (updateData['discount.percentage'] !== undefined || 
                updateData['discount.isActive'] !== undefined ||
                updateData['discount.validFrom'] !== undefined ||
                updateData['discount.validUntil'] !== undefined) {
                
                serviceUpdateData.discount = {
                    ...service.discount,
                    percentage: updateData['discount.percentage'] !== undefined ? updateData['discount.percentage'] : service.discount.percentage,
                    isActive: updateData['discount.isActive'] !== undefined ? updateData['discount.isActive'] : service.discount.isActive,
                    validFrom: updateData['discount.validFrom'] !== undefined ? updateData['discount.validFrom'] : service.discount.validFrom,
                    validUntil: updateData['discount.validUntil'] !== undefined ? updateData['discount.validUntil'] : service.discount.validUntil
                };
                
                // Remove the nested fields from the main update data
                delete serviceUpdateData['discount.percentage'];
                delete serviceUpdateData['discount.isActive'];
                delete serviceUpdateData['discount.validFrom'];
                delete serviceUpdateData['discount.validUntil'];
            }

            const updatedService = await Service.findByIdAndUpdate(
                serviceId,
                serviceUpdateData,
                { new: true, runValidators: true }
            );

            results.push({
                serviceId,
                success: true,
                data: {
                    name: updatedService.name,
                    category: updatedService.category,
                    availableAtHome: updatedService.availableAtHome,
                    availableAtSalon: updatedService.availableAtSalon,
                    isActive: updatedService.isActive,
                    isFeatured: updatedService.isFeatured,
                    discount: updatedService.discount
                }
            });
            successCount++;
        } catch (error) {
            results.push({
                serviceId,
                success: false,
                error: error.message
            });
            errorCount++;
        }
    }

    res.status(200).json(
        new ApiResponse(200, {
            results,
            summary: {
                total: serviceIds.length,
                success: successCount,
                errors: errorCount
            }
        }, `Bulk update completed. ${successCount} services updated successfully, ${errorCount} failed`)
    );
});
