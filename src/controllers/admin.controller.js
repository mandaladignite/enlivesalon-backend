import { Appointment } from "../models/appointment.model.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

// Get admin dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
    try {
        // Get date ranges for comparison
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfLastWeek = new Date(now.setDate(now.getDate() - 7));

        // Total bookings/appointments
        const totalBookings = await Appointment.countDocuments();
        const currentMonthBookings = await Appointment.countDocuments({
            createdAt: { $gte: startOfMonth }
        });
        const lastMonthBookings = await Appointment.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });
        const bookingsChange = lastMonthBookings > 0 
            ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings * 100).toFixed(1)
            : 0;

        // Active customers (users with appointments)
        const activeCustomers = await User.countDocuments({
            _id: { $in: await Appointment.distinct('userId') },
            isActive: true
        });
        const lastMonthActiveCustomers = await User.countDocuments({
            _id: { $in: await Appointment.distinct('userId', { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }) },
            isActive: true
        });
        const customersChange = lastMonthActiveCustomers > 0 
            ? ((activeCustomers - lastMonthActiveCustomers) / lastMonthActiveCustomers * 100).toFixed(1)
            : 0;

        // Services booked (total appointments completed)
        const servicesBookedResult = await Appointment.aggregate([
            { $match: { status: { $in: ['completed', 'confirmed'] } } },
            { $group: { _id: null, totalServices: { $sum: 1 } } }
        ]);
        const servicesBooked = servicesBookedResult.length > 0 ? servicesBookedResult[0].totalServices : 0;

        const lastMonthServicesBooked = await Appointment.aggregate([
            { 
                $match: { 
                    status: { $in: ['completed', 'confirmed'] },
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                } 
            },
            { $group: { _id: null, totalServices: { $sum: 1 } } }
        ]);
        const lastMonthServicesBookedCount = lastMonthServicesBooked.length > 0 ? lastMonthServicesBooked[0].totalServices : 0;
        const servicesChange = lastMonthServicesBookedCount > 0 
            ? ((servicesBooked - lastMonthServicesBookedCount) / lastMonthServicesBookedCount * 100).toFixed(1)
            : 0;

        // Revenue (from appointments only)
        const revenueResult = await Appointment.aggregate([
            { $match: { status: { $in: ['completed', 'confirmed'] } } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        const lastMonthRevenue = await Appointment.aggregate([
            { 
                $match: { 
                    status: { $in: ['completed', 'confirmed'] },
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                } 
            },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const lastMonthRevenueAmount = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].totalRevenue : 0;
        const revenueChange = lastMonthRevenueAmount > 0 
            ? ((revenue - lastMonthRevenueAmount) / lastMonthRevenueAmount * 100).toFixed(1)
            : 0;

        // Format revenue for display
        const formatCurrency = (amount) => {
            if (amount >= 100000) {
                return `₹${(amount / 100000).toFixed(1)}L`;
            } else if (amount >= 1000) {
                return `₹${(amount / 1000).toFixed(1)}K`;
            } else {
                return `₹${amount}`;
            }
        };

        const stats = {
            totalBookings: {
                value: totalBookings,
                change: `${bookingsChange >= 0 ? '+' : ''}${bookingsChange}%`,
                trend: bookingsChange >= 0 ? 'up' : 'down'
            },
            activeCustomers: {
                value: activeCustomers,
                change: `${customersChange >= 0 ? '+' : ''}${customersChange}%`,
                trend: customersChange >= 0 ? 'up' : 'down'
            },
            servicesBooked: {
                value: servicesBooked,
                change: `${servicesChange >= 0 ? '+' : ''}${servicesChange}%`,
                trend: servicesChange >= 0 ? 'up' : 'down'
            },
            revenue: {
                value: formatCurrency(revenue),
                change: `${revenueChange >= 0 ? '+' : ''}${revenueChange}%`,
                trend: revenueChange >= 0 ? 'up' : 'down'
            }
        };

        return res.status(200).json(
            new ApiResponse(200, stats, "Dashboard statistics retrieved successfully")
        );

    } catch (error) {
        throw new ApiError(500, "Failed to retrieve dashboard statistics");
    }
});

// Get recent appointments/bookings
const getRecentBookings = asyncHandler(async (req, res) => {
    try {
        const { limit = 10, status } = req.query;

        // Build filter
        const filter = {};
        if (status) {
            filter.status = status;
        }

        const appointments = await Appointment.find(filter)
            .populate('userId', 'name email')
            .populate('serviceId', 'name price')
            .populate('stylistId', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        const formattedBookings = appointments.map(appointment => ({
            _id: appointment._id,
            customerName: appointment.userId?.name || 'Unknown',
            customerEmail: appointment.userId?.email || '',
            serviceName: appointment.serviceId?.name || 'Unknown Service',
            servicePrice: appointment.serviceId?.price || 0,
            stylistName: appointment.stylistId?.name || 'Not Assigned',
            date: appointment.date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            time: appointment.timeSlot,
            status: appointment.status,
            totalPrice: appointment.totalPrice,
            location: appointment.location,
            notes: appointment.notes
        }));

        return res.status(200).json(
            new ApiResponse(200, formattedBookings, "Recent bookings retrieved successfully")
        );

    } catch (error) {
        throw new ApiError(500, "Failed to retrieve recent bookings");
    }
});

// Get revenue analytics
const getRevenueAnalytics = asyncHandler(async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        let groupFormat, dateFilter;
        const now = new Date();

        switch (period) {
            case 'week':
                groupFormat = { $dayOfWeek: '$createdAt' };
                dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
                break;
            case 'month':
                groupFormat = { $dayOfMonth: '$createdAt' };
                dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
                break;
            case 'year':
                groupFormat = { $month: '$createdAt' };
                dateFilter = { $gte: new Date(now.getFullYear(), 0, 1) };
                break;
            default:
                groupFormat = { $dayOfMonth: '$createdAt' };
                dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        }

        const revenueData = await Appointment.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'confirmed'] },
                    createdAt: dateFilter
                }
            },
            {
                $group: {
                    _id: groupFormat,
                    totalRevenue: { $sum: '$totalAmount' },
                    appointmentCount: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Get appointment revenue
        const appointmentRevenue = await Appointment.aggregate([
            {
                $match: {
                    status: { $in: ['completed'] },
                    createdAt: dateFilter
                }
            },
            {
                $group: {
                    _id: groupFormat,
                    totalRevenue: { $sum: '$totalPrice' },
                    appointmentCount: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        return res.status(200).json(
            new ApiResponse(200, {
                appointmentRevenue: appointmentRevenue,
                period: period
            }, "Revenue analytics retrieved successfully")
        );

    } catch (error) {
        throw new ApiError(500, "Failed to retrieve revenue analytics");
    }
});

// Get upcoming appointments
const getUpcomingAppointments = asyncHandler(async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const appointments = await Appointment.find({
            date: { $gte: today },
            status: { $in: ['pending', 'confirmed'] }
        })
        .populate('userId', 'name email')
        .populate('serviceId', 'name price')
        .populate('stylistId', 'name')
        .sort({ date: 1, timeSlot: 1 })
        .limit(parseInt(limit));

        const formattedAppointments = appointments.map(appointment => ({
            _id: appointment._id,
            customerName: appointment.userId?.name || 'Unknown',
            serviceName: appointment.serviceId?.name || 'Unknown Service',
            stylistName: appointment.stylistId?.name || 'Not Assigned',
            date: appointment.date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            time: appointment.timeSlot,
            status: appointment.status,
            totalPrice: appointment.totalPrice,
            location: appointment.location
        }));

        return res.status(200).json(
            new ApiResponse(200, formattedAppointments, "Upcoming appointments retrieved successfully")
        );

    } catch (error) {
        throw new ApiError(500, "Failed to retrieve upcoming appointments");
    }
});

// Get dashboard overview
const getDashboardOverview = asyncHandler(async (req, res) => {
    try {
        // Get all statistics in parallel
        const [
            statsResult,
            recentBookingsResult,
            upcomingAppointmentsResult
        ] = await Promise.all([
            // Get stats
            (async () => {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

                const totalBookings = await Appointment.countDocuments();
                const currentMonthBookings = await Appointment.countDocuments({
                    createdAt: { $gte: startOfMonth }
                });
                const lastMonthBookings = await Appointment.countDocuments({
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                });
                const bookingsChange = lastMonthBookings > 0 
                    ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings * 100).toFixed(1)
                    : 0;

                const activeCustomers = await User.countDocuments({
                    _id: { $in: await Appointment.distinct('userId') },
                    isActive: true
                });

                const servicesBookedResult = await Appointment.aggregate([
                    { $match: { status: { $in: ['completed', 'confirmed'] } } },
                    { $group: { _id: null, totalServices: { $sum: 1 } } }
                ]);
                const servicesBooked = servicesBookedResult.length > 0 ? servicesBookedResult[0].totalServices : 0;

                const revenueResult = await Appointment.aggregate([
                    { $match: { status: { $in: ['completed', 'confirmed'] } } },
                    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
                ]);
                const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

                const formatCurrency = (amount) => {
                    if (amount >= 100000) {
                        return `₹${(amount / 100000).toFixed(1)}L`;
                    } else if (amount >= 1000) {
                        return `₹${(amount / 1000).toFixed(1)}K`;
                    } else {
                        return `₹${amount}`;
                    }
                };

                return {
                    totalBookings: {
                        value: totalBookings,
                        change: `${bookingsChange >= 0 ? '+' : ''}${bookingsChange}%`,
                        trend: bookingsChange >= 0 ? 'up' : 'down'
                    },
                    activeCustomers: {
                        value: activeCustomers,
                        change: '+5%', // Simplified for now
                        trend: 'up'
                    },
                    servicesBooked: {
                        value: servicesBooked,
                        change: '+12%', // Simplified for now
                        trend: 'up'
                    },
                    revenue: {
                        value: formatCurrency(revenue),
                        change: '+18%', // Simplified for now
                        trend: 'up'
                    }
                };
            })(),
            // Get recent bookings
            Appointment.find({})
                .populate('userId', 'name email')
                .populate('serviceId', 'name price')
                .populate('stylistId', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .then(appointments => appointments.map(appointment => ({
                    _id: appointment._id,
                    customerName: appointment.userId?.name || 'Unknown',
                    serviceName: appointment.serviceId?.name || 'Unknown Service',
                    date: appointment.date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }),
                    time: appointment.timeSlot,
                    status: appointment.status,
                    totalPrice: appointment.totalPrice
                }))),
            // Get upcoming appointments
            (async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const appointments = await Appointment.find({
                    date: { $gte: today },
                    status: { $in: ['pending', 'confirmed'] }
                })
                .populate('userId', 'name email')
                .populate('serviceId', 'name price')
                .populate('stylistId', 'name')
                .sort({ date: 1, timeSlot: 1 })
                .limit(3);

                return appointments.map(appointment => ({
                    _id: appointment._id,
                    customerName: appointment.userId?.name || 'Unknown',
                    serviceName: appointment.serviceId?.name || 'Unknown Service',
                    date: appointment.date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }),
                    time: appointment.timeSlot,
                    status: appointment.status,
                    totalPrice: appointment.totalPrice
                }));
            })()
        ]);

        const overview = {
            stats: statsResult,
            recentBookings: recentBookingsResult,
            upcomingAppointments: upcomingAppointmentsResult
        };

        return res.status(200).json(
            new ApiResponse(200, overview, "Dashboard overview retrieved successfully")
        );

    } catch (error) {
        throw new ApiError(500, "Failed to retrieve dashboard overview");
    }
});

export {
    getDashboardStats,
    getRecentBookings,
    getRevenueAnalytics,
    getUpcomingAppointments,
    getDashboardOverview
};
