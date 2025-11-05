import mongoose from "mongoose";

const heroSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Hero title is required"],
        trim: true,
        maxLength: [200, "Title cannot exceed 200 characters"]
    },
    subtitle: {
        type: String,
        trim: true,
        maxLength: [100, "Subtitle cannot exceed 100 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxLength: [500, "Description cannot exceed 500 characters"]
    },
    backgroundImage: {
        type: String,
        required: [true, "Background image is required"],
        trim: true
    },
    ctaPrimary: {
        text: {
            type: String,
            required: [true, "Primary CTA text is required"],
            trim: true,
            maxLength: [50, "CTA text cannot exceed 50 characters"]
        },
        link: {
            type: String,
            required: [true, "Primary CTA link is required"],
            trim: true,
            maxLength: [200, "CTA link cannot exceed 200 characters"]
        }
    },
    ctaSecondary: {
        text: {
            type: String,
            trim: true,
            maxLength: [50, "CTA text cannot exceed 50 characters"]
        },
        link: {
            type: String,
            trim: true,
            maxLength: [200, "CTA link cannot exceed 200 characters"]
        }
    },
    stats: [{
        icon: {
            type: String,
            required: true,
            trim: true,
            maxLength: [50, "Icon name cannot exceed 50 characters"]
        },
        value: {
            type: String,
            required: true,
            trim: true,
            maxLength: [20, "Stat value cannot exceed 20 characters"]
        },
        label: {
            type: String,
            required: true,
            trim: true,
            maxLength: [50, "Stat label cannot exceed 50 characters"]
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for better query performance
heroSchema.index({ isActive: 1, sortOrder: 1 });

// Static method to get active hero sections
heroSchema.statics.getActiveHeroSections = function() {
    return this.find({
        isActive: true
    }).sort({ sortOrder: 1, createdAt: -1 });
};

export const Hero = mongoose.model("Hero", heroSchema);

