import Enquiry from "../models/enquiry.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Create a new enquiry
export const createEnquiry = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        phone,
        subject,
        message,
        enquiryType,
        priority,
        source,
        tags
    } = req.body;

    // Check if user is authenticated to link enquiry to user
    const userId = req.user?.id || null;

    const enquiry = await Enquiry.create({
        name,
        email,
        phone,
        subject,
        message,
        enquiryType,
        priority: priority || "medium",
        source: source || "website",
        tags: tags || [],
        userId
    });

    // Email notifications removed - enquiry created successfully

    res.status(201).json(
        new ApiResponse(201, enquiry, "Enquiry created successfully")
    );
});

// Get all enquiries (Admin only)
export const getAllEnquiries = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        enquiryType,
        priority,
        assignedTo,
        search,
        sortBy = "createdAt",
        sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (status && status !== 'all') filter.status = status;
    if (enquiryType) filter.enquiryType = enquiryType;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Add search functionality
    if (search) {
        filter.$or = [
            { enquiryNumber: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { subject: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } }
        ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [
            { path: "userId", select: "name email" },
            { path: "assignedTo", select: "name email" },
            { path: "response.respondedBy", select: "name email" }
        ]
    };

    const enquiries = await Enquiry.paginate(filter, options);

    res.status(200).json(
        new ApiResponse(200, enquiries, "Enquiries retrieved successfully")
    );
});

// Get single enquiry
export const getEnquiry = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const enquiry = await Enquiry.findById(id)
        .populate("userId", "name email")
        .populate("assignedTo", "name email")
        .populate("response.respondedBy", "name email");

    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    // Check if user can access this enquiry
    if (req.user.role !== "admin" && enquiry.userId?.toString() !== req.user.id) {
        throw new ApiError(403, "Access denied");
    }

    res.status(200).json(
        new ApiResponse(200, enquiry, "Enquiry retrieved successfully")
    );
});

// Update enquiry
export const updateEnquiry = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    // Check permissions
    if (req.user.role !== "admin" && enquiry.userId?.toString() !== req.user.id) {
        throw new ApiError(403, "Access denied");
    }

    // Prevent non-admin users from updating certain fields
    if (req.user.role !== "admin") {
        const restrictedFields = ["status", "priority", "assignedTo", "response", "followUp"];
        restrictedFields.forEach(field => delete updateData[field]);
    }

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    ).populate("userId", "name email")
     .populate("assignedTo", "name email")
     .populate("response.respondedBy", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedEnquiry, "Enquiry updated successfully")
    );
});

// Delete enquiry (soft delete)
export const deleteEnquiry = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    // Only admin can delete enquiries
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied");
    }

    enquiry.isActive = false;
    await enquiry.save();

    res.status(200).json(
        new ApiResponse(200, null, "Enquiry deleted successfully")
    );
});

// Respond to enquiry
export const respondToEnquiry = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, responseMethod = "email" } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    // Update enquiry with response
    enquiry.response = {
        message,
        respondedBy: req.user.id,
        respondedAt: new Date(),
        responseMethod
    };

    // Update status
    if (enquiry.status === "new") {
        enquiry.status = "responded";
    }

    await enquiry.save();

    // Email responses removed - response saved successfully

    const updatedEnquiry = await Enquiry.findById(id)
        .populate("userId", "name email")
        .populate("assignedTo", "name email")
        .populate("response.respondedBy", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedEnquiry, "Response sent successfully")
    );
});

// Assign enquiry to staff member
export const assignEnquiry = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    // Verify assigned user exists and is admin/staff
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || !["admin", "staff"].includes(assignedUser.role)) {
        throw new ApiError(400, "Invalid user for assignment");
    }

    enquiry.assignedTo = assignedTo;
    if (enquiry.status === "new") {
        enquiry.status = "in_progress";
    }

    await enquiry.save();

    const updatedEnquiry = await Enquiry.findById(id)
        .populate("userId", "name email")
        .populate("assignedTo", "name email")
        .populate("response.respondedBy", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedEnquiry, "Enquiry assigned successfully")
    );
});

// Update enquiry status
export const updateEnquiryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["new", "in_progress", "responded", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
        throw new ApiError(400, "Invalid status");
    }

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
        throw new ApiError(404, "Enquiry not found");
    }

    enquiry.status = status;

    // Set resolved/closed dates
    if (status === "resolved") {
        enquiry.resolvedAt = new Date();
    } else if (status === "closed") {
        enquiry.closedAt = new Date();
    }

    await enquiry.save();

    const updatedEnquiry = await Enquiry.findById(id)
        .populate("userId", "name email")
        .populate("assignedTo", "name email")
        .populate("response.respondedBy", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedEnquiry, "Enquiry status updated successfully")
    );
});

// Get enquiry statistics
export const getEnquiryStats = asyncHandler(async (req, res) => {
    const stats = await Enquiry.getEnquiryStats();
    const enquiriesByType = await Enquiry.getEnquiriesByType();

    res.status(200).json(
        new ApiResponse(200, {
            stats,
            enquiriesByType
        }, "Enquiry statistics retrieved successfully")
    );
});

// Get user's enquiries
export const getUserEnquiries = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, enquiryType } = req.query;
    const userId = req.user.id;

    const filter = { userId, isActive: true };
    if (status && status !== 'all') filter.status = status;
    if (enquiryType) filter.enquiryType = enquiryType;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
    };

    const enquiries = await Enquiry.paginate(filter, options);

    res.status(200).json(
        new ApiResponse(200, enquiries, "User enquiries retrieved successfully")
    );
});

// Search enquiries
export const searchEnquiries = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
        throw new ApiError(400, "Search query is required");
    }

    const filter = {
        isActive: true,
        $or: [
            { enquiryNumber: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { subject: { $regex: q, $options: "i" } },
            { message: { $regex: q, $options: "i" } }
        ]
    };

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
            { path: "userId", select: "name email" },
            { path: "assignedTo", select: "name email" }
        ]
    };

    const enquiries = await Enquiry.paginate(filter, options);

    res.status(200).json(
        new ApiResponse(200, enquiries, "Search results retrieved successfully")
    );
});

// Get enquiries by priority
export const getEnquiriesByPriority = asyncHandler(async (req, res) => {
    const { priority } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
        throw new ApiError(400, "Invalid priority level");
    }

    const filter = { priority, isActive: true };
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
            { path: "userId", select: "name email" },
            { path: "assignedTo", select: "name email" }
        ]
    };

    const enquiries = await Enquiry.paginate(filter, options);

    res.status(200).json(
        new ApiResponse(200, enquiries, `${priority} priority enquiries retrieved successfully`)
    );
});

// Bulk update enquiries
export const bulkUpdateEnquiries = asyncHandler(async (req, res) => {
    const { enquiryIds, updateData } = req.body;

    if (!enquiryIds || !Array.isArray(enquiryIds) || enquiryIds.length === 0) {
        throw new ApiError(400, "Enquiry IDs are required");
    }

    const result = await Enquiry.updateMany(
        { _id: { $in: enquiryIds } },
        updateData
    );

    res.status(200).json(
        new ApiResponse(200, { modifiedCount: result.modifiedCount }, "Bulk update completed successfully")
    );
});
