import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  age: {
    type: String,
    required: [true, 'Age is required'],
    trim: true,
    maxlength: [50, 'Age cannot exceed 50 characters']
  },
  quote: {
    type: String,
    required: [true, 'Review quote is required'],
    trim: true,
    maxlength: [500, 'Quote cannot exceed 500 characters']
  },
  image: {
    public_id: {
      type: String,
      required: [true, 'Image public_id is required'],
      trim: true
    },
    secure_url: {
      type: String,
      required: [true, 'Image secure_url is required'],
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    width: {
      type: Number
    },
    height: {
      type: Number
    },
    format: {
      type: String
    },
    bytes: {
      type: Number
    }
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  service: {
    type: String,
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
reviewSchema.index({ isActive: 1, isFeatured: 1 });
reviewSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Review', reviewSchema);
