import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const enquirySchema = new mongoose.Schema({
    enquiryNumber: {
        type: String,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxLength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        maxLength: [100, "Email cannot exceed 100 characters"],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        maxLength: [20, "Phone number cannot exceed 20 characters"]
    },
    subject: {
        type: String,
        required: [true, "Subject is required"],
        trim: true,
        maxLength: [200, "Subject cannot exceed 200 characters"]
    },
    message: {
        type: String,
        required: [true, "Message is required"],
        trim: true,
        maxLength: [2000, "Message cannot exceed 2000 characters"]
    },
    enquiryType: {
        type: String,
        required: [true, "Enquiry type is required"],
        enum: {
            values: ["general", "appointment", "service", "product", "membership", "complaint", "feedback", "other"],
            message: "Invalid enquiry type"
        },
        default: "general"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },
    status: {
        type: String,
        enum: ["new", "in_progress", "responded", "resolved", "closed"],
        default: "new"
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null // null for guest enquiries
    },
    response: {
        message: {
            type: String,
            trim: true,
            maxLength: [2000, "Response message cannot exceed 2000 characters"]
        },
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        respondedAt: {
            type: Date
        },
        responseMethod: {
            type: String,
            enum: ["email", "phone", "whatsapp", "in_person"],
            default: "email"
        }
    },
    followUp: {
        scheduledAt: {
            type: Date
        },
        notes: {
            type: String,
            trim: true,
            maxLength: [500, "Follow-up notes cannot exceed 500 characters"]
        },
        completed: {
            type: Boolean,
            default: false
        }
    },
    tags: [{
        type: String,
        trim: true,
        maxLength: [30, "Each tag cannot exceed 30 characters"]
    }],
    source: {
        type: String,
        enum: ["website", "phone", "email", "walk_in", "social_media", "referral", "other"],
        default: "website"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resolvedAt: {
        type: Date
    },
    closedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for better query performance
// enquiryNumber already has unique index from field definition
enquirySchema.index({ email: 1 });
enquirySchema.index({ status: 1 });
enquirySchema.index({ enquiryType: 1 });
enquirySchema.index({ priority: 1 });
enquirySchema.index({ assignedTo: 1 });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ status: 1, priority: 1 });

// Pre-save middleware to generate enquiry number
enquirySchema.pre('save', async function(next) {
    if (this.isNew && !this.enquiryNumber) {
        const count = await mongoose.model('Enquiry').countDocuments();
        this.enquiryNumber = `ENQ-${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

// Virtual for formatted creation date
enquirySchema.virtual('formattedCreatedAt').get(function() {
    return this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for days since creation
enquirySchema.virtual('daysSinceCreation').get(function() {
    const now = new Date();
    const diffTime = Math.abs(now - this.createdAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to mark as resolved
enquirySchema.methods.markAsResolved = function(resolvedBy) {
    this.status = 'resolved';
    this.resolvedAt = new Date();
    if (resolvedBy) {
        this.response.respondedBy = resolvedBy;
    }
    return this.save();
};

// Instance method to close enquiry
enquirySchema.methods.closeEnquiry = function(closedBy) {
    this.status = 'closed';
    this.closedAt = new Date();
    if (closedBy) {
        this.response.respondedBy = closedBy;
    }
    return this.save();
};

// Static method to get enquiry statistics
enquirySchema.statics.getEnquiryStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
                responded: { $sum: { $cond: [{ $eq: ["$status", "responded"] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                closed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
                urgent: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } },
                high: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
                medium: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
                low: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } }
            }
        }
    ]);
    
    return stats[0] || {
        total: 0, new: 0, inProgress: 0, responded: 0, resolved: 0, closed: 0,
        urgent: 0, high: 0, medium: 0, low: 0
    };
};

// Static method to get enquiries by type
enquirySchema.statics.getEnquiriesByType = async function() {
    return await this.aggregate([
        {
            $group: {
                _id: "$enquiryType",
                count: { $sum: 1 },
                avgResponseTime: { $avg: "$response.respondedAt" }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

// Add pagination plugin
enquirySchema.plugin(mongoosePaginate);

const Enquiry = mongoose.model("Enquiry", enquirySchema);

export default Enquiry;
