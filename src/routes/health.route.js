import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    const healthChecks = global.healthChecks;
    
    if (!healthChecks) {
        return res.status(503).json({
            status: 'error',
            message: 'Health checks not initialized'
        });
    }

    const dbStatus = healthChecks.checkDatabase();
    const memory = healthChecks.checkMemory();
    const uptime = healthChecks.getUptime();

    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime,
        database: dbStatus ? 'connected' : 'disconnected',
        memory,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Detailed system status
router.get('/status', (req, res) => {
    const healthChecks = global.healthChecks;
    
    if (!healthChecks) {
        return res.status(503).json({
            status: 'error',
            message: 'Health checks not initialized'
        });
    }

    const dbStatus = healthChecks.checkDatabase();
    const memory = healthChecks.checkMemory();
    const uptime = healthChecks.getUptime();

    res.status(200).json({
        status: dbStatus ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
            database: {
                status: dbStatus ? 'up' : 'down',
                connection: mongoose.connection.readyState
            },
            server: {
                status: 'up',
                uptime,
                memory,
                pid: process.pid,
                version: process.version
            }
        }
    });
});

export default router;
