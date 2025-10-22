import { Membership } from "../models/membership.model.js";
import { Package } from "../models/package.model.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { 
    createMembershipWithOrder, 
    verifyMembershipPayment, 
    handlePaymentFailure as handlePaymentFailureUtil,
    getPaymentStatus as getPaymentStatusUtil
} from "../utils/enhancedRazorpay.js";

// Get user's active memberships
export const getUserActiveMemberships = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const memberships = await Membership.getActiveMemberships(userId);

    res.status(200).json(
        new ApiResponse(200, memberships, "Active memberships retrieved successfully")
    );
});

// Get user's all memberships (active and expired)
export const getUserAllMemberships = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;


    let query = { userId };
    
    if (status) {
        const now = new Date();
        switch (status) {
            case 'active':
                query.isActive = true;
                query.paymentStatus = 'paid';
                query.startDate = { $lte: now };
                query.expiryDate = { $gt: now };
                break;
            case 'expired':
                query.$or = [
                    { isActive: false },
                    { expiryDate: { $lte: now } }
                ];
                break;
            case 'pending_payment':
                query.paymentStatus = 'pending';
                break;
            case 'expiring_soon':
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                query.isActive = true;
                query.paymentStatus = 'paid';
                query.startDate = { $lte: now };
                query.expiryDate = { $gt: now, $lte: sevenDaysFromNow };
                break;
        }
    }

    const memberships = await Membership.find(query)
        .populate('packageId', 'name description benefits price')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Membership.countDocuments(query);


    try {
        res.status(200).json(
            new ApiResponse(200, {
                memberships,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalMemberships: total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            }, "Memberships retrieved successfully")
        );
    } catch (error) {
        console.error('Error sending response:', error);
        res.status(500).json(
            new ApiResponse(500, null, "Internal server error")
        );
    }
});

// Get single membership
export const getMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const userId = req.user._id;

    const membership = await Membership.findOne({
        _id: membershipId,
        userId: userId
    }).populate('packageId', 'name description benefits price duration durationUnit');

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    res.status(200).json(
        new ApiResponse(200, membership, "Membership retrieved successfully")
    );
});

// Enhanced membership purchase with Razorpay integration
export const purchaseMembership = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { packageId, notes = '', autoRenewal = false } = req.body;

    // Validate packageId
    if (!packageId) {
        throw new ApiError(400, "Package ID is required");
    }

    // Create membership with Razorpay order
    const result = await createMembershipWithOrder(userId, packageId, notes);

    if (!result.success) {
        throw new ApiError(400, result.error);
    }

    // Set auto-renewal if requested
    if (autoRenewal) {
        await result.membership.setAutoRenewal(true);
    }

    // Populate package details
    await result.membership.populate('packageId', 'name description benefits price duration durationUnit');

    res.status(201).json(
        new ApiResponse(201, {
            membership: result.membership,
            order: result.order,
            package: result.package
        }, "Membership order created successfully. Please complete payment.")
    );
});

// Verify membership payment
export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "Payment verification data is incomplete");
    }

    const result = await verifyMembershipPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    });

    if (!result.success) {
        throw new ApiError(400, result.error);
    }

    // Populate membership details
    await result.membership.populate('packageId', 'name description benefits price duration durationUnit');
    await result.membership.populate('userId', 'name email phone');

    res.status(200).json(
        new ApiResponse(200, {
            membership: result.membership,
            payment: result.payment
        }, "Payment verified successfully. Membership activated.")
    );
});

// Get payment status
export const getPaymentStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const result = await getPaymentStatusUtil(orderId);

    if (!result.success) {
        throw new ApiError(404, result.error);
    }

    res.status(200).json(
        new ApiResponse(200, {
            membership: result.membership,
            paymentStatus: result.paymentStatus,
            membershipStatus: result.membershipStatus
        }, "Payment status retrieved successfully")
    );
});

// Handle payment failure
export const handlePaymentFailure = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { reason } = req.body;

    const result = await handlePaymentFailureUtil(membershipId, reason);

    if (!result.success) {
        throw new ApiError(400, result.error);
    }

    res.status(200).json(
        new ApiResponse(200, result.membership, "Payment failure handled successfully")
    );
});

// Update membership payment status
export const updatePaymentStatus = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { paymentStatus, paymentId } = req.body;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    // Validate payment status
    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(paymentStatus)) {
        throw new ApiError(400, "Invalid payment status");
    }

    membership.paymentStatus = paymentStatus;
    if (paymentId) membership.paymentId = paymentId;

    await membership.save();

    res.status(200).json(
        new ApiResponse(200, membership, "Payment status updated successfully")
    );
});

// Cancel membership
export const cancelMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;

    const membership = await Membership.findOne({
        _id: membershipId,
        userId: userId
    });

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isActive) {
        throw new ApiError(400, "Membership is already cancelled");
    }

    await membership.cancel(userId, reason);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership cancelled successfully")
    );
});

// Extend membership
export const extendMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const userId = req.user._id;
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
        throw new ApiError(400, "Additional days must be a positive number");
    }

    const membership = await Membership.findOne({
        _id: membershipId,
        userId: userId
    });

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isActive) {
        throw new ApiError(400, "Cannot extend cancelled membership");
    }

    await membership.extend(additionalDays);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership extended successfully")
    );
});

// Use appointment (reduce remaining appointments)
export const useAppointment = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const userId = req.user._id;

    const membership = await Membership.findOne({
        _id: membershipId,
        userId: userId
    });

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isValid()) {
        throw new ApiError(400, "Membership is not valid or has expired");
    }

    try {
        await membership.useAppointment();
        res.status(200).json(
            new ApiResponse(200, membership, "Appointment used successfully")
        );
    } catch (error) {
        throw new ApiError(400, error.message);
    }
});

// Get membership statistics for user
export const getUserMembershipStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const stats = await Membership.aggregate([
        { $match: { userId: userId } },
        {
            $group: {
                _id: null,
                totalMemberships: { $sum: 1 },
                activeMemberships: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$isActive", true] },
                                    { $eq: ["$paymentStatus", "paid"] },
                                    { $gt: ["$expiryDate", new Date()] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                totalSpent: { $sum: "$amountPaid" },
                totalAppointmentsUsed: { $sum: "$usedAppointments" },
                totalAppointmentsRemaining: {
                    $sum: {
                        $cond: [
                            { $ne: ["$remainingAppointments", null] },
                            "$remainingAppointments",
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const recentMemberships = await Membership.find({ userId })
        .populate('packageId', 'name price')
        .sort({ createdAt: -1 })
        .limit(5);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalMemberships: 0,
                activeMemberships: 0,
                totalSpent: 0,
                totalAppointmentsUsed: 0,
                totalAppointmentsRemaining: 0
            },
            recentMemberships
        }, "Membership statistics retrieved successfully")
    );
});

// Admin: Get all memberships
export const getAllMemberships = asyncHandler(async (req, res) => {
    const { 
        status, 
        userId, 
        packageId, 
        paymentStatus, 
        page = 1, 
        limit = 10 
    } = req.query;

    // Build filter object
    const filter = {};
    if (userId) filter.userId = userId;
    if (packageId) filter.packageId = packageId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Add status filter
    if (status) {
        const now = new Date();
        switch (status) {
            case 'active':
                filter.isActive = true;
                filter.paymentStatus = 'paid';
                filter.startDate = { $lte: now };
                filter.expiryDate = { $gt: now };
                break;
            case 'expired':
                filter.$or = [
                    { isActive: false },
                    { expiryDate: { $lte: now } }
                ];
                break;
            case 'expiring_soon':
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                filter.isActive = true;
                filter.paymentStatus = 'paid';
                filter.startDate = { $lte: now };
                filter.expiryDate = { $gt: now, $lte: sevenDaysFromNow };
                break;
        }
    }

    const memberships = await Membership.find(filter)
        .populate('userId', 'name email phone')
        .populate('packageId', 'name price duration durationUnit')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Membership.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            memberships,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalMemberships: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        }, "Memberships retrieved successfully")
    );
});

// Admin: Get membership by ID
export const getMembershipById = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;

    const membership = await Membership.findById(membershipId)
        .populate('userId', 'name email phone')
        .populate('packageId', 'name description price duration durationUnit benefits');

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    res.status(200).json(
        new ApiResponse(200, membership, "Membership retrieved successfully")
    );
});

// Admin: Update membership
export const updateMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const updateData = req.body;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    // Validate payment status if being updated
    if (updateData.paymentStatus) {
        const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
        if (!validStatuses.includes(updateData.paymentStatus)) {
            throw new ApiError(400, "Invalid payment status");
        }
    }

    const updatedMembership = await Membership.findByIdAndUpdate(
        membershipId,
        updateData,
        { new: true, runValidators: true }
    ).populate('userId', 'name email').populate('packageId', 'name price');

    res.status(200).json(
        new ApiResponse(200, updatedMembership, "Membership updated successfully")
    );
});

// Admin: Cancel membership
export const adminCancelMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isActive) {
        throw new ApiError(400, "Membership is already cancelled");
    }

    await membership.cancel(adminId, reason);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership cancelled by admin successfully")
    );
});

// Admin: Get membership statistics
export const getMembershipStats = asyncHandler(async (req, res) => {
    const stats = await Membership.getMembershipStats();

    const packageStats = await Membership.aggregate([
        {
            $lookup: {
                from: 'packages',
                localField: 'packageId',
                foreignField: '_id',
                as: 'package'
            }
        },
        { $unwind: '$package' },
        {
            $group: {
                _id: '$package.name',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$amountPaid' },
                averageAmount: { $avg: '$amountPaid' }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    const monthlyStats = await Membership.aggregate([
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                count: { $sum: 1 },
                revenue: { $sum: '$amountPaid' }
            }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                totalMemberships: 0,
                activeMemberships: 0,
                expiredMemberships: 0,
                expiringSoon: 0,
                totalRevenue: 0
            },
            packageStats,
            monthlyStats
        }, "Membership statistics retrieved successfully")
    );
});

// Admin: Search memberships
export const searchMemberships = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
        throw new ApiError(400, "Search query must be at least 2 characters long");
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    
    const memberships = await Membership.find({
        $or: [
            { packageName: searchRegex },
            { description: searchRegex },
            { razorpayOrderId: searchRegex },
            { razorpayPaymentId: searchRegex }
        ]
    })
    .populate('userId', 'name email phone')
    .populate('packageId', 'name price')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Membership.countDocuments({
        $or: [
            { packageName: searchRegex },
            { description: searchRegex },
            { razorpayOrderId: searchRegex },
            { razorpayPaymentId: searchRegex }
        ]
    });

    res.status(200).json(
        new ApiResponse(200, {
            memberships,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalMemberships: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            },
            searchQuery: q
        }, "Search results retrieved successfully")
    );
});

// Upgrade membership tier
export const upgradeMembershipTier = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { newTier } = req.body;
    const adminId = req.user._id;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isActive) {
        throw new ApiError(400, "Cannot upgrade inactive membership");
    }

    await membership.upgradeTier(newTier, adminId);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership tier upgraded successfully")
    );
});

// Set auto-renewal
export const setAutoRenewal = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { enabled } = req.body;
    const userId = req.user._id;

    const membership = await Membership.findOne({
        _id: membershipId,
        userId: userId
    });

    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    await membership.setAutoRenewal(enabled);

    res.status(200).json(
        new ApiResponse(200, membership, `Auto-renewal ${enabled ? 'enabled' : 'disabled'} successfully`)
    );
});

// Suspend membership
export const suspendMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (!membership.isActive) {
        throw new ApiError(400, "Cannot suspend inactive membership");
    }

    await membership.suspend(reason, adminId);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership suspended successfully")
    );
});

// Reactivate membership
export const reactivateMembership = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const adminId = req.user._id;

    const membership = await Membership.findById(membershipId);
    if (!membership) {
        throw new ApiError(404, "Membership not found");
    }

    if (membership.membershipStatus !== 'suspended') {
        throw new ApiError(400, "Membership is not suspended");
    }

    await membership.reactivate(adminId);

    res.status(200).json(
        new ApiResponse(200, membership, "Membership reactivated successfully")
    );
});

// Get membership analytics
export const getMembershipAnalytics = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
        case '7d':
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case '1y':
            startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const analytics = await Membership.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalMemberships: { $sum: 1 },
                totalRevenue: { $sum: '$amountPaid' },
                averageRevenue: { $avg: '$amountPaid' },
                activeMemberships: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$isActive', true] },
                                    { $eq: ['$paymentStatus', 'paid'] },
                                    { $gt: ['$expiryDate', new Date()] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                totalSavings: { $sum: '$totalSavings' }
            }
        }
    ]);

    // Get tier distribution
    const tierDistribution = await Membership.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'paid'
            }
        },
        {
            $group: {
                _id: '$membershipTier',
                count: { $sum: 1 },
                revenue: { $sum: '$amountPaid' }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Get monthly trends
    const monthlyTrends = await Membership.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                count: { $sum: 1 },
                revenue: { $sum: '$amountPaid' }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            period,
            overview: analytics[0] || {
                totalMemberships: 0,
                totalRevenue: 0,
                averageRevenue: 0,
                activeMemberships: 0,
                totalSavings: 0
            },
            tierDistribution,
            monthlyTrends
        }, "Membership analytics retrieved successfully")
    );
});

