import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Image title is required"],
        trim: true,
        maxLength: [100, "Title cannot exceed 100 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxLength: [500, "Description cannot exceed 500 characters"]
    },
    category: {
        type: String,
        required: [true, "Category is required"],
        enum: {
            values: ["Hair", "Skin", "Nail", "Body"],
            message: "Category must be one of: Hair, Skin, Nail, Body"
        }
    },
    subcategory: {
        type: String,
        trim: true,
        maxLength: [50, "Subcategory cannot exceed 50 characters"]
    },
    tags: [{
        type: String,
        trim: true,
        maxLength: [30, "Each tag cannot exceed 30 characters"]
    }],
    imageUrl: {
        type: String,
        required: [true, "Image URL is required"],
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
            },
            message: "Please provide a valid image URL"
        }
    },
    cloudinaryPublicId: {
        type: String,
        required: [true, "Cloudinary public ID is required"]
    },
    cloudinarySecureUrl: {
        type: String,
        required: [true, "Cloudinary secure URL is required"]
    },
    originalFileName: {
        type: String,
        required: [true, "Original file name is required"]
    },
    dimensions: {
        width: {
            type: Number,
            required: [true, "Image width is required"],
            min: [1, "Width must be at least 1 pixel"]
        },
        height: {
            type: Number,
            required: [true, "Image height is required"],
            min: [1, "Height must be at least 1 pixel"]
        }
    },
    format: {
        type: String,
        required: [true, "Image format is required"],
        enum: ["jpg", "jpeg", "png", "gif", "webp"]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Uploader ID is required"]
    },
    // SEO fields
    altText: {
        type: String,
        trim: true,
        maxLength: [200, "Alt text cannot exceed 200 characters"]
    },
    // Gallery organization
    galleryPosition: {
        type: Number,
        default: 0
    },
    // Image processing info
    transformations: [{
        name: String,
        width: Number,
        height: Number,
        crop: String,
        quality: String
    }],
    // Metadata
    metadata: {
        camera: String,
        lens: String,
        settings: String,
        location: String,
        photographer: String,
        model: String,
        stylist: String
    }
}, {
    timestamps: true
});

// Indexes for better query performance
gallerySchema.index({ category: 1, isActive: 1 });
gallerySchema.index({ subcategory: 1, isActive: 1 });
gallerySchema.index({ tags: 1 });
gallerySchema.index({ isFeatured: 1, isActive: 1 });
gallerySchema.index({ uploadedBy: 1 });
gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ sortOrder: 1 });

// Text index for search functionality
gallerySchema.index({
    title: "text",
    description: "text",
    tags: "text",
    subcategory: "text"
});

// Virtual for aspect ratio
gallerySchema.virtual('aspectRatio').get(function() {
    if (this.dimensions && this.dimensions.width && this.dimensions.height) {
        return (this.dimensions.width / this.dimensions.height).toFixed(2);
    }
    return null;
});


// Virtual for image dimensions string
gallerySchema.virtual('dimensionsString').get(function() {
    if (this.dimensions && this.dimensions.width && this.dimensions.height) {
        return `${this.dimensions.width}x${this.dimensions.height}`;
    }
    return null;
});

// Ensure virtual fields are serialized
gallerySchema.set('toJSON', { virtuals: true });
gallerySchema.set('toObject', { virtuals: true });

// Static method to get images by category
gallerySchema.statics.getImagesByCategory = function(category, options = {}) {
    const query = { category, isActive: true };
    
    if (options.subcategory) {
        query.subcategory = options.subcategory;
    }
    
    if (options.featured) {
        query.isFeatured = true;
    }
    
    return this.find(query)
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

// Static method to get featured images
gallerySchema.statics.getFeaturedImages = function(limit = 10) {
    return this.find({ isFeatured: true, isActive: true })
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(limit);
};

// Static method to search images
gallerySchema.statics.searchImages = function(searchTerm, options = {}) {
    const query = {
        isActive: true,
        $text: { $search: searchTerm }
    };
    
    if (options.category) {
        query.category = options.category;
    }
    
    return this.find(query, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .limit(options.limit || 20)
        .skip(options.skip || 0);
};

// Static method to get gallery statistics
gallerySchema.statics.getGalleryStats = function() {
    return this.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: null,
                totalImages: { $sum: 1 },
                categoryStats: {
                    $push: {
                        category: "$category",
                        subcategory: "$subcategory"
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalImages: 1,
                categoryStats: 1
            }
        }
    ]);
};

// Static method to get category breakdown
gallerySchema.statics.getCategoryBreakdown = function() {
    return this.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 },
                featuredCount: {
                    $sum: { $cond: [{ $eq: ["$isFeatured", true] }, 1, 0] }
                }
            }
        },
        { $sort: { count: -1 } }
    ]);
};


// Instance method to update sort order
gallerySchema.methods.updateSortOrder = function(newOrder) {
    this.sortOrder = newOrder;
    return this.save();
};

// Instance method to get image info
gallerySchema.methods.getImageInfo = function() {
    return {
        id: this._id,
        title: this.title,
        category: this.category,
        subcategory: this.subcategory,
        imageUrl: this.imageUrl,
        dimensions: this.dimensionsString,
        isFeatured: this.isFeatured,
        createdAt: this.createdAt
    };
};

// Pre-save middleware to generate alt text if not provided
gallerySchema.pre('save', function(next) {
    if (!this.altText && this.title) {
        this.altText = `${this.title} - ${this.category} gallery image`;
    }
    next();
});

export const Gallery = mongoose.model("Gallery", gallerySchema);