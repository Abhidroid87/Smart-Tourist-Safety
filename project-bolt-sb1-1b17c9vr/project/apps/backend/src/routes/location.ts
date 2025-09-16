import { Router } from 'express';
import Joi from 'joi';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { validateRequest } from '../middleware/validation';
import { checkGeofences } from '../services/geofenceService';
import { detectAnomalies } from '../services/anomalyService';
import { io } from '../server';

const router = Router();

// Validation schemas
const locationUpdateSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).max(1000).optional(),
  altitude: Joi.number().optional(),
  speed: Joi.number().min(0).optional(),
  heading: Joi.number().min(0).max(360).optional(),
  battery_level: Joi.number().min(0).max(100).optional(),
  is_background: Joi.boolean().default(false)
});

/**
 * @route POST /api/locations/update
 * @desc Update user location
 * @access Private (Tourist)
 */
router.post('/update', validateRequest(locationUpdateSchema), async (req, res, next) => {
  try {
    const {
      latitude,
      longitude,
      accuracy = 10,
      altitude,
      speed,
      heading,
      battery_level,
      is_background
    } = req.body;
    const userId = req.user.userId;

    // Create location record
    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        user_id: userId,
        latitude,
        longitude,
        location: `POINT(${longitude} ${latitude})`,
        accuracy,
        altitude,
        speed,
        heading,
        battery_level,
        is_background,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to save location:', error);
      throw new ApiError(500, 'Failed to save location');
    }

    // Check geofences
    const geofenceViolations = await checkGeofences(latitude, longitude);

    // Detect anomalies (if enabled)
    let anomalyAlert = null;
    try {
      anomalyAlert = await detectAnomalies(userId, { latitude, longitude, speed, timestamp: new Date() });
    } catch (anomalyError) {
      logger.warn('Anomaly detection failed:', anomalyError);
    }

    // Handle geofence violations
    if (geofenceViolations.length > 0) {
      // Create automatic alert for restricted area entry
      const restrictedViolations = geofenceViolations.filter(v => v.type === 'restricted');
      
      if (restrictedViolations.length > 0) {
        const { data: alert } = await supabase
          .from('alerts')
          .insert({
            user_id: userId,
            type: 'geofence_violation',
            severity: 'medium',
            status: 'active',
            location: `POINT(${longitude} ${latitude})`,
            latitude,
            longitude,
            message: `Entered restricted area: ${restrictedViolations[0].name}`,
            metadata: {
              geofence_violations: geofenceViolations,
              automatic: true
            },
            created_at: new Date().toISOString()
          })
          .select('*')
          .single();

        // Emit real-time alert
        if (alert) {
          io.emit('geofence_violation', {
            alert_id: alert.id,
            user_id: userId,
            geofence: restrictedViolations[0],
            location: { latitude, longitude },
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Handle anomaly alerts
    if (anomalyAlert) {
      io.emit('anomaly_detected', {
        user_id: userId,
        anomaly: anomalyAlert,
        location: { latitude, longitude },
        timestamp: new Date().toISOString()
      });
    }

    // Emit location update to dashboard (for admin monitoring)
    io.to('dashboard').emit('location_update', {
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      speed,
      timestamp: location.created_at,
      geofence_violations: geofenceViolations.length > 0 ? geofenceViolations : undefined
    });

    res.json({
      success: true,
      data: {
        location: {
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.created_at
        },
        geofenceStatus: {
          violations: geofenceViolations,
          inRestrictedArea: geofenceViolations.some(v => v.type === 'restricted'),
          inSafeZone: geofenceViolations.some(v => v.type === 'safe')
        },
        anomalyStatus: anomalyAlert ? {
          detected: true,
          type: anomalyAlert.type,
          confidence: anomalyAlert.confidence
        } : { detected: false }
      },
      message: 'Location updated successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/locations/history
 * @desc Get user's location history
 * @access Private
 */
router.get('/history', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, from, to } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = supabase
      .from('locations')
      .select('id, latitude, longitude, accuracy, speed, created_at')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Tourists can only see their own location history
    if (userRole === 'tourist') {
      query = query.eq('user_id', userId);
    }

    // Date range filters
    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }

    const { data: locations, error } = await query;

    if (error) {
      logger.error('Failed to fetch location history:', error);
      throw new ApiError(500, 'Failed to fetch location history');
    }

    res.json({
      success: true,
      data: {
        locations: locations?.map(location => ({
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          timestamp: location.created_at
        })) || [],
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: locations?.length || 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/locations/current/:userId?
 * @desc Get current location of user (or self)
 * @access Private
 */
router.get('/current/:userId?', async (req, res, next) => {
  try {
    const requestedUserId = req.params.userId;
    const currentUserId = req.user.userId;
    const userRole = req.user.role;

    // Determine which user's location to fetch
    let targetUserId = currentUserId;
    if (requestedUserId) {
      // Only police/admin can view others' locations
      if (!['police', 'admin'].includes(userRole)) {
        throw new ApiError(403, 'Insufficient permissions');
      }
      targetUserId = requestedUserId;
    }

    // Get the most recent location
    const { data: location, error } = await supabase
      .from('locations')
      .select(`
        id, latitude, longitude, accuracy, speed, heading,
        battery_level, created_at,
        tourists!locations_user_id_fkey(name, phone_number, status)
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !location) {
      throw new ApiError(404, 'Location not found');
    }

    // Check how old the location is
    const locationAge = Date.now() - new Date(location.created_at).getTime();
    const isStale = locationAge > 5 * 60 * 1000; // 5 minutes

    res.json({
      success: true,
      data: {
        location: {
          id: location.id,
          userId: targetUserId,
          userName: location.tourists?.name,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          batteryLevel: location.battery_level,
          timestamp: location.created_at,
          isStale,
          ageMinutes: Math.round(locationAge / 60000)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/locations/nearby
 * @desc Get nearby tourists (for emergency clustering)
 * @access Private (Police/Admin)
 */
router.get('/nearby', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 1000 } = req.query; // radius in meters
    const userRole = req.user.role;

    if (!['police', 'admin'].includes(userRole)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    if (!latitude || !longitude) {
      throw new ApiError(400, 'Latitude and longitude are required');
    }

    // Find tourists within the specified radius
    const { data: nearbyTourists, error } = await supabase
      .rpc('get_nearby_tourists', {
        center_lat: Number(latitude),
        center_lng: Number(longitude),
        radius_meters: Number(radius)
      });

    if (error) {
      logger.error('Failed to get nearby tourists:', error);
      throw new ApiError(500, 'Failed to get nearby tourists');
    }

    res.json({
      success: true,
      data: {
        tourists: nearbyTourists?.map((tourist: any) => ({
          id: tourist.user_id,
          name: tourist.name,
          latitude: tourist.latitude,
          longitude: tourist.longitude,
          distance: tourist.distance,
          lastSeen: tourist.last_location_time,
          status: tourist.status
        })) || [],
        searchCenter: {
          latitude: Number(latitude),
          longitude: Number(longitude)
        },
        searchRadius: Number(radius)
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/locations/emergency-share
 * @desc Share location with emergency contacts
 * @access Private (Tourist)
 */
router.post('/emergency-share', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get user's current location and emergency contacts
    const [{ data: location }, { data: user }] = await Promise.all([
      supabase
        .from('locations')
        .select('latitude, longitude, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('tourists')
        .select('name, emergency_contact')
        .eq('id', userId)
        .single()
    ]);

    if (!location || !user?.emergency_contact) {
      throw new ApiError(400, 'Location or emergency contact not available');
    }

    // Create sharing record
    const { data: shareRecord, error } = await supabase
      .from('location_shares')
      .insert({
        user_id: userId,
        shared_with: user.emergency_contact.name,
        contact_phone: user.emergency_contact.phone,
        latitude: location.latitude,
        longitude: location.longitude,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to create location share');
    }

    // Send SMS/notification to emergency contact (implementation depends on SMS service)
    // This would typically integrate with services like Twilio, AWS SNS, etc.
    
    logger.info(`Location shared by user ${userId} with emergency contact`);

    res.json({
      success: true,
      data: {
        shareId: shareRecord.id,
        sharedWith: shareRecord.shared_with,
        location: {
          latitude: shareRecord.latitude,
          longitude: shareRecord.longitude
        },
        expiresAt: shareRecord.expires_at
      },
      message: 'Location shared with emergency contact'
    });

  } catch (error) {
    next(error);
  }
});

export default router;