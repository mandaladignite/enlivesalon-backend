import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Package",
        required: [true, "Package ID is required"]
    },
    packageName: {
        type: String,
        required: [true, "Package name is required"],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        maxLength: [500, "Description cannot exceed 500 characters"]
    },
    startDate: {
        type: Date,
        required: [true, "Start date is required"],
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: [true, "Expiry date is required"]
    },
    isActive: {
        type: Boolean,
        default: false
    },
    membershipStatus: {
        type: String,
        enum: ["active", "expired", "cancelled", "suspended", "pending_activation", "pending_payment"],
        default: "pending_payment"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
        default: "pending"
    },
    // Enhanced payment fields
    razorpayOrderId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    razorpayPaymentId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    razorpaySignature: {
        type: String,
        trim: true
    },
    paymentMethod: {
        type: String,
        enum: ["razorpay", "cash", "card", "upi", "wallet", "netbanking"],
        default: "razorpay"
    },
    amountPaid: {
        type: Number,
        required: [true, "Amount paid is required"],
        min: [0, "Amount paid cannot be negative"]
    },
    originalAmount: {
        type: Number,
        required: [true, "Original amount is required"],
        min: [0, "Original amount cannot be negative"]
    },
    discountApplied: {
        type: Number,
        default: 0,
        min: [0, "Discount cannot be negative"]
    },
    taxAmount: {
        type: Number,
        default: 0,
        min: [0, "Tax amount cannot be negative"]
    },
    // Enhanced appointment tracking
    remainingAppointments: {
        type: Number,
        default: null // null means unlimited
    },
    usedAppointments: {
        type: Number,
        default: 0,
        min: [0, "Used appointments cannot be negative"]
    },
    // Membership tier and benefits
    membershipTier: {
        type: String,
        enum: ["basic", "premium", "vip", "platinum"],
        default: "basic"
    },
    benefits: [{
        type: String,
        trim: true
    }],
    // Auto-renewal settings
    autoRenewal: {
        type: Boolean,
        default: false
    },
    renewalDate: {
        type: Date
    },
    // Enhanced tracking
    notes: {
        type: String,
        trim: true,
        maxLength: [500, "Notes cannot exceed 500 characters"]
    },
    activatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    activatedAt: {
        type: Date,
        default: Date.now
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxLength: [200, "Cancellation reason cannot exceed 200 characters"]
    },
    // Enhanced tracking fields
    lastUsedAt: {
        type: Date
    },
    totalSavings: {
        type: Number,
        default: 0,
        min: [0, "Total savings cannot be negative"]
    },
    referralCode: {
        type: String,
        trim: true,
        maxLength: [20, "Referral code cannot exceed 20 characters"]
    },
    // Payment retry tracking
    paymentRetryCount: {
        type: Number,
        default: 0,
        min: [0, "Payment retry count cannot be negative"]
    },
    lastPaymentAttempt: {
        type: Date
    },
    // Membership upgrade/downgrade tracking
    previousMembershipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Membership"
    },
    upgradeHistory: [{
        fromTier: String,
        toTier: String,
        upgradedAt: { type: Date, default: Date.now },
        upgradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    }]
}, {
    timestamps: true
});

// Enhanced indexes for better performance
membershipSchema.index({ userId: 1, isActive: 1 });
membershipSchema.index({ packageId: 1 });
membershipSchema.index({ paymentStatus: 1 });
membershipSchema.index({ membershipStatus: 1 });
membershipSchema.index({ membershipTier: 1 });
membershipSchema.index({ expiryDate: 1 });
membershipSchema.index({ createdAt: -1 });
// razorpayOrderId and razorpayPaymentId already have unique indexes from field definitions
membershipSchema.index({ autoRenewal: 1, renewalDate: 1 });
membershipSchema.index({ startDate: 1, expiryDate: 1 });

// Virtual for membership duration in days
membershipSchema.virtual('durationInDays').get(function() {
    const diffTime = Math.abs(this.expiryDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days remaining
membershipSchema.virtual('daysRemaining').get(function() {
    if (!this.isActive) return 0;
    const now = new Date();
    const diffTime = this.expiryDate - now;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Enhanced virtual for membership status
membershipSchema.virtual('status').get(function() {
    const now = new Date();
    if (!this.isActive) return 'cancelled';
    if (this.membershipStatus === 'suspended') return 'suspended';
    if (this.paymentStatus !== 'paid') return 'pending_payment';
    if (now < this.startDate) return 'not_started';
    if (now > this.expiryDate) return 'expired';
    return 'active';
});

// Virtual for membership tier benefits
membershipSchema.virtual('tierBenefits').get(function() {
    const tierBenefits = {
        basic: ['Standard services', 'Basic discounts'],
        premium: ['Priority booking', 'Enhanced discounts', 'Free consultations'],
        vip: ['VIP lounge access', 'Premium discounts', 'Personal stylist'],
        platinum: ['Exclusive events', 'Maximum discounts', 'Concierge service']
    };
    return tierBenefits[this.membershipTier] || [];
});

// Virtual for savings percentage
membershipSchema.virtual('savingsPercentage').get(function() {
    if (this.originalAmount > 0) {
        return Math.round((this.discountApplied / this.originalAmount) * 100);
    }
    return 0;
});

// Virtual for membership validity
membershipSchema.virtual('isValidMembership').get(function() {
    const now = new Date();
    return this.isActive && 
           this.membershipStatus === 'active' &&
           this.paymentStatus === 'paid' && 
           now >= this.startDate && 
           now <= this.expiryDate;
});

// Virtual for is expired
membershipSchema.virtual('isExpired').get(function() {
    return new Date() > this.expiryDate;
});

// Virtual for is expiring soon (within 7 days)
membershipSchema.virtual('isExpiringSoon').get(function() {
    if (!this.isActive) return false;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.expiryDate <= sevenDaysFromNow && this.expiryDate > now;
});

// Ensure virtual fields are serialized
membershipSchema.set('toJSON', { virtuals: true });
membershipSchema.set('toObject', { virtuals: true });

// Static method to get active memberships for a user
membershipSchema.statics.getActiveMemberships = function(userId) {
    return this.find({
        userId: userId,
        isActive: true,
        paymentStatus: 'paid',
        expiryDate: { $gt: new Date() }
    }).populate('packageId', 'name description benefits').sort({ startDate: -1 });
};

// Static method to get expired memberships for a user
membershipSchema.statics.getExpiredMemberships = function(userId) {
    return this.find({
        userId: userId,
        $or: [
            { isActive: false },
            { expiryDate: { $lte: new Date() } }
        ]
    }).populate('packageId', 'name description').sort({ expiryDate: -1 });
};

// Static method to get memberships by status
membershipSchema.statics.getMembershipsByStatus = function(status) {
    const now = new Date();
    let query = { isActive: true, paymentStatus: 'paid' };
    
    switch (status) {
        case 'active':
            query.startDate = { $lte: now };
            query.expiryDate = { $gt: now };
            break;
        case 'expired':
            query.expiryDate = { $lte: now };
            break;
        case 'not_started':
            query.startDate = { $gt: now };
            break;
        case 'expiring_soon':
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            query.startDate = { $lte: now };
            query.expiryDate = { $gt: now, $lte: sevenDaysFromNow };
            break;
    }
    
    return this.find(query).populate('userId', 'name email').populate('packageId', 'name').sort({ expiryDate: 1 });
};

// Static method to get membership statistics
membershipSchema.statics.getMembershipStats = function() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalMemberships: { $sum: 1 },
                activeMemberships: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$isActive", true] },
                                    { $eq: ["$paymentStatus", "paid"] },
                                    { $lte: ["$startDate", now] },
                                    { $gt: ["$expiryDate", now] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                expiredMemberships: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ["$isActive", false] },
                                    { $lte: ["$expiryDate", now] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                expiringSoon: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$isActive", true] },
                                    { $eq: ["$paymentStatus", "paid"] },
                                    { $lte: ["$startDate", now] },
                                    { $gt: ["$expiryDate", now] },
                                    { $lte: ["$expiryDate", sevenDaysFromNow] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                totalRevenue: { $sum: "$amountPaid" }
            }
        }
    ]);
};

// Instance method to check if membership is valid
membershipSchema.methods.isValid = function() {
    const now = new Date();
    return this.isActive && 
           this.paymentStatus === 'paid' && 
           now >= this.startDate && 
           now <= this.expiryDate;
};

// Instance method to extend membership
membershipSchema.methods.extend = function(additionalDays) {
    this.expiryDate = new Date(this.expiryDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    return this.save();
};

// Instance method to cancel membership
membershipSchema.methods.cancel = function(cancelledBy, reason) {
    this.isActive = false;
    this.cancelledAt = new Date();
    this.cancelledBy = cancelledBy;
    this.cancellationReason = reason;
    return this.save();
};

// Enhanced instance method to use appointment
membershipSchema.methods.useAppointment = function() {
    if (!this.isValid()) {
        throw new Error('Membership is not valid or has expired');
    }
    
    if (this.remainingAppointments !== null) {
        if (this.remainingAppointments > 0) {
            this.remainingAppointments -= 1;
            this.usedAppointments += 1;
            this.lastUsedAt = new Date();
            return this.save();
        } else {
            throw new Error('No remaining appointments in this membership');
        }
    }
    // Unlimited appointments
    this.usedAppointments += 1;
    this.lastUsedAt = new Date();
    return this.save();
};

// Instance method to upgrade membership tier
membershipSchema.methods.upgradeTier = function(newTier, upgradedBy) {
    if (!['basic', 'premium', 'vip', 'platinum'].includes(newTier)) {
        throw new Error('Invalid membership tier');
    }
    
    const oldTier = this.membershipTier;
    this.membershipTier = newTier;
    
    // Add to upgrade history
    this.upgradeHistory.push({
        fromTier: oldTier,
        toTier: newTier,
        upgradedAt: new Date(),
        upgradedBy: upgradedBy
    });
    
    return this.save();
};

// Instance method to enable/disable auto-renewal
membershipSchema.methods.setAutoRenewal = function(enabled) {
    this.autoRenewal = enabled;
    if (enabled) {
        this.renewalDate = this.expiryDate;
    } else {
        this.renewalDate = null;
    }
    return this.save();
};

// Instance method to calculate savings
membershipSchema.methods.calculateSavings = function(servicePrice) {
    const tierDiscounts = {
        basic: 0.05,    // 5%
        premium: 0.10,  // 10%
        vip: 0.15,      // 15%
        platinum: 0.20  // 20%
    };
    
    const discountRate = tierDiscounts[this.membershipTier] || 0;
    const savings = servicePrice * discountRate;
    this.totalSavings += savings;
    return this.save();
};

// Instance method to suspend membership
membershipSchema.methods.suspend = function(reason, suspendedBy) {
    this.membershipStatus = 'suspended';
    this.notes = this.notes ? `${this.notes}\nSuspended: ${reason}` : `Suspended: ${reason}`;
    return this.save();
};

// Instance method to reactivate membership
membershipSchema.methods.reactivate = function(reactivatedBy) {
    this.membershipStatus = 'active';
    this.notes = this.notes ? `${this.notes}\nReactivated by ${reactivatedBy}` : `Reactivated by ${reactivatedBy}`;
    return this.save();
};

export const Membership = mongoose.model("Membership", membershipSchema);

