import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: [true, "Service ID is required"]
    },
    stylistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stylist",
        required: false // Optional as per requirements
    },
    date: {
        type: Date,
        required: [true, "Appointment date is required"],
        validate: {
            validator: function(value) {
                return value > new Date();
            },
            message: "Appointment date must be in the future"
        }
    },
    timeSlot: {
        type: String,
        required: [true, "Time slot is required"],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter time in HH:MM format"]
    },
    location: {
        type: String,
        required: [true, "Location is required"],
        enum: ["home", "salon"],
        default: "salon"
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"],
        default: "pending"
    },
    notes: {
        type: String,
        trim: true,
        maxLength: [500, "Notes cannot exceed 500 characters"]
    },
    totalPrice: {
        type: Number,
        required: [true, "Total price is required"],
        min: [0, "Price cannot be negative"]
    },
    address: {
        street: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        zipCode: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true,
            default: "India"
        }
    },
    // Enhanced booking details
    bookingReference: {
        type: String,
        unique: true,
        required: false // Will be generated in pre-save middleware
    },
    estimatedDuration: {
        type: Number,
        required: true,
        min: [15, "Duration must be at least 15 minutes"]
    },
    specialInstructions: {
        type: String,
        trim: true,
        maxLength: [1000, "Special instructions cannot exceed 1000 characters"]
    },
    // Offer code and discount
    offerCode: {
        type: String,
        trim: true,
        uppercase: true,
        required: false
    },
    offerDiscount: {
        type: Number,
        min: [0, "Offer discount cannot be negative"],
        required: false
    },
    // Status tracking
    statusHistory: [{
        status: {
            type: String,
            enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        reason: {
            type: String,
            trim: true
        }
    }],
    // Cancellation details
    cancellationReason: {
        type: String,
        trim: true,
        maxLength: [200, "Cancellation reason cannot exceed 200 characters"]
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    // Rescheduling details
    rescheduledFrom: {
        date: Date,
        timeSlot: String,
        rescheduledAt: Date,
        rescheduledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    // Payment status (for future integration)
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "refunded", "partial"],
        default: "pending"
    },
    // Reminder settings
    reminderSent: {
        type: Boolean,
        default: false
    },
    reminderSentAt: Date,
    // Rating and feedback
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: {
        type: String,
        trim: true,
        maxLength: [500, "Feedback cannot exceed 500 characters"]
    }
}, {
    timestamps: true
});

// Index for efficient queries
appointmentSchema.index({ userId: 1, date: 1 });
appointmentSchema.index({ stylistId: 1, date: 1, timeSlot: 1 });
appointmentSchema.index({ date: 1, status: 1 });

// Virtual for checking if appointment is in the past
appointmentSchema.virtual('isPast').get(function() {
    const appointmentDateTime = new Date(`${this.date.toDateString()} ${this.timeSlot}`);
    return appointmentDateTime < new Date();
});

// Virtual for checking if appointment can be cancelled (at least 2 hours before)
appointmentSchema.virtual('canBeCancelled').get(function() {
    const appointmentDateTime = new Date(`${this.date.toDateString()} ${this.timeSlot}`);
    const twoHoursBefore = new Date(appointmentDateTime.getTime() - (2 * 60 * 60 * 1000));
    return new Date() < twoHoursBefore && this.status !== 'cancelled' && this.status !== 'completed';
});

// Pre-save middleware to generate booking reference and validate stylist availability
appointmentSchema.pre('save', async function(next) {
    try {
        // Generate booking reference for new appointments
        if (this.isNew && !this.bookingReference) {
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.random().toString(36).substring(2, 5).toUpperCase();
            this.bookingReference = `APT-${timestamp}-${random}`;
        }

        // Set estimated duration from service if not provided
        if (this.isNew && !this.estimatedDuration && this.serviceId) {
            const service = await mongoose.model('Service').findById(this.serviceId);
            if (service) {
                this.estimatedDuration = service.duration;
            }
        }

        // Initialize statusHistory for new appointments
        if (this.isNew && !this.statusHistory) {
            this.statusHistory = [{
                status: this.status || 'pending',
                changedAt: new Date(),
                changedBy: this.userId,
                reason: 'Appointment created'
            }];
        }

        // Add status to history when status changes
        if (this.isModified('status') && !this.isNew) {
            if (!this.statusHistory) {
                this.statusHistory = [];
            }
            this.statusHistory.push({
                status: this.status,
                changedAt: new Date(),
                changedBy: this.updatedBy || this.userId,
                reason: this.statusChangeReason || 'Status updated'
            });
        }

        // Validate stylist availability
        if (this.isNew && this.stylistId) {
            const stylist = await mongoose.model('Stylist').findById(this.stylistId);
            if (!stylist || !stylist.isActive) {
                return next(new Error('Selected stylist is not available'));
            }
            
            // Check if stylist works on the appointment day
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = days[this.date.getDay()];
            if (!stylist.workingDays.includes(dayOfWeek)) {
                return next(new Error('Stylist is not available on this day'));
            }
            
            // Check if appointment time is within stylist's working hours
            const appointmentTime = this.timeSlot;
            if (appointmentTime < stylist.workingHours.start || appointmentTime > stylist.workingHours.end) {
                return next(new Error('Appointment time is outside stylist working hours'));
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Post-save middleware to ensure booking reference is always present
appointmentSchema.post('save', function(doc) {
    if (!doc.bookingReference) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        doc.bookingReference = `APT-${timestamp}-${random}`;
        doc.save().catch(console.error);
    }
});

export const Appointment = mongoose.model("Appointment", appointmentSchema);
