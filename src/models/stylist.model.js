import mongoose from "mongoose";

const stylistSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        default: ''
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    specialties: [{
        type: String,
    }],
    experience: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },
    bio: {
        type: String,
        trim: true,
        default: ''
    },
    workingHours: {
        start: {
            type: String,
            default: '09:00'
        },
        end: {
            type: String,
            default: '18:00'
        }
    },
    workingDays: [{
        type: String,
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
    },
    image: {
        public_id: {
            type: String,
            trim: true
        },
        secure_url: {
            type: String,
            trim: true
        },
        url: {
            type: String,
            trim: true
        }
    }
}, {
    timestamps: true
});

export const Stylist = mongoose.model("Stylist", stylistSchema);
