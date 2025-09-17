import React, { useState, useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../services/api';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AlertMapProps {
  height?: string;
  onAlertClick?: (alert: any) => void;
}

interface Alert {
  id: string;
  latitude: number;
  longitude: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  userName?: string;
  message?: string;
  createdAt: string;
}

interface Geofence {
  id: string;
  name: string;
  type: 'safe' | 'restricted' | 'emergency' | 'warning';
  coordinates: Array<[number, number]>;
}

function GoogleMapComponent({ 
  alerts, 
  geofences, 
  onAlertClick 
}: { 
  alerts: Alert[]; 
  geofences: Geofence[];
  onAlertClick?: (alert: Alert) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [polygons, setPolygons] = useState<google.maps.Polygon[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const newMap = new google.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.2090 }, // Delhi, India
      zoom: 12,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ],
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    setMap(newMap);
  }, []);

  // Update markers when alerts change
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    // Create new markers
    const newMarkers = alerts.map(alert => {
      const marker = new google.maps.Marker({
        position: { lat: alert.latitude, lng: alert.longitude },
        map,
        title: `${alert.type} Alert - ${alert.severity}`,
        icon: {
          url: getSeverityIcon(alert.severity),
          scaledSize: new google.maps.Size(40, 40)
        }
      });

      // Add click listener
      marker.addListener('click', () => {
        if (onAlertClick) {
          onAlertClick(alert);
        }
        
        // Show info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-3 min-w-[200px]">
              <div class="flex items-center space-x-2 mb-2">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadgeClass(alert.severity)}">
                  ${alert.severity.toUpperCase()}
                </span>
                <span class="text-sm text-gray-500">${alert.type}</span>
              </div>
              <h3 class="font-semibold text-gray-900 mb-1">${alert.userName || 'Unknown Tourist'}</h3>
              <p class="text-sm text-gray-600 mb-2">${alert.message || 'No message provided'}</p>
              <div class="text-xs text-gray-500">
                ${new Date(alert.createdAt).toLocaleString()}
              </div>
            </div>
          `
        });
        
        infoWindow.open(map, marker);
      });

      return marker;
    });

    setMarkers(newMarkers);
  }, [map, alerts, onAlertClick]);

  // Update geofences
  useEffect(() => {
    if (!map) return;

    // Clear existing polygons
    polygons.forEach(polygon => polygon.setMap(null));

    // Create new polygons
    const newPolygons = geofences.map(geofence => {
      const paths = geofence.coordinates.map(coord => ({
        lat: coord[0],
        lng: coord[1]
      }));

      const polygon = new google.maps.Polygon({
        paths,
        map,
        fillColor: getGeofenceColor(geofence.type),
        fillOpacity: 0.15,
        strokeColor: getGeofenceColor(geofence.type),
        strokeOpacity: 0.6,
        strokeWeight: 2
      });

      // Add click listener for geofence info
      polygon.addListener('click', (event: google.maps.PolyMouseEvent) => {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-3">
              <h3 class="font-semibold text-gray-900 mb-1">${geofence.name}</h3>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getGeofenceTypeClass(geofence.type)}">
                ${geofence.type.toUpperCase()}
              </span>
            </div>
          `,
          position: event.latLng
        });
        
        infoWindow.open(map);
      });

      return polygon;
    });

    setPolygons(newPolygons);
  }, [map, geofences]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

export default function AlertMap({ height = '500px', onAlertClick }: AlertMapProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    fetchMapData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time alert updates
    socket.on('new_alert', (newAlert: Alert) => {
      setAlerts(prev => [newAlert, ...prev]);
    });

    socket.on('alert_updated', (alertUpdate: any) => {
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertUpdate.id 
            ? { ...alert, ...alertUpdate }
            : alert
        )
      );
    });

    return () => {
      socket.off('new_alert');
      socket.off('alert_updated');
    };
  }, [socket]);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      const [alertsResponse, geofencesResponse] = await Promise.all([
        api.get('/alerts?status=active&limit=50'),
        api.get('/geofences')
      ]);

      setAlerts(alertsResponse.data.alerts);
      setGeofences(geofencesResponse.data.geofences || []);
    } catch (error) {
      console.error('Failed to fetch map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const render = (status: Status) => {
    if (status === Status.LOADING) {
      return (
        <div className="flex items-center justify-center" style={{ height }}>
          <LoadingSpinner />
        </div>
      );
    }

    if (status === Status.FAILURE) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height }}>
          <div className="text-center">
            <p className="text-red-600 font-medium">Failed to load map</p>
            <p className="text-sm text-gray-500 mt-1">Check your Google Maps API key</p>
          </div>
        </div>
      );
    }

    return (
      <GoogleMapComponent 
        alerts={alerts} 
        geofences={geofences}
        onAlertClick={onAlertClick}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden">
      <Wrapper 
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''} 
        render={render}
        libraries={['places']}
      />
    </div>
  );
}

// Helper functions
function getSeverityIcon(severity: string): string {
  const icons = {
    low: 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310B981"%3e%3ccircle cx="12" cy="12" r="10"/%3e%3c/svg%3e',
    medium: 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23F59E0B"%3e%3ccircle cx="12" cy="12" r="10"/%3e%3c/svg%3e',
    high: 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23EF4444"%3e%3ccircle cx="12" cy="12" r="10"/%3e%3c/svg%3e',
    critical: 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23DC2626"%3e%3ccircle cx="12" cy="12" r="10"/%3e%3c/svg%3e'
  };
  return icons[severity as keyof typeof icons] || icons.medium;
}

function getSeverityBadgeClass(severity: string): string {
  const classes = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
    critical: 'bg-red-200 text-red-900'
  };
  return classes[severity as keyof typeof classes] || classes.medium;
}

function getGeofenceColor(type: string): string {
  const colors = {
    safe: '#10B981',      // green
    restricted: '#EF4444', // red
    emergency: '#F59E0B',  // amber
    warning: '#8B5CF6'     // purple
  };
  return colors[type as keyof typeof colors] || colors.warning;
}

function getGeofenceTypeClass(type: string): string {
  const classes = {
    safe: 'bg-green-100 text-green-800',
    restricted: 'bg-red-100 text-red-800',
    emergency: 'bg-amber-100 text-amber-800',
    warning: 'bg-purple-100 text-purple-800'
  };
  return classes[type as keyof typeof classes] || classes.warning;
}