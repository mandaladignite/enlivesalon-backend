import mongoose from "mongoose";

const packageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Package name is required"],
        trim: true,
        maxLength: [100, "Package name cannot exceed 100 characters"],
        unique: true
    },
    description: {
        type: String,
        required: [true, "Package description is required"],
        trim: true,
        maxLength: [500, "Description cannot exceed 500 characters"]
    },
    price: {
        type: Number,
        required: [true, "Package price is required"],
        min: [0, "Price cannot be negative"]
    },
    duration: {
        type: Number,
        required: [true, "Package duration is required"],
        min: [1, "Duration must be at least 1 day"]
    },
    durationUnit: {
        type: String,
        enum: ["days", "weeks", "months", "years"],
        default: "months"
    },
    benefits: [{
        type: String,
        trim: true,
        maxLength: [200, "Benefit description cannot exceed 200 characters"]
    }],
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    discountPercentage: {
        type: Number,
        min: [0, "Discount percentage cannot be negative"],
        max: [100, "Discount percentage cannot exceed 100"],
        default: 0
    },
    maxAppointments: {
        type: Number,
        min: [0, "Max appointments cannot be negative"],
        default: null // null means unlimited
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    termsAndConditions: {
        type: String,
        trim: true,
        maxLength: [1000, "Terms and conditions cannot exceed 1000 characters"]
    }
}, {
    timestamps: true
});

// Index for better query performance
packageSchema.index({ isActive: 1, sortOrder: 1 });
packageSchema.index({ price: 1 });
packageSchema.index({ duration: 1 });

// Virtual for formatted duration
packageSchema.virtual('formattedDuration').get(function() {
    return `${this.duration} ${this.durationUnit}`;
});

// Virtual for discounted price
packageSchema.virtual('discountedPrice').get(function() {
    if (this.discountPercentage > 0) {
        return Math.round(this.price * (1 - this.discountPercentage / 100));
    }
    return this.price;
});

// Virtual for savings amount
packageSchema.virtual('savingsAmount').get(function() {
    if (this.discountPercentage > 0) {
        return this.price - this.discountedPrice;
    }
    return 0;
});

// Ensure virtual fields are serialized
packageSchema.set('toJSON', { virtuals: true });
packageSchema.set('toObject', { virtuals: true });

// Static method to get active packages
packageSchema.statics.getActivePackages = function() {
    return this.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
};

// Static method to get popular packages
packageSchema.statics.getPopularPackages = function() {
    return this.find({ isActive: true, isPopular: true }).sort({ sortOrder: 1, price: 1 });
};

// Static method to get packages by price range
packageSchema.statics.getPackagesByPriceRange = function(minPrice, maxPrice) {
    return this.find({
        isActive: true,
        price: { $gte: minPrice, $lte: maxPrice }
    }).sort({ price: 1 });
};

// Instance method to check if package is available
packageSchema.methods.isAvailable = function() {
    return this.isActive;
};

// Instance method to get package summary
packageSchema.methods.getSummary = function() {
    return {
        id: this._id,
        name: this.name,
        price: this.price,
        discountedPrice: this.discountedPrice,
        duration: this.formattedDuration,
        benefits: this.benefits,
        isPopular: this.isPopular
    };
};

export const Package = mongoose.model("Package", packageSchema);

