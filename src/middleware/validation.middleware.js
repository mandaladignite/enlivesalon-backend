import { validationResult, body } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value,
            location: error.location
        }));
        
        
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errorMessages
        });
    }
    
    next();
};

// Review validation rules
export const validateReview = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    
    body('age')
        .trim()
        .notEmpty()
        .withMessage('Age is required')
        .isLength({ max: 50 })
        .withMessage('Age cannot exceed 50 characters'),
    
    body('quote')
        .trim()
        .notEmpty()
        .withMessage('Review quote is required')
        .isLength({ max: 500 })
        .withMessage('Quote cannot exceed 500 characters'),
    
    // Image validation is handled by upload middleware
    // No need to validate image URL since we're using file upload
    
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),
    
    body('service')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Service name cannot exceed 100 characters'),
    
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    
    body('isFeatured')
        .optional()
        .isBoolean()
        .withMessage('isFeatured must be a boolean'),
    
    validate
];

