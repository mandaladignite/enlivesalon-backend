# Review Seeding Script

This script adds 15 dummy reviews to your database for testing the review system integration.

## Quick Start

### Option 1: Using npm script (Recommended)
```bash
cd server
npm run seed:reviews
```

### Option 2: Direct execution
```bash
cd server
node src/scripts/seedDummyReviews.js
```

### Option 3: Using the wrapper script
```bash
cd server
node seed-reviews.js
```

## What the Script Does

The script adds **15 diverse reviews** covering all service categories:

### 📊 Review Distribution
- **Hair Services**: 3 reviews (Hair Cut, Hair Color, Hair Spa)
- **Skin Services**: 3 reviews (HydraFacial, Chemical Peel, Microdermabrasion)
- **Body Services**: 3 reviews (Massage, Body Scrub, Body Wrap)
- **Nail Services**: 3 reviews (Gel Manicure, Pedicure, Nail Art)
- **Mixed Services**: 3 reviews (General/Multiple services)

### ⭐ Review Features
- **Ratings**: All reviews are 5-star ratings
- **Featured Reviews**: 8 reviews are marked as featured
- **Active Status**: All reviews are active and will be displayed
- **Service Categories**: Each review is tagged with specific service names
- **Realistic Content**: Reviews include detailed, realistic testimonials

## Sample Reviews Added

### Hair Services
- Priya Sharma - Hair Cut & Style (Featured)
- Rajesh Kumar - Hair Color & Highlights (Featured)
- Anita Patel - Hair Spa Treatment

### Skin Services
- Sneha Reddy - HydraFacial Treatment (Featured)
- Vikram Singh - Chemical Peel (Featured)
- Meera Joshi - Microdermabrasion

### Body Services
- Kavya Nair - Full Body Massage (Featured)
- Rohit Agarwal - Body Scrub Treatment
- Divya Mehta - Body Wrap Treatment

### Nail Services
- Kavya Nair - Gel Manicure (Featured)
- Rohit Agarwal - Pedicure & Spa (Featured)
- Divya Mehta - Nail Art Design

### Mixed Services
- Aisha Khan - Multiple Services (Featured)
- Neha Gupta - General Services
- Pooja Sharma - Beauty Services

## Prerequisites

1. **MongoDB Running**: Ensure MongoDB is running on your system
2. **Database Connection**: The script will try multiple connection strings:
   - `process.env.MONGODB_URI`
   - `mongodb://localhost:27017/beauty-salon`
   - `mongodb://127.0.0.1:27017/beauty-salon`
   - `mongodb://localhost:27017/salon-db`

## Script Behavior

### Default Behavior
- **Clears existing reviews** before adding new ones
- **Adds 15 new reviews** with diverse content
- **Shows detailed summary** of what was added
- **Displays service-wise breakdown**

### Output Example
```
🌱 Starting to seed dummy reviews...

🔗 Trying to connect to: mongodb://localhost:27017/beauty-salon
✅ Connected to MongoDB successfully!

🗑️  Found 0 existing reviews. Clearing them...
✅ Cleared existing reviews

📝 Inserting new reviews...
✅ Successfully seeded 15 reviews!

📊 Review Summary:
==================
Total Reviews: 15
Active Reviews: 15
Featured Reviews: 8

📋 Service-wise Breakdown:
Hair Services: 3 reviews
Skin Services: 3 reviews
Body Services: 3 reviews
Nail Services: 3 reviews

🌟 Sample Reviews Added:
========================
1. Priya Sharma (26 years old) - Hair Cut & Style
   Rating: ⭐⭐⭐⭐⭐ (5/5)
   Featured: Yes
   Quote: "Amazing haircut and styling! The stylist understood exactly what I wanted..."

🎉 Dummy reviews seeding completed successfully!

💡 You can now:
1. Visit your service pages to see the reviews in action
2. Manage reviews through the admin panel at /admin/reviews
3. Test the review filtering by service category

🔌 Disconnected from MongoDB
```

## Testing the Integration

After running the script, you can test the review system:

1. **Visit Service Pages**:
   - `/hair` - Should show hair-related reviews
   - `/skin` - Should show skin-related reviews
   - `/body` - Should show body-related reviews
   - `/nail` - Should show nail-related reviews

2. **Check Admin Panel**:
   - Visit `/admin/reviews` to manage the reviews
   - Toggle featured status
   - Edit review content
   - View review statistics

3. **Test Filtering**:
   - Reviews should be filtered by service category
   - Featured reviews should appear first
   - Only active reviews should be displayed

## Troubleshooting

### Connection Issues
If you get connection errors:
1. Ensure MongoDB is running: `mongodb --version`
2. Check if the database exists
3. Verify connection string in your environment variables

### Permission Issues
If you get permission errors:
1. Ensure you have write access to the database
2. Check MongoDB user permissions
3. Try running with appropriate database credentials

### Script Errors
If the script fails:
1. Check the console output for specific error messages
2. Ensure all dependencies are installed
3. Verify the Review model is properly defined

## Customization

You can modify the script to:
- Add more reviews
- Change review content
- Modify service categories
- Adjust featured/active status
- Add different ratings

Edit `src/scripts/seedDummyReviews.js` to customize the review data.

## Clean Up

To remove all reviews:
```bash
# Connect to MongoDB and run:
db.reviews.deleteMany({})
```

Or use the admin panel to delete reviews individually.
