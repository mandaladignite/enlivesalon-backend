import mongoose from 'mongoose';
import Review from '../models/review.model.js';

// Sample review data
const sampleReviews = [
  {
    name: "Sarah Johnson",
    age: "28 years old",
    quote: "The team at this salon is absolutely amazing! They transformed my look completely and made me feel so confident. The attention to detail and professional service is unmatched. I've been coming here for years and they never disappoint.",
    image: {
      public_id: "sample-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    },
    rating: 5,
    isActive: true,
    isFeatured: true,
    service: "Hair Styling"
  },
  {
    name: "Michael Chen",
    age: "35 years old",
    quote: "Exceptional service from start to finish. The stylists are knowledgeable, friendly, and truly care about their craft. The atmosphere is relaxing and the results speak for themselves. Highly recommend to anyone looking for quality beauty services.",
    image: {
      public_id: "sample-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    },
    rating: 5,
    isActive: true,
    isFeatured: true,
    service: "Facial Treatment"
  },
  {
    name: "Emily Rodriguez",
    age: "24 years old",
    quote: "I had my first appointment here and I'm already planning my next visit! The staff made me feel comfortable and the service was outstanding. The salon is clean, modern, and has a great vibe. Definitely worth every penny.",
    image: {
      public_id: "sample-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    },
    rating: 5,
    isActive: true,
    isFeatured: false,
    service: "Manicure & Pedicure"
  }
];

async function seedReviews() {
  try {
    // Try different MongoDB connection strings
    const connectionStrings = [
      process.env.MONGODB_URI,
      'mongodb://localhost:27017/beauty-salon',
      'mongodb://127.0.0.1:27017/beauty-salon',
      'mongodb://localhost:27017/salon-db'
    ].filter(Boolean);
    
    let connected = false;
    for (const uri of connectionStrings) {
      try {
        console.log(`Trying to connect to: ${uri}`);
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
        connected = true;
        break;
      } catch (error) {
        console.log(`Failed to connect to ${uri}: ${error.message}`);
        continue;
      }
    }
    
    if (!connected) {
      console.log('\n❌ Could not connect to MongoDB. Please ensure:');
      console.log('1. MongoDB is running on your system');
      console.log('2. The connection string is correct');
      console.log('3. Environment variables are set properly');
      console.log('\nYou can also add demo reviews manually through the admin interface at /admin/reviews');
      return;
    }

    // Clear existing reviews
    await Review.deleteMany({});
    console.log('Cleared existing reviews');

    // Insert sample reviews
    const reviews = await Review.insertMany(sampleReviews);
    console.log(`Seeded ${reviews.length} reviews successfully`);

    // Display summary
    const totalReviews = await Review.countDocuments();
    const activeReviews = await Review.countDocuments({ isActive: true });
    const featuredReviews = await Review.countDocuments({ isFeatured: true });
    
    console.log('\nReview Summary:');
    console.log(`Total Reviews: ${totalReviews}`);
    console.log(`Active Reviews: ${activeReviews}`);
    console.log(`Featured Reviews: ${featuredReviews}`);

  } catch (error) {
    console.error('Error seeding reviews:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function
seedReviews();