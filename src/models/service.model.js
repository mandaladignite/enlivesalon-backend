import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Service name is required"],
        trim: true,
        maxLength: [100, "Service name cannot exceed 100 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxLength: [1000, "Description cannot exceed 1000 characters"]
    },
    duration: {
        type: Number,
        required: [true, "Service duration is required"],
        min: [15, "Minimum duration is 15 minutes"],
        max: [480, "Maximum duration is 8 hours"]
    },
    price: {
        type: Number,
        required: [true, "Service price is required"],
        min: [0, "Price cannot be negative"],
        max: [999999, "Price cannot exceed 999999"]
    },
    currency: {
        type: String,
        default: "INR",
        enum: ["INR"],
        required: true
    },
    category: {
        type: String,
        required: [true, "Service category is required"],
        enum: ["hair", "nail", "body", "skin"],
        default: "hair"
    },
    subCategory: {
        type: String,
        required: [true, "Service sub-category is required"],
        trim: true,
        maxLength: [50, "Sub-category cannot exceed 50 characters"]
    },
    icon: {
        type: String,
        required: [true, "Service icon is required"],
        trim: true,
        maxLength: [50, "Icon name cannot exceed 50 characters"]
    },
    photo: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
            },
            message: "Photo must be a valid image URL"
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    availableAtHome: {
        type: Boolean,
        default: false
    },
    availableAtSalon: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String,
        trim: true,
        maxLength: [30, "Tag cannot exceed 30 characters"]
    }],
    sortOrder: {
        type: Number,
        default: 0
    },
    discount: {
        percentage: {
            type: Number,
            min: [0, "Discount percentage cannot be negative"],
            max: [100, "Discount percentage cannot exceed 100"],
            default: 0
        },
        isActive: {
            type: Boolean,
            default: false
        },
        validFrom: {
            type: Date,
            default: Date.now
        },
        validUntil: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Indexes for better performance
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ category: 1, subCategory: 1, isActive: 1 });
serviceSchema.index({ subCategory: 1, isActive: 1 });
serviceSchema.index({ isFeatured: 1, isActive: 1 });
serviceSchema.index({ sortOrder: 1 });
serviceSchema.index({ name: "text", description: "text" });

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: this.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(this.price);
});

// Virtual for duration in hours and minutes
serviceSchema.virtual('formattedDuration').get(function() {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
});

// Virtual for discounted price
serviceSchema.virtual('discountedPrice').get(function() {
    if (!this.discount.isActive || this.discount.percentage === 0) {
        return this.price;
    }
    
    const now = new Date();
    if (this.discount.validFrom && now < this.discount.validFrom) {
        return this.price;
    }
    if (this.discount.validUntil && now > this.discount.validUntil) {
        return this.price;
    }
    
    const discountAmount = (this.price * this.discount.percentage) / 100;
    return Math.max(0, this.price - discountAmount);
});

// Virtual for formatted discounted price
serviceSchema.virtual('formattedDiscountedPrice').get(function() {
    const discountedPrice = this.discountedPrice;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: this.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(discountedPrice);
});

// Static method to get services by category with pagination
serviceSchema.statics.getByCategory = function(category, options = {}) {
    const { page = 1, limit = 10, isActive = true, isFeatured = null } = options;
    
    const query = { category, isActive };
    if (isFeatured !== null) {
        query.isFeatured = isFeatured;
    }
    
    return this.find(query)
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

// Static method to get featured services
serviceSchema.statics.getFeatured = function(category = null) {
    const query = { isFeatured: true, isActive: true };
    if (category) {
        query.category = category;
    }
    
    return this.find(query)
        .sort({ sortOrder: 1, createdAt: -1 });
};

// Static method to get services by subcategory with pagination
serviceSchema.statics.getBySubCategory = function(subCategory, options = {}) {
    const { page = 1, limit = 10, isActive = true, isFeatured = null } = options;
    
    const query = { subCategory, isActive };
    if (isFeatured !== null) {
        query.isFeatured = isFeatured;
    }
    
    return this.find(query)
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

export const Service = mongoose.model("Service", serviceSchema);
