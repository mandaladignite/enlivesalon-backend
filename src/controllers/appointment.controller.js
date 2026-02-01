import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model.js";
import { Service } from "../models/service.model.js";
import { Stylist } from "../models/stylist.model.js";
import { User } from "../models/user.model.js";
import { Offer } from "../models/offer.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { retryDatabaseOperation } from "../utils/retryHandler.js";
import { logger } from "../utils/logger.js";

// Create a new appointment with enhanced error handling and validation
export const createAppointment = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const { 
        serviceId, 
        stylistId, 
        date, 
        timeSlot, 
        location, 
        notes, 
        address, 
        specialInstructions,
        offerCode
    } = req.body;
    const userId = req.user._id;

    // Log booking attempt
    logger.logBookingAttempt(userId, {
        serviceId,
        stylistId,
        date,
        timeSlot,
        location
    }, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Enhanced input validation
    const validationErrors = [];
    
    if (!serviceId) validationErrors.push({ field: 'serviceId', message: 'Service ID is required' });
    if (!date) validationErrors.push({ field: 'date', message: 'Date is required' });
    if (!timeSlot) validationErrors.push({ field: 'timeSlot', message: 'Time slot is required' });
    if (!location) validationErrors.push({ field: 'location', message: 'Location is required' });
    
    // Validate date format and future date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
        validationErrors.push({ field: 'date', message: 'Invalid date format' });
    } else if (appointmentDate <= new Date()) {
        validationErrors.push({ field: 'date', message: 'Appointment date must be in the future' });
    }
    
    // Validate time slot format
    const timeSlotRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeSlotRegex.test(timeSlot)) {
        validationErrors.push({ field: 'timeSlot', message: 'Invalid time slot format (HH:MM)' });
    }
    
    // Validate location
    if (!['home', 'salon'].includes(location)) {
        validationErrors.push({ field: 'location', message: 'Location must be either home or salon' });
    }
    
    // Validate address for home appointments
    if (location === 'home') {
        if (!address || !address.street || !address.city || !address.state) {
            validationErrors.push({ field: 'address', message: 'Complete address is required for home appointments' });
        }
    }
    
    if (validationErrors.length > 0) {
        throw new ApiError(400, "Validation failed", validationErrors);
    }

    // Use database transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Validate service exists and is active
        const service = await Service.findById(serviceId).session(session);
        if (!service) {
            throw new ApiError(404, "Service not found");
        }
        if (!service.isActive) {
            throw new ApiError(400, "Service is currently inactive");
        }

        // Validate location availability for service
        if (location === "home" && !service.availableAtHome) {
            throw new ApiError(400, "This service is not available at home");
        }
        if (location === "salon" && !service.availableAtSalon) {
            throw new ApiError(400, "This service is not available at salon");
        }

        // If stylist is provided, validate stylist
        let stylist = null;
        if (stylistId) {
            stylist = await Stylist.findById(stylistId).session(session);
            if (!stylist) {
                throw new ApiError(404, "Stylist not found");
            }
            if (!stylist.isActive) {
                throw new ApiError(400, "Stylist is currently inactive");
            }

            // Check if stylist is available for the location
            if (location === "home" && !stylist.availableForHome) {
                throw new ApiError(400, "This stylist is not available for home appointments");
            }
            if (location === "salon" && !stylist.availableForSalon) {
                throw new ApiError(400, "This stylist is not available for salon appointments");
            }

            // Check if stylist works on the appointment day
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = days[appointmentDate.getDay()];
            if (!stylist.workingDays.includes(dayOfWeek)) {
                throw new ApiError(400, "Stylist is not available on this day");
            }
            
            // Check if appointment time is within stylist's working hours
            if (timeSlot < stylist.workingHours.start || timeSlot > stylist.workingHours.end) {
                throw new ApiError(400, "Appointment time is outside stylist working hours");
            }

            // Check for existing appointment at the same time with retry mechanism
            const maxRetries = 3;
            let retryCount = 0;
            let existingAppointment = null;
            
            while (retryCount < maxRetries) {
                existingAppointment = await Appointment.findOne({
                    stylistId,
                    date: appointmentDate,
                    timeSlot,
                    status: { $in: ["pending", "confirmed", "in_progress"] }
                }).session(session);

                if (existingAppointment) {
                    throw new ApiError(409, "Stylist is already booked at this time. Please choose a different time slot.");
                }
                
                // Small delay to handle race conditions
                if (retryCount < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                retryCount++;
            }
        }

        // Check for user's existing appointment at the same time
        const userExistingAppointment = await Appointment.findOne({
            userId,
            date: appointmentDate,
            timeSlot,
            status: { $in: ["pending", "confirmed", "in_progress"] }
        }).session(session);

        if (userExistingAppointment) {
            throw new ApiError(409, "You already have an appointment at this time. Please choose a different time slot.");
        }

        // Calculate total price with discount handling
        let totalPrice = service.price;
        
        // Check if discount is active
        if (service.discount && service.discount.isActive && service.discount.percentage > 0) {
            const now = new Date();
            const validFrom = service.discount.validFrom ? new Date(service.discount.validFrom) : null;
            const validUntil = service.discount.validUntil ? new Date(service.discount.validUntil) : null;
            
            // Check if discount is within valid date range
            const isDiscountValid = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
            
            if (isDiscountValid) {
                const discountAmount = (service.price * service.discount.percentage) / 100;
                totalPrice = Math.max(0, service.price - discountAmount);
            }
        }

        // Apply offer code discount if provided
        let appliedOffer = null;
        let offerDiscountAmount = 0;
        
        if (offerCode) {
            // Find and validate offer
            const offer = await Offer.findOne({ code: offerCode.toUpperCase() }).session(session);
            
            if (!offer) {
                throw new ApiError(400, "Invalid offer code");
            }

            // Check if offer is valid
            if (!offer.isValid) {
                throw new ApiError(400, "Offer is not currently valid");
            }

            // Validate offer can be applied
            const serviceIds = [serviceId];
            const category = service.category;
            const validation = offer.canBeApplied(totalPrice, serviceIds, category);
            
            if (!validation.canApply) {
                throw new ApiError(400, validation.reason || "Offer cannot be applied to this booking");
            }

            // Calculate offer discount
            offerDiscountAmount = offer.calculateDiscount(totalPrice);
            totalPrice = Math.max(0, totalPrice - offerDiscountAmount);
            
            appliedOffer = offer;

            // Increment offer usage count
            offer.usedCount += 1;
            await offer.save({ session });
        }
        
        if (totalPrice < 0) {
            throw new ApiError(400, "Invalid service price");
        }

        // Create appointment with enhanced data
        const appointmentData = {
            userId,
            serviceId,
            stylistId: stylistId || null,
            date: appointmentDate,
            timeSlot,
            location,
            notes: notes?.trim() || '',
            specialInstructions: specialInstructions?.trim() || '',
            address: location === "home" ? address : undefined,
            totalPrice,
            estimatedDuration: service.duration,
            offerCode: appliedOffer ? appliedOffer.code : undefined,
            offerDiscount: offerDiscountAmount > 0 ? offerDiscountAmount : undefined
        };

        const appointment = await Appointment.create([appointmentData], { session });
        const createdAppointment = appointment[0];

        // Populate the appointment with service and stylist details
        await createdAppointment.populate([
            { path: "serviceId", select: "name description duration price category" },
            { path: "stylistId", select: "name specialties rating" },
            { path: "userId", select: "name phone email" }
        ]);

        // Commit transaction
        await session.commitTransaction();

        // Log successful booking
        const duration = Date.now() - startTime;
        logger.logBookingSuccess(userId, createdAppointment._id, createdAppointment.bookingReference, {
            duration,
            serviceId,
            stylistId,
            location
        });

        // Log performance
        logger.logPerformance('createAppointment', duration, 2000);


        res.status(201).json(
            new ApiResponse(201, createdAppointment, "Appointment created successfully")
        );

    } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        
        // Log booking failure
        const duration = Date.now() - startTime;
        logger.logBookingFailure(userId, error, {
            serviceId,
            stylistId,
            date,
            timeSlot,
            location
        }, {
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Log specific conflict types
        if (error.message.includes('already booked') || error.message.includes('conflict')) {
            logger.logBookingConflict(userId, 'time_slot_conflict', {
                serviceId,
                stylistId,
                date,
                timeSlot
            });
        }

        throw error;
    } finally {
        session.endSession();
    }
});

// Get user's appointments
export const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status, page = 1, limit = 10, sortBy = "date", sortOrder = "desc" } = req.query;

    const query = { userId };
    if (status) {
        query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const appointments = await Appointment.find(query)
        .populate("serviceId", "name description duration price category")
        .populate("stylistId", "name specialties rating")
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            appointments,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalAppointments: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "User appointments retrieved successfully")
    );
});

// Get all appointments (admin only)
export const getAllAppointments = asyncHandler(async (req, res) => {
    const { status, location, stylistId, date, page = 1, limit = 10, sortBy = "date", sortOrder = "desc" } = req.query;

    const query = {};
    if (status) query.status = status;
    if (location) query.location = location;
    if (stylistId) query.stylistId = stylistId;
    if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        query.date = { $gte: startDate, $lt: endDate };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const appointments = await Appointment.find(query)
        .populate("userId", "name email phone")
        .populate("serviceId", "name description duration price category")
        .populate("stylistId", "name specialties rating")
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            appointments,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalAppointments: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "All appointments retrieved successfully")
    );
});

// Get single appointment
export const getAppointment = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = { _id: appointmentId };
    
    // If not admin, only allow access to own appointments
    if (userRole !== "admin") {
        query.userId = userId;
    }

    const appointment = await Appointment.findOne(query)
        .populate("userId", "name email phone")
        .populate("serviceId", "name description duration price category")
        .populate("stylistId", "name specialties rating");

    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    res.status(200).json(
        new ApiResponse(200, appointment, "Appointment retrieved successfully")
    );
});

// Update appointment
export const updateAppointment = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { serviceId, stylistId, date, timeSlot, location, notes, address, status } = req.body;

    const query = { _id: appointmentId };
    
    // If not admin, only allow access to own appointments
    if (userRole !== "admin") {
        query.userId = userId;
    }

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    // Check if appointment can be updated
    if (appointment.status === "completed" || appointment.status === "cancelled") {
        throw new ApiError(400, "Cannot update completed or cancelled appointments");
    }

    // If updating date/time, check for conflicts
    if (date || timeSlot) {
        const newDate = date ? new Date(date) : appointment.date;
        const newTimeSlot = timeSlot || appointment.timeSlot;

        // Check for stylist conflicts
        if (stylistId || appointment.stylistId) {
            const checkStylistId = stylistId || appointment.stylistId;
            const existingAppointment = await Appointment.findOne({
                _id: { $ne: appointmentId },
                stylistId: checkStylistId,
                date: newDate,
                timeSlot: newTimeSlot,
                status: { $in: ["pending", "confirmed", "in_progress"] }
            });

            if (existingAppointment) {
                throw new ApiError(400, "Stylist is already booked at this time");
            }
        }

        // Check for user conflicts
        const userExistingAppointment = await Appointment.findOne({
            _id: { $ne: appointmentId },
            userId: appointment.userId,
            date: newDate,
            timeSlot: newTimeSlot,
            status: { $in: ["pending", "confirmed", "in_progress"] }
        });

        if (userExistingAppointment) {
            throw new ApiError(400, "You already have an appointment at this time");
        }
    }

    // Update appointment
    const updateData = {};
    if (serviceId) updateData.serviceId = serviceId;
    if (stylistId !== undefined) updateData.stylistId = stylistId;
    if (date) updateData.date = new Date(date);
    if (timeSlot) updateData.timeSlot = timeSlot;
    if (location) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;
    if (address !== undefined) updateData.address = address;
    if (status && userRole === "admin") updateData.status = status;

    const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        updateData,
        { new: true, runValidators: true }
    ).populate([
        { path: "userId", select: "name email phone" },
        { path: "serviceId", select: "name description duration price category" },
        { path: "stylistId", select: "name specialties rating" }
    ]);

    res.status(200).json(
        new ApiResponse(200, updatedAppointment, "Appointment updated successfully")
    );
});

// Cancel appointment
export const cancelAppointment = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { cancellationReason } = req.body;

    const query = { _id: appointmentId };
    
    // If not admin, only allow access to own appointments
    if (userRole !== "admin") {
        query.userId = userId;
    }

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    // Check if appointment can be cancelled
    if (appointment.status === "cancelled") {
        throw new ApiError(400, "Appointment is already cancelled");
    }

    if (appointment.status === "completed") {
        throw new ApiError(400, "Cannot cancel completed appointments");
    }

    // Check if appointment can be cancelled (at least 2 hours before)
    const appointmentDateTime = new Date(`${appointment.date.toDateString()} ${appointment.timeSlot}`);
    const twoHoursBefore = new Date(appointmentDateTime.getTime() - (2 * 60 * 60 * 1000));
    
    if (new Date() > twoHoursBefore && userRole !== "admin") {
        throw new ApiError(400, "Appointment cannot be cancelled less than 2 hours before the scheduled time");
    }

    // Update appointment status
    appointment.status = "cancelled";
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = userId;

    await appointment.save();

    await appointment.populate([
        { path: "serviceId", select: "name" },
        { path: "userId", select: "name phone" }
    ]);


    res.status(200).json(
        new ApiResponse(200, appointment, "Appointment cancelled successfully")
    );
});

// Get available time slots for a stylist on a specific date
export const getAvailableTimeSlots = asyncHandler(async (req, res) => {
    const { stylistId, date } = req.query;

    if (!stylistId || !date) {
        throw new ApiError(400, "Stylist ID and date are required");
    }

    const stylist = await Stylist.findById(stylistId);
    if (!stylist || !stylist.isActive) {
        throw new ApiError(404, "Stylist not found or inactive");
    }

    const appointmentDate = new Date(date);
    
    // Validate date
    if (isNaN(appointmentDate.getTime())) {
        throw new ApiError(400, "Invalid date format");
    }
    
    
    const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (!stylist.workingDays.includes(dayOfWeek)) {
        return res.status(200).json(
            new ApiResponse(200, { availableSlots: [] }, "Stylist is not available on this day")
        );
    }

    // Get existing appointments for the date
    const existingAppointments = await Appointment.find({
        stylistId,
        date: appointmentDate,
        status: { $in: ["pending", "confirmed", "in_progress"] }
    }).select("timeSlot");

    const bookedSlots = existingAppointments.map(apt => apt.timeSlot);

    // Generate available time slots (30-minute intervals)
    const availableSlots = [];
    const startTime = stylist.workingHours.start;
    const endTime = stylist.workingHours.end;

    // Validate working hours format
    if (!startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) {
        throw new ApiError(400, "Invalid stylist working hours format");
    }

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    // Validate parsed hours
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
        throw new ApiError(400, "Invalid stylist working hours");
    }

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        const timeSlot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        
        if (!bookedSlots.includes(timeSlot)) {
            availableSlots.push(timeSlot);
        }
    }

    res.status(200).json(
        new ApiResponse(200, { availableSlots }, "Available time slots retrieved successfully")
    );
});

// Get available dates for a stylist
export const getAvailableDates = asyncHandler(async (req, res) => {
    const { stylistId } = req.query;

    if (!stylistId) {
        throw new ApiError(400, "Stylist ID is required");
    }

    const stylist = await Stylist.findById(stylistId);
    if (!stylist || !stylist.isActive) {
        throw new ApiError(404, "Stylist not found or inactive");
    }

    // Get working days for the stylist
    const workingDays = stylist.workingDays;
    
    // Generate available dates for the next 30 days
    const availableDates = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let date = new Date(today); date <= maxDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = days[date.getDay()];
        
        // Check if stylist works on this day
        if (workingDays.includes(dayOfWeek)) {
            // Check if there are any available time slots for this date
            const existingAppointments = await Appointment.find({
                stylistId,
                date: new Date(date),
                status: { $in: ["pending", "confirmed", "in_progress"] }
            }).select("timeSlot");

            const bookedSlots = existingAppointments.map(apt => apt.timeSlot);
            
            // Generate all possible time slots for this date
            const startTime = stylist.workingHours.start;
            const endTime = stylist.workingHours.end;
            
            if (startTime && endTime && startTime.includes(':') && endTime.includes(':')) {
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);
                
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                
                let availableSlotsCount = 0;
                for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
                    const hour = Math.floor(minutes / 60);
                    const min = minutes % 60;
                    const timeSlot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                    
                    if (!bookedSlots.includes(timeSlot)) {
                        availableSlotsCount++;
                    }
                }
                
                // Only include dates that have at least one available slot
                if (availableSlotsCount > 0) {
                    availableDates.push({
                        date: date.toISOString().split('T')[0],
                        availableSlots: availableSlotsCount,
                        dayOfWeek: dayOfWeek
                    });
                }
            }
        }
    }

    res.status(200).json(
        new ApiResponse(200, { availableDates }, "Available dates retrieved successfully")
    );
});

// Get appointment statistics (admin only)
export const getAppointmentStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate && endDate) {
        query.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const stats = await Appointment.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalRevenue: { $sum: "$totalPrice" }
            }
        }
    ]);

    const totalAppointments = await Appointment.countDocuments(query);
    const totalRevenue = await Appointment.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            stats,
            totalAppointments,
            totalRevenue: totalRevenue[0]?.total || 0
        }, "Appointment statistics retrieved successfully")
    );
});

// Reschedule appointment
export const rescheduleAppointment = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { newDate, newTimeSlot, reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = { _id: appointmentId };
    
    // If not admin, only allow access to own appointments
    if (userRole !== "admin") {
        query.userId = userId;
    }

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    // Check if appointment can be rescheduled
    if (appointment.status === "completed" || appointment.status === "cancelled") {
        throw new ApiError(400, "Cannot reschedule completed or cancelled appointments");
    }

    // Check for conflicts with new date/time
    if (appointment.stylistId) {
        const existingAppointment = await Appointment.findOne({
            _id: { $ne: appointmentId },
            stylistId: appointment.stylistId,
            date: new Date(newDate),
            timeSlot: newTimeSlot,
            status: { $in: ["pending", "confirmed", "in_progress"] }
        });

        if (existingAppointment) {
            throw new ApiError(400, "Stylist is already booked at this time");
        }
    }

    // Check for user conflicts
    const userExistingAppointment = await Appointment.findOne({
        _id: { $ne: appointmentId },
        userId: appointment.userId,
        date: new Date(newDate),
        timeSlot: newTimeSlot,
        status: { $in: ["pending", "confirmed", "in_progress"] }
    });

    if (userExistingAppointment) {
        throw new ApiError(400, "You already have an appointment at this time");
    }

    // Store old appointment details
    const oldDate = appointment.date;
    const oldTimeSlot = appointment.timeSlot;

    // Update appointment
    appointment.date = new Date(newDate);
    appointment.timeSlot = newTimeSlot;
    appointment.status = "rescheduled";
    appointment.rescheduledFrom = {
        date: oldDate,
        timeSlot: oldTimeSlot,
        rescheduledAt: new Date(),
        rescheduledBy: userId
    };

    // Add to status history
    appointment.statusHistory.push({
        status: "rescheduled",
        changedAt: new Date(),
        changedBy: userId,
        reason: reason || "Appointment rescheduled"
    });

    await appointment.save();

    // Populate for response
    await appointment.populate([
        { path: "userId", select: "name email phone" },
        { path: "serviceId", select: "name description duration price category" },
        { path: "stylistId", select: "name specialties rating" }
    ]);

    res.status(200).json(
        new ApiResponse(200, appointment, "Appointment rescheduled successfully")
    );
});

// Update appointment status (admin only)
export const updateAppointmentStatus = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    // Validate status transition
    const validTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["in_progress", "cancelled", "no_show"],
        in_progress: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
        no_show: [],
        rescheduled: ["confirmed", "cancelled"]
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
        throw new ApiError(400, `Cannot change status from ${appointment.status} to ${status}`);
    }

    // Update appointment
    appointment.status = status;
    appointment.statusHistory.push({
        status: status,
        changedAt: new Date(),
        changedBy: userId,
        reason: reason || `Status changed to ${status}`
    });

    // Set specific fields based on status
    if (status === "cancelled") {
        appointment.cancelledAt = new Date();
        appointment.cancelledBy = userId;
        appointment.cancellationReason = reason;
    }

    await appointment.save();

    // Populate for response
    await appointment.populate([
        { path: "userId", select: "name email phone" },
        { path: "serviceId", select: "name description duration price category" },
        { path: "stylistId", select: "name specialties rating" }
    ]);

    res.status(200).json(
        new ApiResponse(200, appointment, "Appointment status updated successfully")
    );
});

// Get appointment by booking reference
export const getAppointmentByReference = asyncHandler(async (req, res) => {
    const { bookingReference } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = { bookingReference };
    
    // If not admin, only allow access to own appointments
    if (userRole !== "admin") {
        query.userId = userId;
    }

    const appointment = await Appointment.findOne(query)
        .populate("userId", "name email phone")
        .populate("serviceId", "name description duration price category")
        .populate("stylistId", "name specialties rating");

    if (!appointment) {
        throw new ApiError(404, "Appointment not found");
    }

    res.status(200).json(
        new ApiResponse(200, appointment, "Appointment retrieved successfully")
    );
});

// Add rating and feedback
export const addRatingAndFeedback = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user._id;

    const appointment = await Appointment.findOne({
        _id: appointmentId,
        userId,
        status: "completed"
    });

    if (!appointment) {
        throw new ApiError(404, "Completed appointment not found");
    }

    if (appointment.rating) {
        throw new ApiError(400, "Appointment already rated");
    }

    appointment.rating = rating;
    appointment.feedback = feedback;
    await appointment.save();

    res.status(200).json(
        new ApiResponse(200, appointment, "Rating and feedback added successfully")
    );
});

// Get today's appointments (admin)
export const getTodaysAppointments = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.find({
        date: { $gte: today, $lt: tomorrow },
        status: { $in: ["pending", "confirmed", "in_progress"] }
    })
    .populate("userId", "name phone email")
    .populate("serviceId", "name duration price")
    .populate("stylistId", "name specialties")
    .sort({ timeSlot: 1 });

    res.status(200).json(
        new ApiResponse(200, { appointments }, "Today's appointments retrieved successfully")
    );
});
