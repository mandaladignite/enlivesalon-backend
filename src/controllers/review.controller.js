import Review from '../models/review.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

// @desc    Get all reviews (public)
// @route   GET /api/reviews
// @access  Public
const getAllReviews = asyncHandler(async (req, res) => {
  const { isActive = true, isFeatured, limit = 10, page = 1, service } = req.query;
  
  // Build filter object
  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
  
  // Add service filtering if provided
  if (service) {
    filter.service = { $regex: service, $options: 'i' };
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get reviews with pagination
  const reviews = await Review.find(filter)
    .sort({ isFeatured: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const totalReviews = await Review.countDocuments(filter);
  
  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / parseInt(limit)),
        totalReviews,
        hasNext: skip + reviews.length < totalReviews,
        hasPrev: parseInt(page) > 1
      }
    }, "Reviews fetched successfully")
  );
});

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
const getReviewById = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  res.status(200).json(
    new ApiResponse(200, review, "Review fetched successfully")
  );
});

// @desc    Create new review (Admin only)
// @route   POST /api/reviews
// @access  Private/Admin
const createReview = asyncHandler(async (req, res) => {
  const { name, age, quote, rating, isActive, isFeatured, service } = req.body;
  
  // Validate required fields
  if (!name || !age || !quote || !rating) {
    throw new ApiError(400, "Name, age, quote, and rating are required");
  }
  
  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }
  
  // Check if image file is uploaded
  if (!req.file) {
    throw new ApiError(400, "Image file is required");
  }
  
  // Upload image to Cloudinary
  const imageUploadResult = await uploadToCloudinary(req.file, {
    folder: 'salon-reviews',
    category: 'testimonials'
  });
  
  const review = await Review.create({
    name,
    age,
    quote,
    image: {
      public_id: imageUploadResult.public_id,
      secure_url: imageUploadResult.secure_url,
      url: imageUploadResult.url,
      width: imageUploadResult.width,
      height: imageUploadResult.height,
      format: imageUploadResult.format,
      bytes: imageUploadResult.bytes
    },
    rating,
    isActive: isActive !== undefined ? isActive : true,
    isFeatured: isFeatured !== undefined ? isFeatured : false,
    service
  });
  
  res.status(201).json(
    new ApiResponse(201, review, "Review created successfully")
  );
});

// @desc    Update review (Admin only)
// @route   PUT /api/reviews/:id
// @access  Private/Admin
const updateReview = asyncHandler(async (req, res) => {
  const { name, age, quote, rating, isActive, isFeatured, service } = req.body;
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Update fields if provided
  if (name !== undefined) review.name = name;
  if (age !== undefined) review.age = age;
  if (quote !== undefined) review.quote = quote;
  if (rating !== undefined) {
    if (rating < 1 || rating > 5) {
      throw new ApiError(400, "Rating must be between 1 and 5");
    }
    review.rating = rating;
  }
  if (isActive !== undefined) review.isActive = isActive;
  if (isFeatured !== undefined) review.isFeatured = isFeatured;
  if (service !== undefined) review.service = service;
  
  // Handle image update if new file is uploaded
  if (req.file) {
    // Delete old image from Cloudinary
    if (review.image && review.image.public_id) {
      try {
        await deleteFromCloudinary(review.image.public_id);
      } catch (error) {
        console.error('Error deleting old image:', error);
        // Continue with update even if deletion fails
      }
    }
    
    // Upload new image to Cloudinary
    const imageUploadResult = await uploadToCloudinary(req.file, {
      folder: 'salon-reviews',
      category: 'testimonials'
    });
    
    review.image = {
      public_id: imageUploadResult.public_id,
      secure_url: imageUploadResult.secure_url,
      url: imageUploadResult.url,
      width: imageUploadResult.width,
      height: imageUploadResult.height,
      format: imageUploadResult.format,
      bytes: imageUploadResult.bytes
    };
  }
  
  await review.save();
  
  res.status(200).json(
    new ApiResponse(200, review, "Review updated successfully")
  );
});

// @desc    Delete review (Admin only)
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Delete image from Cloudinary
  if (review.image && review.image.public_id) {
    try {
      await deleteFromCloudinary(review.image.public_id);
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      // Continue with review deletion even if image deletion fails
    }
  }
  
  await Review.findByIdAndDelete(req.params.id);
  
  res.status(200).json(
    new ApiResponse(200, null, "Review deleted successfully")
  );
});

// @desc    Toggle review status (Admin only)
// @route   PATCH /api/reviews/:id/toggle-status
// @access  Private/Admin
const toggleReviewStatus = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  review.isActive = !review.isActive;
  await review.save();
  
  res.status(200).json(
    new ApiResponse(200, review, `Review ${review.isActive ? 'activated' : 'deactivated'} successfully`)
  );
});

// @desc    Toggle featured status (Admin only)
// @route   PATCH /api/reviews/:id/toggle-featured
// @access  Private/Admin
const toggleFeaturedStatus = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  review.isFeatured = !review.isFeatured;
  await review.save();
  
  res.status(200).json(
    new ApiResponse(200, review, `Review ${review.isFeatured ? 'featured' : 'unfeatured'} successfully`)
  );
});

// @desc    Get reviews for admin dashboard
// @route   GET /api/admin/reviews
// @access  Private/Admin
const getAdminReviews = asyncHandler(async (req, res) => {
  const { status, featured, search, limit = 20, page = 1 } = req.query;
  
  // Build filter object
  const filter = {};
  if (status !== undefined) filter.isActive = status === 'active';
  if (featured !== undefined) filter.isFeatured = featured === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { quote: { $regex: search, $options: 'i' } },
      { service: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get reviews with pagination
  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const totalReviews = await Review.countDocuments(filter);
  
  // Get statistics
  const stats = await Review.aggregate([
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        activeReviews: { $sum: { $cond: ['$isActive', 1, 0] } },
        featuredReviews: { $sum: { $cond: ['$isFeatured', 1, 0] } },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);
  
  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / parseInt(limit)),
        totalReviews,
        hasNext: skip + reviews.length < totalReviews,
        hasPrev: parseInt(page) > 1
      },
      stats: stats[0] || {
        totalReviews: 0,
        activeReviews: 0,
        featuredReviews: 0,
        averageRating: 0
      }
    }, "Admin reviews fetched successfully")
  );
});

export {
  getAllReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  toggleReviewStatus,
  toggleFeaturedStatus,
  getAdminReviews
};
