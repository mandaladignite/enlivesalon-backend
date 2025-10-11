import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
import { DB_NAME, MONGODB_URI } from "../constants.js";

// Load environment variables
dotenv.config();

// Database connection function
const connectToDatabase = async (databaseUrl) => {
    try {
        // Disconnect from any existing connection
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        // Connect to the database
        const conn = await mongoose.connect(databaseUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error("❌ Database connection error:", error.message);
        process.exit(1);
    }
};

// Verify admin user function
const verifyAdminUser = async (email) => {
    try {
        // Find admin user
        const admin = await User.findOne({ email }).select("+password");
        
        if (!admin) {
            console.log(`❌ Admin user with email ${email} not found`);
            return null;
        }

        console.log(`✅ Admin user found:`);
        console.log(`   ID: ${admin._id}`);
        console.log(`   Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Phone: ${admin.phone || 'Not provided'}`);
        console.log(`   Active: ${admin.isActive}`);
        console.log(`   Created: ${admin.createdAt}`);
        console.log(`   Last Login: ${admin.lastLogin || 'Never'}`);

        // Test password verification
        const testPassword = "Enlive@4509";
        const isPasswordValid = await admin.comparePassword(testPassword);
        
        if (isPasswordValid) {
            console.log(`✅ Password verification successful`);
        } else {
            console.log(`❌ Password verification failed`);
        }

        // Test token generation
        try {
            const accessToken = admin.generateAccessToken();
            console.log(`✅ Access token generated successfully`);
            console.log(`   Token length: ${accessToken.length} characters`);
        } catch (error) {
            console.log(`❌ Token generation failed: ${error.message}`);
        }

        return admin;
    } catch (error) {
        console.error("❌ Error verifying admin user:", error.message);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        // Get database URL from command line arguments or environment
        const databaseUrl = process.argv[2] || MONGODB_URI;
        
        console.log("🔍 Starting admin verification process...");
        console.log(`🔗 Database URL: ${databaseUrl}`);

        // Connect to database
        await connectToDatabase(databaseUrl);

        // Verify admin user
        const adminEmail = "enlivesalon@gmail.com";
        console.log(`\n👤 Verifying admin user: ${adminEmail}`);
        
        const admin = await verifyAdminUser(adminEmail);

        if (admin) {
            console.log("\n🎉 Admin verification completed successfully!");
            console.log("🔐 Admin credentials are working correctly");
        } else {
            console.log("\n❌ Admin verification failed!");
        }

    } catch (error) {
        console.error("❌ Admin verification failed:", error.message);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.disconnect();
        console.log("🔌 Database connection closed");
    }
};

// Run the script
main();
