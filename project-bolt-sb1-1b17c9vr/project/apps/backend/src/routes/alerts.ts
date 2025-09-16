import { Router } from 'express';
import Joi from 'joi';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { validateRequest } from '../middleware/validation';
import { checkGeofences } from '../services/geofenceService';
import { sendPushNotification } from '../services/notificationService';
import { anchorToBlockchain } from '../services/blockchainService';
import { io } from '../server';

const router = Router();

// Validation schemas
const panicAlertSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  message: Joi.string().max(500).optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('high'),
  type: Joi.string().valid('panic', 'medical', 'security', 'natural_disaster').default('panic')
});

const updateAlertSchema = Joi.object({
  status: Joi.string().valid('active', 'investigating', 'resolved', 'false_alarm').required(),
  response_notes: Joi.string().max(1000).optional(),
  assigned_to: Joi.string().uuid().optional()
});

/**
 * @route POST /api/alerts/panic
 * @desc Create a panic alert
 * @access Private (Tourist)
 */
router.post('/panic', validateRequest(panicAlertSchema), async (req, res, next) => {
  try {
    const { latitude, longitude, message, severity, type } = req.body;
    const userId = req.user.userId;

    // Get user details
    const { data: user } = await supabase
      .from('tourists')
      .select('name, phone_number, emergency_contact')
      .eq('id', userId)
      .single();

    // Check if user is in any restricted geofences
    const geofenceViolations = await checkGeofences(latitude, longitude);

    // Create alert record
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        user_id: userId,
        type,
        severity,
        status: 'active',
        location: `POINT(${longitude} ${latitude})`,
        latitude,
        longitude,
        message,
        metadata: {
          geofence_violations: geofenceViolations,
          user_agent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
          emergency_contact: user?.emergency_contact
        },
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create panic alert:', error);
      throw new ApiError(500, 'Failed to create alert');
    }

    // Create location record for tracking
    await supabase
      .from('locations')
      .insert({
        user_id: userId,
        latitude,
        longitude,
        location: `POINT(${longitude} ${latitude})`,
        accuracy: 10, // Assume high accuracy for panic alerts
        alert_id: alert.id,
        created_at: new Date().toISOString()
      });

    // Send real-time notification to dashboard
    io.emit('new_alert', {
      id: alert.id,
      userId,
      userName: user?.name,
      type,
      severity,
      status: 'active',
      latitude,
      longitude,
      message,
      createdAt: alert.created_at,
      geofenceViolations
    });

    // Send push notifications to authorities
    if (severity === 'critical' || severity === 'high') {
      try {
        await sendPushNotification({
          topic: 'emergency_alerts',
          title: `${severity.toUpperCase()} Alert - ${type}`,
          body: `${user?.name} has triggered a ${type} alert at ${latitude}, ${longitude}`,
          data: {
            alert_id: alert.id,
            type,
            severity,
            latitude: latitude.toString(),
            longitude: longitude.toString()
          }
        });
      } catch (notificationError) {
        logger.error('Failed to send push notification:', notificationError);
      }
    }

    // Anchor critical alerts to blockchain
    if (severity === 'critical') {
      try {
        const blockchainTx = await anchorToBlockchain({
          alert_id: alert.id,
          user_id: userId,
          type,
          severity,
          timestamp: alert.created_at,
          location_hash: `${latitude},${longitude}` // Hash actual coordinates
        });

        // Update alert with blockchain transaction
        await supabase
          .from('alerts')
          .update({
            blockchain_tx: blockchainTx.hash,
            blockchain_network: blockchainTx.network
          })
          .eq('id', alert.id);

        logger.info(`Critical alert ${alert.id} anchored to blockchain: ${blockchainTx.hash}`);
      } catch (blockchainError) {
        logger.error('Failed to anchor alert to blockchain:', blockchainError);
      }
    }

    logger.info(`Panic alert created by user ${userId}: ${alert.id} (${severity})`);

    res.status(201).json({
      success: true,
      data: {
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          latitude: alert.latitude,
          longitude: alert.longitude,
          message: alert.message,
          createdAt: alert.created_at,
          estimatedResponseTime: getEstimatedResponseTime(severity, geofenceViolations.length > 0)
        },
        geofenceViolations
      },
      message: 'Alert created successfully. Help is on the way.'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/alerts
 * @desc Get alerts (filtered by role)
 * @access Private
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, severity, type, limit = 50, offset = 0 } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = supabase
      .from('alerts')
      .select(`
        id, user_id, type, severity, status, latitude, longitude, 
        message, response_notes, assigned_to, blockchain_tx, 
        created_at, updated_at, resolved_at,
        tourists!alerts_user_id_fkey(name, phone_number)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Filter based on user role
    if (userRole === 'tourist') {
      // Tourists can only see their own alerts
      query = query.eq('user_id', userId);
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data: alerts, error } = await query;

    if (error) {
      logger.error('Failed to fetch alerts:', error);
      throw new ApiError(500, 'Failed to fetch alerts');
    }

    res.json({
      success: true,
      data: {
        alerts: alerts?.map(alert => ({
          id: alert.id,
          userId: alert.user_id,
          userName: alert.tourists?.name,
          userPhone: alert.tourists?.phone_number,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          latitude: alert.latitude,
          longitude: alert.longitude,
          message: alert.message,
          responseNotes: alert.response_notes,
          assignedTo: alert.assigned_to,
          blockchainTx: alert.blockchain_tx,
          createdAt: alert.created_at,
          updatedAt: alert.updated_at,
          resolvedAt: alert.resolved_at
        })) || [],
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: alerts?.length || 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/alerts/:id
 * @desc Get specific alert details
 * @access Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = supabase
      .from('alerts')
      .select(`
        *, 
        tourists!alerts_user_id_fkey(name, email, phone_number, emergency_contact),
        locations!locations_alert_id_fkey(latitude, longitude, accuracy, created_at)
      `)
      .eq('id', id)
      .single();

    // Tourists can only see their own alerts
    if (userRole === 'tourist') {
      query = query.eq('user_id', userId);
    }

    const { data: alert, error } = await query;

    if (error || !alert) {
      throw new ApiError(404, 'Alert not found');
    }

    res.json({
      success: true,
      data: {
        alert: {
          id: alert.id,
          userId: alert.user_id,
          user: alert.tourists,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          latitude: alert.latitude,
          longitude: alert.longitude,
          message: alert.message,
          responseNotes: alert.response_notes,
          assignedTo: alert.assigned_to,
          blockchainTx: alert.blockchain_tx,
          blockchainNetwork: alert.blockchain_network,
          metadata: alert.metadata,
          locations: alert.locations,
          createdAt: alert.created_at,
          updatedAt: alert.updated_at,
          resolvedAt: alert.resolved_at
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/alerts/:id
 * @desc Update alert status (Police/Admin only)
 * @access Private (Police/Admin)
 */
router.put('/:id', validateRequest(updateAlertSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, response_notes, assigned_to } = req.body;
    const userRole = req.user.role;
    const userId = req.user.userId;

    // Only police and admin can update alerts
    if (!['police', 'admin'].includes(userRole)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (response_notes) {
      updateData.response_notes = response_notes;
    }

    if (assigned_to) {
      updateData.assigned_to = assigned_to;
    }

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = userId;
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .update(updateData)
      .eq('id', id)
      .select('*, tourists!alerts_user_id_fkey(name)')
      .single();

    if (error || !alert) {
      throw new ApiError(404, 'Alert not found or update failed');
    }

    // Send real-time update to dashboard
    io.emit('alert_updated', {
      id: alert.id,
      status: alert.status,
      responseNotes: alert.response_notes,
      updatedAt: alert.updated_at,
      resolvedAt: alert.resolved_at
    });

    // Notify tourist of status update
    if (status === 'resolved') {
      try {
        await sendPushNotification({
          userId: alert.user_id,
          title: 'Alert Resolved',
          body: `Your ${alert.type} alert has been resolved. You are safe now.`,
          data: {
            alert_id: alert.id,
            status: 'resolved'
          }
        });
      } catch (notificationError) {
        logger.error('Failed to send resolution notification:', notificationError);
      }
    }

    logger.info(`Alert ${id} updated to ${status} by user ${userId}`);

    res.json({
      success: true,
      data: {
        alert: {
          id: alert.id,
          status: alert.status,
          responseNotes: alert.response_notes,
          assignedTo: alert.assigned_to,
          updatedAt: alert.updated_at,
          resolvedAt: alert.resolved_at
        }
      },
      message: 'Alert updated successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/alerts/stats/dashboard
 * @desc Get alert statistics for dashboard
 * @access Private (Police/Admin)
 */
router.get('/stats/dashboard', async (req, res, next) => {
  try {
    const userRole = req.user.role;

    if (!['police', 'admin'].includes(userRole)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    // Get various alert statistics
    const [
      { count: totalAlerts },
      { count: activeAlerts },
      { count: todayAlerts },
      { count: criticalAlerts }
    ] = await Promise.all([
      supabase.from('alerts').select('*', { count: 'exact', head: true }),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('alerts').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('severity', 'critical')
    ]);

    // Get alert breakdown by type
    const { data: alertsByType } = await supabase
      .from('alerts')
      .select('type')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const typeBreakdown = alertsByType?.reduce((acc: any, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {}) || {};

    // Average response time for resolved alerts
    const { data: resolvedAlerts } = await supabase
      .from('alerts')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let averageResponseTime = 0;
    if (resolvedAlerts && resolvedAlerts.length > 0) {
      const totalResponseTime = resolvedAlerts.reduce((acc, alert) => {
        const responseTime = new Date(alert.resolved_at).getTime() - new Date(alert.created_at).getTime();
        return acc + responseTime;
      }, 0);
      averageResponseTime = totalResponseTime / resolvedAlerts.length;
    }

    res.json({
      success: true,
      data: {
        statistics: {
          totalAlerts: totalAlerts || 0,
          activeAlerts: activeAlerts || 0,
          todayAlerts: todayAlerts || 0,
          criticalAlerts: criticalAlerts || 0,
          averageResponseTimeMs: Math.round(averageResponseTime),
          averageResponseTimeMinutes: Math.round(averageResponseTime / 60000)
        },
        breakdown: {
          byType: typeBreakdown
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Helper function to estimate response time
function getEstimatedResponseTime(severity: string, inRestrictedArea: boolean): string {
  let minutes = 15; // Default response time

  switch (severity) {
    case 'critical':
      minutes = 5;
      break;
    case 'high':
      minutes = 10;
      break;
    case 'medium':
      minutes = 20;
      break;
    case 'low':
      minutes = 30;
      break;
  }

  // Add time if in restricted area (harder to access)
  if (inRestrictedArea) {
    minutes += 10;
  }

  return `${minutes} minutes`;
}

export default router;