import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

// Create Supabase client with service role key for server operations
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create client with anon key for user operations (when needed)
export const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Database connection test and initialization
export async function initializeDatabase(): Promise<void> {
  try {
    // Test the connection with a simple query
    const { data, error } = await supabase
      .from('tourists')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    logger.info('✅ Database connection successful');

    // Initialize PostGIS extension if not already enabled
    const { error: postgisError } = await supabase
      .rpc('enable_postgis_if_not_exists');

    if (postgisError) {
      logger.warn('PostGIS extension check failed:', postgisError.message);
    } else {
      logger.info('✅ PostGIS extension verified');
    }

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Types for better TypeScript support
export interface DatabaseTables {
  tourists: {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    country: string;
    phone_number?: string;
    emergency_contact?: {
      name: string;
      phone: string;
      relationship: string;
    };
    role: 'tourist' | 'police' | 'admin';
    status: 'active' | 'inactive' | 'suspended';
    created_at: string;
    updated_at: string;
    last_login?: string;
  };
  locations: {
    id: string;
    user_id: string;
    latitude: number;
    longitude: number;
    location: string; // PostGIS POINT
    accuracy?: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    battery_level?: number;
    is_background: boolean;
    alert_id?: string;
    created_at: string;
  };
  alerts: {
    id: string;
    user_id: string;
    type: 'panic' | 'medical' | 'security' | 'geofence_violation' | 'natural_disaster';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'active' | 'investigating' | 'resolved' | 'false_alarm';
    latitude: number;
    longitude: number;
    location: string; // PostGIS POINT
    message?: string;
    response_notes?: string;
    assigned_to?: string;
    resolved_by?: string;
    blockchain_tx?: string;
    blockchain_network?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
  };
  geofences: {
    id: string;
    name: string;
    description?: string;
    type: 'safe' | 'restricted' | 'emergency' | 'warning';
    geometry: string; // PostGIS POLYGON
    is_active: boolean;
    created_by: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
  };
  places: {
    id: string;
    name: string;
    description?: string;
    ai_description?: string;
    category: string;
    latitude: number;
    longitude: number;
    location: string; // PostGIS POINT
    rating?: number;
    safety_score?: number;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
  };
  refresh_tokens: {
    id: string;
    user_id: string;
    token: string;
    expires_at: string;
    created_at: string;
  };
  blockchain_anchors: {
    id: string;
    reference_type: 'alert' | 'user' | 'incident';
    reference_id: string;
    hash: string;
    transaction_hash: string;
    network: string;
    block_number?: number;
    created_at: string;
  };
}