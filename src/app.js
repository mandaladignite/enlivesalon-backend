import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import compression from "compression"
import helmet from "helmet"
import authRoutes from "./routes/auth.route.js"
import appointmentRoutes from "./routes/appointment.route.js"
import serviceRoutes from "./routes/service.route.js"
import stylistRoutes from "./routes/stylist.route.js"
import packageRoutes from "./routes/package.route.js"
import membershipRoutes from "./routes/membership.route.js"
import profileRoutes from "./routes/profile.route.js"
import addressRoutes from "./routes/address.route.js"
import galleryRoutes from "./routes/gallery.route.js"
import enquiryRoutes from "./routes/enquiry.route.js"
import adminRoutes from "./routes/admin.route.js"
import healthRoutes from "./routes/health.route.js"
import { errorHandler } from "./middleware/errorHandler.middleware.js"
import { initializeHealthChecks } from "./utils/healthCheck.js"
import { 
    securityHeaders, 
    sanitizeSearchParams, 
    sanitizeStringInputs, 
    authRateLimit, 
    apiRateLimit 
} from "./middleware/security.middleware.js"

const app = express()

// Trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())

// Compression middleware
app.use(compression())

// CORS configuration
const allowedOrigins = [
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGIN_ALT, // Alternative production domain
    "http://localhost:3000", // Local development
    "http://localhost:3001", // Alternative local development
    "http://127.0.0.1:3000", // Local development alternative
    "http://127.0.0.1:3001", // Local development alternative
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In development, be more permissive
        if (process.env.NODE_ENV === 'development') {
            // Allow any localhost origin in development
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return callback(null, true);
            }
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin}`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle JSON parsing for non-file upload routes
app.use((req, res, next) => {
    const contentType = req.headers['content-type'];
    
    // Skip JSON parsing for multipart/form-data requests (file uploads)
    if (contentType && contentType.includes('multipart/form-data')) {
        return next();
    }
    
    // Skip JSON parsing for specific file upload routes
    if (req.path.startsWith('/gallery/upload')) {
        return next();
    }
    
    // Apply JSON parsing for other routes
    express.json({limit: "50mb"})(req, res, next);
})

app.use(express.urlencoded({extended: true, limit: "50mb"}))
app.use(express.static("public"))
app.use(cookieParser())

// Security middleware
app.use(securityHeaders)
app.use(sanitizeSearchParams)
app.use(sanitizeStringInputs)
app.use(apiRateLimit)

// Routes
app.use("/auth", authRoutes)
app.use("/appointments", appointmentRoutes)
app.use("/services", serviceRoutes)
app.use("/stylists", stylistRoutes)
app.use("/packages", packageRoutes)
app.use("/memberships", membershipRoutes)
app.use("/profile", profileRoutes)
app.use("/addresses", addressRoutes)
app.use("/gallery", galleryRoutes)
app.use("/enquiries", enquiryRoutes)
app.use("/admin", adminRoutes)
app.use("/api", healthRoutes)

// Initialize health checks
initializeHealthChecks()

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    })
})

// Error handler
app.use(errorHandler)

export {app}