import multer from 'multer';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new ApiError(400, 'Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
};

// Multer configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10 // Maximum 10 files per request
    },
    fileFilter: fileFilter
});

// Single file upload middleware
export const uploadSingle = (fieldName = 'image') => {
    return (req, res, next) => {
        
        const uploadHandler = upload.single(fieldName);
        
        uploadHandler(req, res, async (err) => {
            if (req.file) {
            }
            
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new ApiError(400, 'File too large. Maximum size is 10MB'));
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return next(new ApiError(400, 'Too many files. Maximum is 10 files'));
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return next(new ApiError(400, 'Unexpected field name for file upload'));
                }
                return next(new ApiError(400, err.message));
            } else if (err) {
                return next(err);
            }
            
            // Validate file if present
            if (req.file) {
                try {
                    const { validateImageFile } = await import('../utils/cloudinary.js');
                    validateImageFile(req.file);
                } catch (error) {
                    return next(error);
                }
            }
            
            next();
        });
    };
};

// Multiple files upload middleware
export const uploadMultiple = (fieldName = 'images', maxCount = 10) => {
    return (req, res, next) => {
        const uploadHandler = upload.array(fieldName, maxCount);
        
        uploadHandler(req, res, async (err) => {
            
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new ApiError(400, 'File too large. Maximum size is 10MB'));
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return next(new ApiError(400, `Too many files. Maximum is ${maxCount} files`));
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return next(new ApiError(400, 'Unexpected field name for file upload'));
                }
                return next(new ApiError(400, err.message));
            } else if (err) {
                return next(err);
            }
            
            // Validate files if present
            if (req.files && req.files.length > 0) {
                const { validateImageFile } = await import('../utils/cloudinary.js');
                try {
                    for (const file of req.files) {
                        validateImageFile(file);
                    }
                } catch (error) {
                    return next(error);
                }
            }
            
            next();
        });
    };
};

// Fields upload middleware (for different field names)
export const uploadFields = (fields) => {
    return (req, res, next) => {
        const uploadHandler = upload.fields(fields);
        
        uploadHandler(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new ApiError(400, 'File too large. Maximum size is 10MB'));
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return next(new ApiError(400, 'Too many files uploaded'));
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return next(new ApiError(400, 'Unexpected field name for file upload'));
                }
                return next(new ApiError(400, err.message));
            } else if (err) {
                return next(err);
            }
            
            // Validate files if present
            if (req.files) {
                const { validateImageFile } = await import('../utils/cloudinary.js');
                try {
                    for (const fieldName in req.files) {
                        const files = req.files[fieldName];
                        for (const file of files) {
                            validateImageFile(file);
                        }
                    }
                } catch (error) {
                    return next(error);
                }
            }
            
            next();
        });
    };
};

// Error handling middleware for upload errors
export const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected field name for file upload'
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    next(error);
};

export default upload;

