import mongoose from 'mongoose';

export const initializeHealthChecks = () => {
    // Database health check
    const checkDatabase = () => {
        return mongoose.connection.readyState === 1;
    };

    // Memory usage check
    const checkMemory = () => {
        const used = process.memoryUsage();
        const total = used.heapTotal;
        const free = total - used.heapUsed;
        const usage = (used.heapUsed / total) * 100;
        
        return {
            used: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(total / 1024 / 1024) + ' MB',
            free: Math.round(free / 1024 / 1024) + ' MB',
            usage: Math.round(usage) + '%'
        };
    };

    // System uptime
    const getUptime = () => {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    // Export health check functions
    global.healthChecks = {
        checkDatabase,
        checkMemory,
        getUptime
    };
};
