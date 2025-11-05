import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from './ApiError.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary

// Validate required environment variables
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && !process.env.CLOUDINARY_URL) {
    console.error('Missing required Cloudinary environment variables:', missingVars);
    console.error('Please set the following environment variables:');
    missingVars.forEach(varName => {
        console.error(`  ${varName}=your_value_here`);
    });
    console.error('Or set CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name');
}

// Prefer individual variables over URL format for better compatibility
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
} else if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
        secure: true
    });
} else {
    console.error('Cloudinary configuration failed: Missing required environment variables');
}

// Upload image to Cloudinary
export const uploadToCloudinary = async (file, options = {}) => {
    try {
        // Validate Cloudinary configuration first
        validateCloudinaryConfig();
        
        const {
            folder = 'salon-gallery',
            category = 'general',
            transformation = []
        } = options;

        const uploadOptions = {
            folder: `${folder}/${category}`,
            resource_type: 'image',
            transformation: [
                { quality: 'auto' },
                ...transformation
            ],
            tags: [category, 'salon-gallery'],
            context: { category: category },
            ...options
        };

        // Handle both file paths and buffers
        let uploadSource;
        if (file.buffer) {
            // Memory storage (multer buffer)
            uploadSource = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        } else if (file.path) {
            // Disk storage (file path)
            uploadSource = file.path;
        } else {
            throw new Error('Invalid file object: must have either buffer or path');
        }

        
        const result = await cloudinary.uploader.upload(uploadSource, uploadOptions);
        
        
        return {
            public_id: result.public_id,
            secure_url: result.secure_url,
            url: result.url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            created_at: result.created_at,
            version: result.version,
            signature: result.signature
        };
    } catch (error) {
        console.error('Cloudinary upload error details:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name,
            status: error.status,
            statusCode: error.statusCode
        });
        
        // Provide more specific error messages
        let errorMessage = 'Cloudinary upload failed';
        if (error.http_code === 401) {
            errorMessage = 'Cloudinary authentication failed. Please check your API credentials.';
        } else if (error.http_code === 400) {
            errorMessage = 'Invalid upload request. Please check your file format and size.';
        } else if (error.http_code === 403) {
            errorMessage = 'Cloudinary access forbidden. Please check your account permissions.';
        } else if (error.http_code === 404) {
            errorMessage = 'Cloudinary service not found. Please check your configuration.';
        } else if (error.http_code >= 500) {
            errorMessage = 'Cloudinary server error. Please try again later.';
        } else if (error.message) {
            errorMessage = `Cloudinary upload failed: ${error.message}`;
        }
        
        throw new ApiError(500, errorMessage);
    }
};

// Upload multiple images to Cloudinary
export const uploadMultipleToCloudinary = async (files, options = {}) => {
    try {
        const uploadPromises = files.map(file => uploadToCloudinary(file, options));
        const results = await Promise.all(uploadPromises);
        return results;
    } catch (error) {
        throw new ApiError(500, `Multiple upload failed: ${error.message}`);
    }
};

// Delete image from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        throw new ApiError(500, `Cloudinary delete failed: ${error.message}`);
    }
};

// Delete multiple images from Cloudinary
export const deleteMultipleFromCloudinary = async (publicIds) => {
    try {
        const result = await cloudinary.api.delete_resources(publicIds);
        return result;
    } catch (error) {
        throw new ApiError(500, `Multiple delete failed: ${error.message}`);
    }
};

// Generate image transformations
export const generateImageTransformations = (publicId, transformations = {}) => {
    const {
        width,
        height,
        crop = 'fill',
        gravity = 'auto',
        quality = 'auto',
        format = 'auto'
    } = transformations;

    const transformOptions = {
        width: width || 'auto',
        height: height || 'auto',
        crop,
        gravity,
        quality,
        format,
        fetch_format: 'auto'
    };

    return cloudinary.url(publicId, {
        transformation: [transformOptions]
    });
};

// Get image details from Cloudinary
export const getImageDetails = async (publicId) => {
    try {
        const result = await cloudinary.api.resource(publicId);
        return result;
    } catch (error) {
        throw new ApiError(404, `Image not found: ${error.message}`);
    }
};

// Search images in Cloudinary
export const searchImages = async (query = {}) => {
    try {
        const {
            expression = 'resource_type:image',
            max_results = 50,
            next_cursor = null,
            sort_by = 'created_at',
            sort_direction = 'desc'
        } = query;

        const result = await cloudinary.search
            .expression(expression)
            .max_results(max_results)
            .next_cursor(next_cursor)
            .sort_by(sort_by, sort_direction)
            .execute();

        return result;
    } catch (error) {
        throw new ApiError(500, `Cloudinary search failed: ${error.message}`);
    }
};

// Create image collage
export const createCollage = async (publicIds, options = {}) => {
    try {
        const {
            width = 800,
            height = 600,
            columns = 2,
            rows = 2,
            spacing = 10
        } = options;

        const collageOptions = {
            width,
            height,
            columns,
            rows,
            spacing,
            background: 'white'
        };

        const result = await cloudinary.image(publicIds.join(','), {
            transformation: [
                { crop: 'fill', width: width / columns, height: height / rows },
                { flags: 'layer_apply' }
            ]
        });

        return result;
    } catch (error) {
        throw new ApiError(500, `Collage creation failed: ${error.message}`);
    }
};

// Generate responsive image URLs
export const generateResponsiveUrls = (publicId, baseWidth = 800) => {
    const sizes = [320, 640, 800, 1200, 1600];
    
    return sizes.map(size => ({
        width: size,
        url: cloudinary.url(publicId, {
            transformation: [
                { width: size, height: Math.round(size * 0.75), crop: 'fill', quality: 'auto' }
            ]
        })
    }));
};

// Validate Cloudinary configuration
export const validateCloudinaryConfig = () => {
    const hasUrl = !!process.env.CLOUDINARY_URL;
    const hasIndividual = !!(process.env.CLOUDINARY_CLOUD_NAME && 
                            process.env.CLOUDINARY_API_KEY && 
                            process.env.CLOUDINARY_API_SECRET);
    
    if (!hasUrl && !hasIndividual) {
        throw new ApiError(500, 'Cloudinary configuration is missing. Please set up your environment variables.');
    }
    
    return true;
};

// Validate image file
export const validateImageFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 20 * 1024 * 1024; // 20MB (increased for hero banner images)

    if (!file) {
        throw new ApiError(400, 'No file provided');
    }

    if (!allowedTypes.includes(file.mimetype)) {
        throw new ApiError(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
    }

    if (file.size > maxSize) {
        throw new ApiError(400, 'File size too large. Maximum size is 20MB');
    }

    return true;
};

// Get Cloudinary usage statistics
export const getCloudinaryUsage = async () => {
    try {
        const result = await cloudinary.api.usage();
        return result;
    } catch (error) {
        throw new ApiError(500, `Failed to get usage statistics: ${error.message}`);
    }
};

export default cloudinary;