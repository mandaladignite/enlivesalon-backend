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

