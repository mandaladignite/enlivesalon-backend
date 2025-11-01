import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Offer title is required"],
        trim: true,
        maxLength: [100, "Title cannot exceed 100 characters"]
    },
    description: {
        type: String,
        required: [true, "Offer description is required"],
        trim: true,
        maxLength: [500, "Description cannot exceed 500 characters"]
    },
    code: {
        type: String,
        required: [true, "Offer code is required"],
        trim: true,
        uppercase: true,
        unique: true,
        maxLength: [20, "Code cannot exceed 20 characters"]
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed", "free"],
        default: "percentage"
    },
    discountValue: {
        type: Number,
        required: [true, "Discount value is required"],
        min: [0, "Discount value cannot be negative"]
    },
    minPurchaseAmount: {
        type: Number,
        min: [0, "Minimum purchase amount cannot be negative"],
        default: 0
    },
    maxDiscountAmount: {
        type: Number,
        min: [0, "Max discount amount cannot be negative"],
        default: null // null means no limit
    },
    validFrom: {
        type: Date,
        required: [true, "Valid from date is required"]
    },
    validUntil: {
        type: Date,
        required: [true, "Valid until date is required"]
    },
    applicableServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    applicableCategories: [{
        type: String,
        enum: ["hair", "nail", "body", "skin"]
    }],
    usageLimit: {
        type: Number,
        min: [0, "Usage limit cannot be negative"],
        default: null // null means unlimited
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    bannerImage: {
        type: String,
        trim: true
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
offerSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
// Note: code index is automatically created by unique: true
offerSchema.index({ sortOrder: 1 });

// Virtual to check if offer is currently valid
offerSchema.virtual('isValid').get(function() {
    const now = new Date();
    return this.isActive && 
           now >= this.validFrom && 
           now <= this.validUntil &&
           (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Instance method to check if offer can be applied
offerSchema.methods.canBeApplied = function(amount = 0, serviceIds = [], category = null) {
    if (!this.isValid) {
        return { canApply: false, reason: "Offer is not currently valid" };
    }

    if (amount < this.minPurchaseAmount) {
        return { 
            canApply: false, 
            reason: `Minimum purchase amount of ₹${this.minPurchaseAmount} required` 
        };
    }

    // Check if applicable to service/category
    if (this.applicableServices.length > 0 && serviceIds.length > 0) {
        const isApplicable = serviceIds.some(id => 
            this.applicableServices.some(appId => appId.toString() === id.toString())
        );
        if (!isApplicable) {
            return { canApply: false, reason: "Offer not applicable to selected services" };
        }
    }

    if (this.applicableCategories.length > 0 && category) {
        if (!this.applicableCategories.includes(category)) {
            return { canApply: false, reason: "Offer not applicable to selected category" };
        }
    }

    return { canApply: true };
};

// Instance method to calculate discount
offerSchema.methods.calculateDiscount = function(amount) {
    if (this.discountType === "percentage") {
        let discount = (amount * this.discountValue) / 100;
        if (this.maxDiscountAmount !== null && discount > this.maxDiscountAmount) {
            discount = this.maxDiscountAmount;
        }
        return discount;
    } else if (this.discountType === "fixed") {
        return Math.min(this.discountValue, amount);
    } else {
        return amount; // free
    }
};

// Ensure virtual fields are serialized
offerSchema.set('toJSON', { virtuals: true });
offerSchema.set('toObject', { virtuals: true });

// Static method to get active offers
offerSchema.statics.getActiveOffers = function() {
    const now = new Date();
    return this.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
    }).sort({ sortOrder: 1, createdAt: -1 });
};

// Static method to get valid offers for a specific date
offerSchema.statics.getValidOffersForDate = function(date) {
    return this.find({
        isActive: true,
        validFrom: { $lte: date },
        validUntil: { $gte: date }
    }).sort({ sortOrder: 1, createdAt: -1 });
};

export const Offer = mongoose.model("Offer", offerSchema);

