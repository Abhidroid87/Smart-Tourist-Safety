import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export interface GeofenceViolation {
  id: string;
  name: string;
  type: 'safe' | 'restricted' | 'emergency' | 'warning';
  description?: string;
}

/**
 * Check if a location is within any active geofences
 */
export async function checkGeofences(
  latitude: number,
  longitude: number
): Promise<GeofenceViolation[]> {
  try {
    const { data: violations, error } = await supabase
      .rpc('check_point_in_geofences', {
        point_lat: latitude,
        point_lng: longitude
      });

    if (error) {
      logger.error('Geofence check failed:', error);
      return [];
    }

    return violations?.map((violation: any) => ({
      id: violation.geofence_id,
      name: violation.name,
      type: violation.type,
      description: violation.description
    })) || [];

  } catch (error) {
    logger.error('Geofence service error:', error);
    return [];
  }
}

/**
 * Create a new geofence
 */
export async function createGeofence(
  name: string,
  type: 'safe' | 'restricted' | 'emergency' | 'warning',
  coordinates: Array<[number, number]>, // [lat, lng] pairs
  description?: string,
  createdBy?: string
): Promise<string | null> {
  try {
    // Convert coordinates to PostGIS polygon format
    const polygonCoords = coordinates
      .map(([lat, lng]) => `${lng} ${lat}`)
      .join(', ');
    
    const polygonWKT = `POLYGON((${polygonCoords}, ${coordinates[0][1]} ${coordinates[0][0]}))`;

    const { data: geofence, error } = await supabase
      .from('geofences')
      .insert({
        name,
        type,
        description,
        geometry: polygonWKT,
        is_active: true,
        created_by: createdBy,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create geofence:', error);
      return null;
    }

    logger.info(`Geofence created: ${name} (${type})`);
    return geofence.id;

  } catch (error) {
    logger.error('Geofence creation error:', error);
    return null;
  }
}

/**
 * Get all active geofences for map display
 */
export async function getActiveGeofences(): Promise<any[]> {
  try {
    const { data: geofences, error } = await supabase
      .from('geofences')
      .select('id, name, type, description, geometry, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch geofences:', error);
      return [];
    }

    return geofences?.map(geofence => ({
      id: geofence.id,
      name: geofence.name,
      type: geofence.type,
      description: geofence.description,
      coordinates: parsePolygonCoordinates(geofence.geometry),
      createdAt: geofence.created_at
    })) || [];

  } catch (error) {
    logger.error('Get geofences error:', error);
    return [];
  }
}

/**
 * Parse PostGIS polygon coordinates to lat/lng format
 */
function parsePolygonCoordinates(geometry: string): Array<[number, number]> {
  try {
    // Simple parser for POLYGON((lng lat, lng lat, ...)) format
    const coords = geometry
      .replace('POLYGON((', '')
      .replace('))', '')
      .split(', ')
      .map(coord => {
        const [lng, lat] = coord.trim().split(' ').map(Number);
        return [lat, lng] as [number, number];
      });

    return coords.slice(0, -1); // Remove duplicate closing coordinate

  } catch (error) {
    logger.error('Failed to parse polygon coordinates:', error);
    return [];
  }
}