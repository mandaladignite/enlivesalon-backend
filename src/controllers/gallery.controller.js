import { Gallery } from "../models/gallery.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary, generateImageTransformations, validateCloudinaryConfig } from "../utils/cloudinary.js";

// Public: Get all gallery images
export const getAllGalleryImages = asyncHandler(async (req, res) => {
    const {
        category,
        subcategory,
        featured,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Filter by category
    if (category) {
        query.category = category;
    }

    // Filter by subcategory
    if (subcategory) {
        query.subcategory = subcategory;
    }

    // Filter featured images
    if (featured === 'true') {
        query.isFeatured = true;
    }

    // Search functionality
    if (search) {
        query.$text = { $search: search };
    }

    // Sort options
    const sortOptions = {};
    if (search && query.$text) {
        sortOptions.score = { $meta: "textScore" };
    }
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const images = await Gallery.find(query, search && query.$text ? { score: { $meta: "textScore" } } : {})
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip)
        .populate('uploadedBy', 'name email');

    const totalImages = await Gallery.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            images,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalImages / parseInt(limit)),
                totalImages,
                hasNext: skip + images.length < totalImages,
                hasPrev: parseInt(page) > 1
            }
        }, "Gallery images retrieved successfully")
    );
});

// Public: Get single gallery image
export const getGalleryImage = asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const image = await Gallery.findOne({
        _id: imageId,
        isActive: true
    }).populate('uploadedBy', 'name email');

    if (!image) {
        throw new ApiError(404, "Image not found");
    }


    res.status(200).json(
        new ApiResponse(200, image, "Gallery image retrieved successfully")
    );
});

// Public: Get images by category
export const getImagesByCategory = asyncHandler(async (req, res) => {
    const { category } = req.params;
    const { subcategory, featured, limit = 50 } = req.query;

    const options = {
        subcategory,
        featured: featured === 'true',
        limit: parseInt(limit)
    };

    const images = await Gallery.getImagesByCategory(category, options);

    res.status(200).json(
        new ApiResponse(200, images, `${category} images retrieved successfully`)
    );
});

// Public: Get featured images
export const getFeaturedImages = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const images = await Gallery.getFeaturedImages(parseInt(limit));

    res.status(200).json(
        new ApiResponse(200, images, "Featured images retrieved successfully")
    );
});

// Public: Search gallery images
export const searchGalleryImages = asyncHandler(async (req, res) => {
    const { q: searchTerm, category, page = 1, limit = 20 } = req.query;

    if (!searchTerm) {
        throw new ApiError(400, "Search term is required");
    }

    const options = {
        category,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const images = await Gallery.searchImages(searchTerm, options);

    res.status(200).json(
        new ApiResponse(200, images, "Search results retrieved successfully")
    );
});

// Public: Get gallery statistics
export const getGalleryStats = asyncHandler(async (req, res) => {
    const [stats, categoryBreakdown] = await Promise.all([
        Gallery.getGalleryStats(),
        Gallery.getCategoryBreakdown()
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalImages: 0
            },
            categoryBreakdown
        }, "Gallery statistics retrieved successfully")
    );
});

// Admin: Upload single image
export const uploadImage = asyncHandler(async (req, res) => {
    // Validate Cloudinary configuration
    validateCloudinaryConfig();
    
    const {
        title,
        description,
        category,
        subcategory,
        tags,
        altText,
        isFeatured = false,
        sortOrder = 0,
        metadata
    } = req.body;

    if (!req.file) {
        throw new ApiError(400, "Image file is required");
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, {
        folder: 'salon-gallery',
        category: category.toLowerCase()
    });

    // Parse tags if provided as string
    let parsedTags = [];
    if (tags) {
        parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
    }

    // Parse metadata if provided as string
    let parsedMetadata = {};
    if (metadata) {
        try {
            parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        } catch (error) {
            throw new ApiError(400, "Invalid metadata format");
        }
    }

    const image = await Gallery.create({
        title,
        description,
        category,
        subcategory,
        tags: parsedTags,
        imageUrl: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
        cloudinarySecureUrl: uploadResult.secure_url,
        originalFileName: req.file.originalname,
        dimensions: {
            width: uploadResult.width,
            height: uploadResult.height
        },
        format: uploadResult.format,
        isFeatured,
        sortOrder,
        uploadedBy: req.user._id,
        altText,
        metadata: parsedMetadata
    });

    res.status(201).json(
        new ApiResponse(201, image, "Image uploaded successfully")
    );
});

// Admin: Upload multiple images
export const uploadMultipleImages = asyncHandler(async (req, res) => {
    // Validate Cloudinary configuration
    validateCloudinaryConfig();
    
    
    // Safety check for req.body
    if (!req.body) {
        throw new ApiError(400, "Request body is undefined. Please check the request format.");
    }
    
    const {
        category,
        subcategory,
        tags,
        isFeatured = false,
        metadata
    } = req.body;


    if (!req.files || req.files.length === 0) {
        throw new ApiError(400, "Image files are required");
    }

    const uploadResults = [];
    const createdImages = [];

    // Upload each image to Cloudinary
    for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const title = req.body[`title_${i}`] || `Image ${i + 1}`;
        const description = req.body[`description_${i}`] || '';
        const altText = req.body[`altText_${i}`] || `${title} - ${category} gallery image`;

        try {
            const uploadResult = await uploadToCloudinary(file, {
                folder: 'salon-gallery',
                category: category.toLowerCase()
            });

            uploadResults.push(uploadResult);

            // Parse tags if provided
            let parsedTags = [];
            if (tags) {
                parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
            }

            // Parse metadata if provided
            let parsedMetadata = {};
            if (metadata) {
                try {
                    parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                } catch (error) {
                    // Skip metadata if invalid
                }
            }

            const image = await Gallery.create({
                title,
                description,
                category,
                subcategory,
                tags: parsedTags,
                imageUrl: uploadResult.secure_url,
                cloudinaryPublicId: uploadResult.public_id,
                cloudinarySecureUrl: uploadResult.secure_url,
                originalFileName: file.originalname,
                dimensions: {
                    width: uploadResult.width,
                    height: uploadResult.height
                },
                format: uploadResult.format,
                isFeatured,
                sortOrder: i,
                uploadedBy: req.user._id,
                altText,
                metadata: parsedMetadata
            });

            createdImages.push(image);
        } catch (error) {
            // If upload fails, clean up already uploaded images
            for (const result of uploadResults) {
                try {
                    await deleteFromCloudinary(result.public_id);
                } catch (cleanupError) {
                    console.error('Failed to cleanup uploaded image:', cleanupError);
                }
            }
            throw new ApiError(500, `Failed to upload image ${i + 1}: ${error.message}`);
        }
    }

    res.status(201).json(
        new ApiResponse(201, {
            images: createdImages,
            uploadCount: createdImages.length
        }, `${createdImages.length} images uploaded successfully`)
    );
});

// Admin: Update image details
export const updateImage = asyncHandler(async (req, res) => {
    const { imageId } = req.params;
    const updateData = req.body;

    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }

    // Parse tags if provided
    if (updateData.tags) {
        updateData.tags = typeof updateData.tags === 'string' 
            ? updateData.tags.split(',').map(tag => tag.trim())
            : updateData.tags;
    }

    // Parse metadata if provided
    if (updateData.metadata) {
        try {
            updateData.metadata = typeof updateData.metadata === 'string' 
                ? JSON.parse(updateData.metadata)
                : updateData.metadata;
        } catch (error) {
            throw new ApiError(400, "Invalid metadata format");
        }
    }

    const updatedImage = await Gallery.findByIdAndUpdate(
        imageId,
        updateData,
        { new: true, runValidators: true }
    ).populate('uploadedBy', 'name email');

    res.status(200).json(
        new ApiResponse(200, updatedImage, "Image updated successfully")
    );
});

// Admin: Delete image
export const deleteImage = asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }

    // Delete from Cloudinary
    try {
        await deleteFromCloudinary(image.cloudinaryPublicId);
    } catch (error) {
        console.error('Failed to delete from Cloudinary:', error);
        // Continue with database deletion even if Cloudinary deletion fails
    }

    // Soft delete from database
    image.isActive = false;
    await image.save();

    res.status(200).json(
        new ApiResponse(200, {}, "Image deleted successfully")
    );
});

// Admin: Toggle featured status
export const toggleFeatured = asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }

    image.isFeatured = !image.isFeatured;
    await image.save();

    res.status(200).json(
        new ApiResponse(200, image, `Image ${image.isFeatured ? 'featured' : 'unfeatured'} successfully`)
    );
});

// Admin: Update sort order
export const updateSortOrder = asyncHandler(async (req, res) => {
    const { imageId } = req.params;
    const { sortOrder } = req.body;

    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }

    image.sortOrder = sortOrder;
    await image.save();

    res.status(200).json(
        new ApiResponse(200, image, "Sort order updated successfully")
    );
});

// Admin: Bulk update images
export const bulkUpdateImages = asyncHandler(async (req, res) => {
    const { imageIds, updateData } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
        throw new ApiError(400, "Image IDs array is required");
    }

    const results = [];

    for (const imageId of imageIds) {
        try {
            const image = await Gallery.findById(imageId);
            if (!image) {
                results.push({
                    imageId,
                    success: false,
                    error: "Image not found"
                });
                continue;
            }

            const updatedImage = await Gallery.findByIdAndUpdate(
                imageId,
                updateData,
                { new: true, runValidators: true }
            );

            results.push({
                imageId,
                success: true,
                data: updatedImage
            });
        } catch (error) {
            results.push({
                imageId,
                success: false,
                error: error.message
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, "Bulk update completed")
    );
});

// Admin: Get all images (including inactive)
export const getAllImagesAdmin = asyncHandler(async (req, res) => {
    const {
        category,
        subcategory,
        featured,
        isActive,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by category
    if (category) {
        query.category = category;
    }

    // Filter by subcategory
    if (subcategory) {
        query.subcategory = subcategory;
    }

    // Filter featured images
    if (featured === 'true') {
        query.isFeatured = true;
    }

    // Filter by active status
    if (isActive !== undefined) {
        query.isActive = isActive === 'true';
    }

    // Search functionality
    if (search) {
        query.$text = { $search: search };
    }

    // Sort options
    const sortOptions = {};
    if (search && query.$text) {
        sortOptions.score = { $meta: "textScore" };
    }
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const images = await Gallery.find(query, search && query.$text ? { score: { $meta: "textScore" } } : {})
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip)
        .populate('uploadedBy', 'name email');

    const totalImages = await Gallery.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            images,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalImages / parseInt(limit)),
                totalImages,
                hasNext: skip + images.length < totalImages,
                hasPrev: parseInt(page) > 1
            }
        }, "All images retrieved successfully")
    );
});

// Admin: Get image analytics
export const getImageAnalytics = asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }

    const analytics = {
        image: image.getImageInfo(),
        createdAt: image.createdAt,
        updatedAt: image.updatedAt
    };

    res.status(200).json(
        new ApiResponse(200, analytics, "Image analytics retrieved successfully")
    );
});

// Admin: Get gallery dashboard stats
export const getGalleryDashboardStats = asyncHandler(async (req, res) => {
    const [
        totalStats,
        categoryBreakdown,
        recentUploads,
        topImages
    ] = await Promise.all([
        Gallery.getGalleryStats(),
        Gallery.getCategoryBreakdown(),
        Gallery.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('uploadedBy', 'name email'),
        Gallery.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('uploadedBy', 'name email')
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: totalStats[0] || {
                totalImages: 0
            },
            categoryBreakdown,
            recentUploads,
            topImages
        }, "Gallery dashboard stats retrieved successfully")
    );
});






