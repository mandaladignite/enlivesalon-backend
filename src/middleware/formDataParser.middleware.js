import { ApiError } from '../utils/ApiError.js';

// Middleware to parse FormData arrays and objects
export const parseFormData = (req, res, next) => {
    try {
        // Only process if body exists and contains FormData-like fields
        if (req.body && typeof req.body === 'object') {
            const parsedBody = { ...req.body };
            
            // Parse specialties array
            if (parsedBody.specialties && typeof parsedBody.specialties === 'string') {
                try {
                    parsedBody.specialties = JSON.parse(parsedBody.specialties);
                } catch (e) {
                    // If not JSON, look for array indices
                    const specialtyKeys = Object.keys(req.body)
                        .filter(key => key.startsWith('specialties['))
                        .sort((a, b) => {
                            const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                            const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                            return aIndex - bIndex;
                        });
                    
                    if (specialtyKeys.length > 0) {
                        parsedBody.specialties = specialtyKeys.map(key => req.body[key]);
                    }
                }
            }
            
            // Parse workingDays array
            if (parsedBody.workingDays && typeof parsedBody.workingDays === 'string') {
                try {
                    parsedBody.workingDays = JSON.parse(parsedBody.workingDays);
                } catch (e) {
                    // If not JSON, look for array indices
                    const dayKeys = Object.keys(req.body)
                        .filter(key => key.startsWith('workingDays['))
                        .sort((a, b) => {
                            const aIndex = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
                            const bIndex = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
                            return aIndex - bIndex;
                        });
                    
                    if (dayKeys.length > 0) {
                        parsedBody.workingDays = dayKeys.map(key => req.body[key]);
                    }
                }
            }
            
            // Parse workingHours object
            if (parsedBody.workingHours && typeof parsedBody.workingHours === 'string') {
                try {
                    parsedBody.workingHours = JSON.parse(parsedBody.workingHours);
                } catch (e) {
                    // If not JSON, construct from individual fields
                    parsedBody.workingHours = {
                        start: req.body['workingHours.start'] || parsedBody.workingHours?.start,
                        end: req.body['workingHours.end'] || parsedBody.workingHours?.end
                    };
                }
            }
            
            // Convert string numbers to actual numbers
            if (parsedBody.experience && typeof parsedBody.experience === 'string') {
                parsedBody.experience = parseInt(parsedBody.experience) || 0;
            }
            
            if (parsedBody.rating && typeof parsedBody.rating === 'string') {
                parsedBody.rating = parseFloat(parsedBody.rating) || 0;
            }
            
            // Convert string booleans to actual booleans
            if (parsedBody.availableForHome && typeof parsedBody.availableForHome === 'string') {
                parsedBody.availableForHome = parsedBody.availableForHome === 'true';
            }
            
            if (parsedBody.availableForSalon && typeof parsedBody.availableForSalon === 'string') {
                parsedBody.availableForSalon = parsedBody.availableForSalon === 'true';
            }
            
            // Update the request body with parsed data
            req.body = parsedBody;
        }
        
        next();
    } catch (error) {
        next(new ApiError(400, `FormData parsing error: ${error.message}`));
    }
};

export default parseFormData;
