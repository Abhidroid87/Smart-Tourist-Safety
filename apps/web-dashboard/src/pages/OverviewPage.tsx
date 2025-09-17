import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Users, 
  MapPin, 
  Shield,
  Activity,
  Clock
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import AlertMap from '../components/maps/AlertMap';
import RecentAlerts from '../components/alerts/RecentAlerts';
import TouristClusters from '../components/tourists/TouristClusters';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalAlerts: number;
  activeAlerts: number;
  todayAlerts: number;
  criticalAlerts: number;
  averageResponseTimeMinutes: number;
  activeTourists?: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAlerts: 0,
    activeAlerts: 0,
    todayAlerts: 0,
    criticalAlerts: 0,
    averageResponseTimeMinutes: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time updates
    socket.on('new_alert', (alert) => {
      toast.error(`🚨 New ${alert.severity} alert from ${alert.userName}`, {
        duration: 8000
      });
      
      // Update stats
      setStats(prev => ({
        ...prev,
        activeAlerts: prev.activeAlerts + 1,
        todayAlerts: prev.todayAlerts + 1,
        criticalAlerts: alert.severity === 'critical' ? prev.criticalAlerts + 1 : prev.criticalAlerts
      }));

      // Add to recent alerts
      setRecentAlerts(prev => [alert, ...prev.slice(0, 4)]);
    });

    socket.on('alert_updated', (alertUpdate) => {
      if (alertUpdate.status === 'resolved') {
        setStats(prev => ({
          ...prev,
          activeAlerts: Math.max(0, prev.activeAlerts - 1)
        }));
      }
    });

    socket.on('geofence_violation', (violation) => {
      toast.warning(`⚠️ Geofence violation: ${violation.geofence.name}`, {
        duration: 6000
      });
    });

    return () => {
      socket.off('new_alert');
      socket.off('alert_updated');
      socket.off('geofence_violation');
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsResponse, alertsResponse] = await Promise.all([
        api.get('/alerts/stats/dashboard'),
        api.get('/alerts?limit=5')
      ]);

      setStats({
        ...statsResponse.data.statistics,
        activeTourists: 0 // TODO: Implement active tourists count
      });
      
      setRecentAlerts(alertsResponse.data.alerts);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Active Alerts',
      value: stats.activeAlerts,
      icon: AlertTriangle,
      color: 'red' as const,
      trend: stats.todayAlerts > 0 ? `+${stats.todayAlerts} today` : 'No new alerts today'
    },
    {
      title: 'Total Tourists',
      value: stats.activeTourists || 0,
      icon: Users,
      color: 'blue' as const,
      trend: 'Active users'
    },
    {
      title: 'Critical Alerts',
      value: stats.criticalAlerts,
      icon: Shield,
      color: 'orange' as const,
      trend: 'Requiring immediate attention'
    },
    {
      title: 'Avg Response Time',
      value: `${stats.averageResponseTimeMinutes}m`,
      icon: Clock,
      color: 'green' as const,
      trend: 'Last 30 days'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Real-time tourist safety monitoring</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 px-3 py-1 rounded-full">
          <Activity className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">System Online</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Live Alert Map</h2>
              </div>
            </div>
            <div className="p-6">
              <AlertMap height="400px" />
            </div>
          </div>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          {/* Recent Alerts */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Alerts</h2>
            </div>
            <RecentAlerts alerts={recentAlerts} />
          </div>

          {/* Tourist Clusters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Tourist Clusters</h2>
            </div>
            <TouristClusters />
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-3 rounded-lg transition-colors">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Create Alert</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-lg transition-colors">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium">Add Geofence</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-3 rounded-lg transition-colors">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">View Tourists</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-lg transition-colors">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">System Status</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}