/**
 * Health check utilities for monitoring system status
 */

import mongoose from "mongoose";
import { logger } from "./logger.js";

export class HealthChecker {
    constructor() {
        this.checks = new Map();
        this.lastCheck = null;
        this.status = 'unknown';
    }

    /**
     * Add a health check function
     */
    addCheck(name, checkFunction, timeout = 5000) {
        this.checks.set(name, {
            function: checkFunction,
            timeout,
            lastResult: null,
            lastCheck: null
        });
    }

    /**
     * Run all health checks
     */
    async runChecks() {
        const results = {};
        let overallStatus = 'healthy';
        const startTime = Date.now();

        for (const [name, check] of this.checks) {
            try {
                const result = await Promise.race([
                    check.function(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Check timeout')), check.timeout)
                    )
                ]);

                check.lastResult = { status: 'healthy', result, timestamp: new Date() };
                results[name] = check.lastResult;
            } catch (error) {
                check.lastResult = { 
                    status: 'unhealthy', 
                    error: error.message, 
                    timestamp: new Date() 
                };
                results[name] = check.lastResult;
                overallStatus = 'unhealthy';
            }

            check.lastCheck = new Date();
        }

        this.lastCheck = new Date();
        this.status = overallStatus;

        const duration = Date.now() - startTime;
        logger.logSystemHealth('health_check', overallStatus, {
            duration,
            checks: Object.keys(results).length,
            healthy: Object.values(results).filter(r => r.status === 'healthy').length,
            unhealthy: Object.values(results).filter(r => r.status === 'unhealthy').length
        });

        return {
            status: overallStatus,
            timestamp: this.lastCheck,
            duration,
            checks: results
        };
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            status: this.status,
            lastCheck: this.lastCheck,
            checks: Object.fromEntries(
                Array.from(this.checks.entries()).map(([name, check]) => [
                    name,
                    {
                        lastResult: check.lastResult,
                        lastCheck: check.lastCheck
                    }
                ])
            )
        };
    }
}

// Create global health checker instance
export const healthChecker = new HealthChecker();

/**
 * Database health check
 */
async function checkDatabase() {
    try {
        const state = mongoose.connection.readyState;
        if (state !== 1) {
            throw new Error(`Database connection state: ${state}`);
        }

        // Test a simple query
        await mongoose.connection.db.admin().ping();
        
        return {
            status: 'connected',
            state,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    } catch (error) {
        throw new Error(`Database health check failed: ${error.message}`);
    }
}

/**
 * Memory health check
 */
async function checkMemory() {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    if (memoryUsagePercent > 90) {
        throw new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }

    return {
        heapTotal: totalMemory,
        heapUsed: usedMemory,
        external: usage.external,
        rss: usage.rss,
        usagePercent: memoryUsagePercent
    };
}

/**
 * CPU health check
 */
async function checkCPU() {
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
    
    if (cpuUsage > 5) {
        throw new Error(`High CPU usage: ${cpuUsage.toFixed(2)}s`);
    }

    return {
        user: endUsage.user,
        system: endUsage.system,
        total: endUsage.user + endUsage.system
    };
}

/**
 * Disk space health check
 */
async function checkDiskSpace() {
    try {
        const fs = await import('fs');
        const stats = await fs.promises.stat('.');
        
        // This is a simplified check - in production you'd use a proper disk space library
        return {
            available: true,
            message: 'Disk space check not implemented'
        };
    } catch (error) {
        throw new Error(`Disk space check failed: ${error.message}`);
    }
}

/**
 * External service health check
 */
async function checkExternalServices() {
    const services = {
        // Email service removed
    };

    return services;
}

/**
 * Initialize health checks
 */
export function initializeHealthChecks() {
    healthChecker.addCheck('database', checkDatabase, 5000);
    healthChecker.addCheck('memory', checkMemory, 2000);
    healthChecker.addCheck('cpu', checkCPU, 2000);
    healthChecker.addCheck('disk', checkDiskSpace, 3000);
    healthChecker.addCheck('external_services', checkExternalServices, 5000);
}

/**
 * Get health status endpoint handler
 */
export async function getHealthStatus(req, res) {
    try {
        const status = await healthChecker.runChecks();
        
        const response = {
            status: status.status,
            timestamp: status.timestamp,
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            checks: status.checks
        };

        const httpStatus = status.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(response);
    } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(503).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Get detailed health status
 */
export async function getDetailedHealthStatus(req, res) {
    try {
        const status = healthChecker.getStatus();
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const detailedStatus = {
            ...status,
            system: {
                uptime: process.uptime(),
                memory: memoryUsage,
                cpu: cpuUsage,
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
            },
            environment: {
                nodeEnv: process.env.NODE_ENV,
                version: process.env.npm_package_version,
                port: process.env.PORT
            }
        };

        res.status(200).json(detailedStatus);
    } catch (error) {
        logger.error('Detailed health check failed', { error: error.message });
        res.status(500).json({
            status: 'error',
            message: 'Detailed health check failed',
            timestamp: new Date().toISOString()
        });
    }
}
