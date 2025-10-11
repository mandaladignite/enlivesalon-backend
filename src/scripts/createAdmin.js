import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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

        // Connect to the new database
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

// Create admin user function
const createAdminUser = async (adminData) => {
    try {
        const { name, email, password, phone } = adminData;

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log(`⚠️  Admin with email ${email} already exists`);
            
            // Check if it's already an admin
            if (existingAdmin.role === 'admin') {
                console.log(`✅ User is already an admin`);
                return existingAdmin;
            } else {
                // Update role to admin
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log(`✅ Updated user role to admin`);
                return existingAdmin;
            }
        }

        // Create new admin user
        const adminUser = await User.create({
            name,
            email,
            password,
            role: 'admin',
            phone: phone || '',
            isActive: true
        });

        console.log(`✅ Admin user created successfully`);
        return adminUser;
    } catch (error) {
        console.error("❌ Error creating admin user:", error.message);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        // Get database URL from command line arguments or environment
        const databaseUrl = process.argv[2] || MONGODB_URI;
        
        console.log("🚀 Starting admin creation process...");
        console.log(`🔗 Database URL: ${databaseUrl}`);

        // Connect to database
        await connectToDatabase(databaseUrl);

        // Admin data with your specific credentials
        const adminData = {
            name: "Enlive Salon Admin",
            email: "enlivesalon@gmail.com",
            password: "Enlive@4509",
            phone: "9876543210"
        };

        console.log("👤 Creating admin user with the following details:");
        console.log(`   Name: ${adminData.name}`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Phone: ${adminData.phone}`);
        console.log(`   Password: ${adminData.password}`);

        // Create admin user
        const admin = await createAdminUser(adminData);

        // Display created admin info (without password)
        console.log("\n🎉 Admin user details:");
        console.log(`   ID: ${admin._id}`);
        console.log(`   Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Phone: ${admin.phone || 'Not provided'}`);
        console.log(`   Active: ${admin.isActive}`);
        console.log(`   Created: ${admin.createdAt}`);

        console.log("\n✅ Admin creation completed successfully!");
        console.log("🔐 You can now login with:");
        console.log(`   Email: enlivesalon@gmail.com`);
        console.log(`   Password: Enlive@4509`);

    } catch (error) {
        console.error("❌ Admin creation failed:", error.message);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.disconnect();
        console.log("🔌 Database connection closed");
    }
};

// Handle command line usage
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
📖 Admin Creation Script Usage:

node createAdmin.js [database_url]

Options:
  database_url    MongoDB connection string (optional)
                  Default: mongodb://localhost:27017/enlive_db

Examples:
  node createAdmin.js
  node createAdmin.js mongodb://localhost:27017/my_new_db
  node createAdmin.js mongodb+srv://user:pass@cluster.mongodb.net/dbname

Help:
  node createAdmin.js --help
`);
    process.exit(0);
}

// Run the script
main();
