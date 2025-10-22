import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },
    label: {
        type: String,
        required: [true, "Address label is required"],
        trim: true,
        maxLength: [50, "Label cannot exceed 50 characters"]
    },
    street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
        maxLength: [200, "Street address cannot exceed 200 characters"]
    },
    city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
        maxLength: [50, "City name cannot exceed 50 characters"]
    },
    state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
        maxLength: [50, "State name cannot exceed 50 characters"]
    },
    pincode: {
        type: String,
        required: [true, "Pincode is required"],
        trim: true,
        match: [/^[1-9][0-9]{5}$/, "Please enter a valid 6-digit pincode"]
    },
    country: {
        type: String,
        default: "India",
        trim: true,
        maxLength: [50, "Country name cannot exceed 50 characters"]
    },
    landmark: {
        type: String,
        trim: true,
        maxLength: [100, "Landmark cannot exceed 100 characters"]
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    addressType: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home"
    },
    coordinates: {
        latitude: {
            type: Number,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            min: -180,
            max: 180
        }
    },
    contactNumber: {
        type: String,
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid contact number"]
    },
    instructions: {
        type: String,
        trim: true,
        maxLength: [200, "Instructions cannot exceed 200 characters"]
    }
}, {
    timestamps: true
});

// Indexes for better query performance
addressSchema.index({ userId: 1, isActive: 1 });
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ pincode: 1 });
addressSchema.index({ city: 1, state: 1 });

// Virtual for formatted address
addressSchema.virtual('formattedAddress').get(function() {
    const parts = [
        this.street,
        this.landmark ? `Near ${this.landmark}` : null,
        this.city,
        this.state,
        this.pincode,
        this.country
    ].filter(Boolean);
    
    return parts.join(', ');
});

// Virtual for short address (city, state, pincode)
addressSchema.virtual('shortAddress').get(function() {
    return `${this.city}, ${this.state} - ${this.pincode}`;
});

// Ensure virtual fields are serialized
addressSchema.set('toJSON', { virtuals: true });
addressSchema.set('toObject', { virtuals: true });

// Pre-save middleware to handle default address
addressSchema.pre('save', async function(next) {
    // If this address is being set as default, unset other default addresses for this user
    if (this.isDefault && this.isModified('isDefault')) {
        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { isDefault: false }
        );
    }
    
    // If this is the first address for the user, make it default
    if (this.isNew) {
        const addressCount = await this.constructor.countDocuments({ userId: this.userId });
        if (addressCount === 0) {
            this.isDefault = true;
        }
    }
    
    next();
});

// Static method to get user's addresses
addressSchema.statics.getUserAddresses = function(userId, includeInactive = false) {
    const query = { userId };
    if (!includeInactive) {
        query.isActive = true;
    }
    
    return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

// Static method to get user's default address
addressSchema.statics.getUserDefaultAddress = function(userId) {
    return this.findOne({ userId, isDefault: true, isActive: true });
};

// Static method to set default address
addressSchema.statics.setDefaultAddress = async function(userId, addressId) {
    // First, unset all default addresses for the user
    await this.updateMany({ userId }, { isDefault: false });
    
    // Then set the specified address as default
    return this.findOneAndUpdate(
        { _id: addressId, userId },
        { isDefault: true },
        { new: true }
    );
};

// Static method to get addresses by location
addressSchema.statics.getAddressesByLocation = function(city, state, pincode) {
    const query = { isActive: true };
    
    if (city) query.city = new RegExp(city, 'i');
    if (state) query.state = new RegExp(state, 'i');
    if (pincode) query.pincode = pincode;
    
    return this.find(query).populate('userId', 'name email phone');
};

// Instance method to check if address is valid
addressSchema.methods.isValid = function() {
    return this.isActive && this.street && this.city && this.state && this.pincode;
};

// Instance method to get address summary
addressSchema.methods.getSummary = function() {
    return {
        id: this._id,
        label: this.label,
        shortAddress: this.shortAddress,
        isDefault: this.isDefault,
        addressType: this.addressType
    };
};

// Instance method to update address
addressSchema.methods.updateAddress = function(updateData) {
    Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && this.schema.paths[key]) {
            this[key] = updateData[key];
        }
    });
    return this.save();
};

export const Address = mongoose.model("Address", addressSchema);

