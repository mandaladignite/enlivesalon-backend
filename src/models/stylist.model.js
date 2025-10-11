import mongoose from "mongoose";

const stylistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Stylist name is required"],
        trim: true,
        maxLength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"]
    },
    specialties: [{
        type: String,
        enum: ["hair", "nails", "skincare", "massage", "makeup", "other"]
    }],
    experience: {
        type: Number,
        min: [0, "Experience cannot be negative"],
        default: 0
    },
    rating: {
        type: Number,
        min: [0, "Rating cannot be less than 0"],
        max: [5, "Rating cannot be more than 5"],
        default: 0
    },
    bio: {
        type: String,
        trim: true,
        maxLength: [500, "Bio cannot exceed 500 characters"]
    },
    workingHours: {
        start: {
            type: String,
            required: [true, "Working start time is required"],
            match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter time in HH:MM format"]
        },
        end: {
            type: String,
            required: [true, "Working end time is required"],
            match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter time in HH:MM format"]
        }
    },
    workingDays: [{
        type: String,
        enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        required: [true, "At least one working day is required"]
    }],
    availableForHome: {
        type: Boolean,
        default: false
    },
    availableForSalon: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export const Stylist = mongoose.model("Stylist", stylistSchema);
