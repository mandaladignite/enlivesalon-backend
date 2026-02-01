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
import reviewRoutes from "./routes/review.route.js"
import offerRoutes from "./routes/offer.route.js"
import heroRoutes from "./routes/hero.route.js"
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

// Security middleware - configure helmet to not interfere with CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.razorpay.com", "https://api.cloudinary.com"],
            frameSrc: ["https://checkout.razorpay.com"],
        },
    },
}))

// Compression middleware
app.use(compression())

// CORS configuration
const allowedOrigins = [
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGIN_ADMIN,
    'https://admin.enlivesalon.com',
    'https://www.enlivesalon.com',
    'https://enlivesalon.com',
    // Local development alternatives
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8000',
    'http://localhost:8001'
].filter(Boolean); // Remove undefined values

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
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`CORS: Allowing origin from allowed list: ${origin}`);
            }
            callback(null, true);
        } else {
            // Also check if it's a subdomain of enlivesalon.com
            if (origin.includes('enlivesalon.com')) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`CORS: Allowing origin from enlivesalon.com domain: ${origin}`);
                }
                callback(null, true);
            } else {
                console.error(`[CORS ERROR] Blocked origin: ${origin}`);
                console.error(`[CORS ERROR] Allowed origins: ${allowedOrigins.join(', ')}`);
                callback(new Error("Not allowed by CORS"));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept', 
        'Origin',
        'Content-Length',
        'X-File-Name',
        'X-File-Size',
        'X-File-Type'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight OPTIONS requests explicitly for all routes
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    
    // Check if origin is allowed
    if (!origin) {
        return res.status(204).end();
    }
    
    // Allow if it's in allowed origins or enlivesalon.com domain
    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.includes('enlivesalon.com') ||
                     (process.env.NODE_ENV === 'development' && origin.includes('localhost'));
    
    if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Content-Length');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400');
    }
    
    res.status(204).end();
});

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
    express.json({limit: "100mb"})(req, res, next);
})

app.use(express.urlencoded({extended: true, limit: "100mb"}))
app.use(express.static("public"))
app.use(cookieParser())

// Security middleware
app.use(securityHeaders)
app.use(sanitizeSearchParams)
app.use(sanitizeStringInputs)
app.use(apiRateLimit)

// Routes with /api prefix
app.use("/api/auth", authRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/stylists", stylistRoutes)
app.use("/api/packages", packageRoutes)
app.use("/api/memberships", membershipRoutes)
app.use("/api/profile", profileRoutes)
app.use("/api/addresses", addressRoutes)
app.use("/api/gallery", galleryRoutes)
app.use("/api/enquiries", enquiryRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/offers", offerRoutes)
app.use("/api/hero", heroRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/health", healthRoutes)

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