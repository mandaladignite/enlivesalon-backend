#!/usr/bin/env node

/**
 * Script to seed dummy reviews into the database
 * Usage: node src/scripts/seedDummyReviews.js
 */

import mongoose from 'mongoose';
import Review from '../models/review.model.js';

// Sample reviews data
const sampleReviews = [
  // Hair Services
  {
    name: "Priya Sharma",
    age: "26 years old",
    quote: "Amazing haircut and styling! The stylist understood exactly what I wanted and gave me the perfect look. The salon has a great atmosphere and professional service.",
    rating: 5,
    service: "Hair Cut & Style",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "hair-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Rajesh Kumar",
    age: "32 years old",
    quote: "Excellent hair coloring service! The highlights look natural and the color lasted for months. Highly recommend this salon for hair treatments.",
    rating: 5,
    service: "Hair Color & Highlights",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "hair-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Anita Patel",
    age: "28 years old",
    quote: "The hair spa treatment was incredibly relaxing and my hair feels so soft and healthy now. The staff is very professional and the service is top-notch.",
    rating: 5,
    service: "Hair Spa Treatment",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "hair-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  // Skin Services
  {
    name: "Sneha Reddy",
    age: "24 years old",
    quote: "The HydraFacial treatment was amazing! My skin feels so smooth and glowing. The aesthetician was very knowledgeable and made me feel comfortable throughout the process.",
    rating: 5,
    service: "HydraFacial Treatment",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "skin-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Vikram Singh",
    age: "35 years old",
    quote: "Great chemical peel treatment! My skin looks much clearer and the acne scars have reduced significantly. The staff explained everything clearly and the results are fantastic.",
    rating: 5,
    service: "Chemical Peel",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "skin-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Meera Joshi",
    age: "29 years old",
    quote: "The microdermabrasion treatment was gentle yet effective. My skin feels refreshed and the fine lines have reduced. Will definitely come back for more treatments.",
    rating: 5,
    service: "Microdermabrasion",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "skin-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  // Body Services
  {
    name: "Kavya Nair",
    age: "31 years old",
    quote: "The full body massage was incredibly relaxing and therapeutic. The therapist was skilled and the oils used were of excellent quality. I felt completely rejuvenated after the session.",
    rating: 5,
    service: "Full Body Massage",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "body-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Rohit Agarwal",
    age: "27 years old",
    quote: "Excellent body scrub treatment! My skin feels so smooth and the dead skin has been removed effectively. The therapist was professional and the service was worth every penny.",
    rating: 5,
    service: "Body Scrub Treatment",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "body-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Divya Mehta",
    age: "33 years old",
    quote: "The body wrap treatment was luxurious and relaxing. The ingredients used were natural and my skin feels so soft and hydrated. Highly recommend this treatment!",
    rating: 5,
    service: "Body Wrap Treatment",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "body-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  // Nail Services
  {
    name: "Kavya Nair",
    age: "25 years old",
    quote: "Beautiful gel manicure! The nail art design is stunning and the color lasted for weeks without chipping. The nail technician was very creative and professional.",
    rating: 5,
    service: "Gel Manicure",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "nail-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Rohit Agarwal",
    age: "30 years old",
    quote: "The pedicure and spa treatment was amazing! My feet feel so soft and the nail care was perfect. The spa atmosphere was relaxing and the service was excellent.",
    rating: 5,
    service: "Pedicure & Spa",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "nail-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Divya Mehta",
    age: "26 years old",
    quote: "Incredible nail art design! The technician was very artistic and created exactly what I wanted. The attention to detail was impressive and the final result was beautiful.",
    rating: 5,
    service: "Nail Art Design",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "nail-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  // Mixed Services
  {
    name: "Aisha Khan",
    age: "28 years old",
    quote: "I've tried multiple services here - hair, skin, and nail treatments. Each service exceeded my expectations. The staff is professional, the salon is clean, and the results are always amazing!",
    rating: 5,
    service: "Multiple Services",
    isActive: true,
    isFeatured: true,
    image: {
      public_id: "mixed-review-1",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Neha Gupta",
    age: "34 years old",
    quote: "This salon provides excellent beauty services across all categories. The quality is consistent, the staff is friendly, and the prices are reasonable. I'm a regular customer now!",
    rating: 5,
    service: "General Services",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "mixed-review-2",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  },
  {
    name: "Pooja Sharma",
    age: "29 years old",
    quote: "Outstanding beauty services! Whether it's hair, skin, body, or nail treatments, this salon delivers exceptional results. The ambiance is great and the staff is very professional.",
    rating: 5,
    service: "Beauty Services",
    isActive: true,
    isFeatured: false,
    image: {
      public_id: "mixed-review-3",
      secure_url: "/client.jpg",
      url: "/client.jpg"
    }
  }
];

async function seedReviews() {
  try {
    console.log('🌱 Starting to seed dummy reviews...\n');

    // Try multiple connection strings
    const connectionStrings = [
      'mongodb+srv://mandaladignite_db_user:JC97EXDUg9mkJ4wd@cluster0.qayx2jv.mongodb.net/enlive-salon',
      'mongodb://localhost:27017/beauty-salon',
      'mongodb://127.0.0.1:27017/beauty-salon',
      'mongodb://localhost:27017/salon-db'
    ];

    let connected = false;
    for (const uri of connectionStrings) {
      if (uri) {
        try {
          console.log(`🔗 Trying to connect to: ${uri}`);
          await mongoose.connect(uri);
          console.log('✅ Connected to MongoDB successfully!');
          connected = true;
          break;
        } catch (error) {
          console.log(`❌ Failed to connect to ${uri}`);
          continue;
        }
      }
    }

    if (!connected) {
      throw new Error('Could not connect to MongoDB with any of the provided connection strings');
    }

    // Clear existing reviews
    const existingReviews = await Review.countDocuments();
    console.log(`\n🗑️  Found ${existingReviews} existing reviews. Clearing them...`);
    await Review.deleteMany({});
    console.log('✅ Cleared existing reviews');

    // Insert new reviews
    console.log('\n📝 Inserting new reviews...');
    const insertedReviews = await Review.insertMany(sampleReviews);
    console.log(`✅ Successfully seeded ${insertedReviews.length} reviews!`);

    // Display summary
    console.log('\n📊 Review Summary:');
    console.log('==================');
    console.log(`Total Reviews: ${insertedReviews.length}`);
    
    const activeReviews = insertedReviews.filter(r => r.isActive).length;
    const featuredReviews = insertedReviews.filter(r => r.isFeatured).length;
    console.log(`Active Reviews: ${activeReviews}`);
    console.log(`Featured Reviews: ${featuredReviews}`);

    // Service-wise breakdown
    console.log('\n📋 Service-wise Breakdown:');
    const serviceGroups = insertedReviews.reduce((acc, review) => {
      const service = review.service;
      if (service.includes('Hair')) {
        acc.hair = (acc.hair || 0) + 1;
      } else if (service.includes('Skin') || service.includes('HydraFacial') || service.includes('Chemical') || service.includes('Microdermabrasion')) {
        acc.skin = (acc.skin || 0) + 1;
      } else if (service.includes('Body') || service.includes('Massage') || service.includes('Scrub') || service.includes('Wrap')) {
        acc.body = (acc.body || 0) + 1;
      } else if (service.includes('Nail') || service.includes('Manicure') || service.includes('Pedicure')) {
        acc.nail = (acc.nail || 0) + 1;
      } else {
        acc.mixed = (acc.mixed || 0) + 1;
      }
      return acc;
    }, {});

    Object.entries(serviceGroups).forEach(([category, count]) => {
      console.log(`${category.charAt(0).toUpperCase() + category.slice(1)} Services: ${count} reviews`);
    });

    // Show sample reviews
    console.log('\n🌟 Sample Reviews Added:');
    console.log('========================');
    insertedReviews.slice(0, 3).forEach((review, index) => {
      console.log(`${index + 1}. ${review.name} (${review.age}) - ${review.service}`);
      console.log(`   Rating: ${'⭐'.repeat(review.rating)} (${review.rating}/5)`);
      console.log(`   Featured: ${review.isFeatured ? 'Yes' : 'No'}`);
      console.log(`   Quote: "${review.quote.substring(0, 80)}..."`);
      console.log('');
    });

    console.log('🎉 Dummy reviews seeding completed successfully!');
    console.log('\n💡 You can now:');
    console.log('1. Visit your service pages to see the reviews in action');
    console.log('2. Manage reviews through the admin panel at /admin/reviews');
    console.log('3. Test the review filtering by service category');

  } catch (error) {
    console.error('❌ Error seeding reviews:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seeding function
seedReviews();