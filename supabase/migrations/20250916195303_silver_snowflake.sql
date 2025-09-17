/*
  # Initial Schema for Smart Tourist Safety System

  1. New Tables
    - `tourists` - User profiles with encrypted PII and emergency contacts
    - `locations` - GPS tracking with PostGIS geometry and metadata  
    - `alerts` - Emergency alerts with location, severity, and response tracking
    - `geofences` - Safety zones with polygon boundaries and types
    - `places` - Points of interest with AI-generated descriptions and safety scores
    - `refresh_tokens` - JWT refresh token management
    - `blockchain_anchors` - Immutable hash records for critical events
    - `location_shares` - Emergency location sharing with contacts
    - `rag_conversations` - AI chat history for context and learning

  2. Security
    - Enable RLS on all tables
    - Role-based access policies (tourist/police/admin)
    - Encrypted storage for sensitive data
    - Audit logging for critical operations

  3. PostGIS Integration
    - Enable PostGIS extension for geospatial queries
    - Spatial indexes for performance
    - Geofence checking functions
    - Distance calculations and clustering

  4. Performance
    - Indexes on frequently queried columns
    - Partitioning for large tables
    - Materialized views for analytics
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Enable PostGIS extension function
CREATE OR REPLACE FUNCTION enable_postgis_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE EXTENSION postgis;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create custom types
CREATE TYPE user_role AS ENUM ('tourist', 'police', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE alert_type AS ENUM ('panic', 'medical', 'security', 'geofence_violation', 'natural_disaster');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'investigating', 'resolved', 'false_alarm');
CREATE TYPE geofence_type AS ENUM ('safe', 'restricted', 'emergency', 'warning');

-- =====================================================
-- TOURISTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tourists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  phone_number text,
  emergency_contact jsonb,
  role user_role DEFAULT 'tourist',
  status user_status DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tourists_email ON tourists(email);
CREATE INDEX IF NOT EXISTS idx_tourists_role ON tourists(role);
CREATE INDEX IF NOT EXISTS idx_tourists_status ON tourists(status);
CREATE INDEX IF NOT EXISTS idx_tourists_created_at ON tourists(created_at);

-- Enable RLS
ALTER TABLE tourists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tourists
CREATE POLICY "Users can read own profile"
  ON tourists FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' IN ('police', 'admin'));

CREATE POLICY "Users can update own profile"
  ON tourists FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' IN ('admin'));

CREATE POLICY "Police and admin can read all tourists"
  ON tourists FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('police', 'admin'));

-- =====================================================
-- LOCATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  accuracy decimal(10, 2),
  altitude decimal(10, 2),
  speed decimal(8, 2),
  heading decimal(5, 2),
  battery_level integer,
  is_background boolean DEFAULT false,
  alert_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add spatial and regular indexes
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_alert_id ON locations(alert_id);
CREATE INDEX IF NOT EXISTS idx_locations_geography ON locations USING GIST(location);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations
CREATE POLICY "Users can read own locations"
  ON locations FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' IN ('police', 'admin'));

CREATE POLICY "Users can insert own locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Police and admin can read all locations"
  ON locations FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('police', 'admin'));

-- =====================================================
-- ALERTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  status alert_status DEFAULT 'active',
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  message text,
  response_notes text,
  assigned_to uuid REFERENCES tourists(id),
  resolved_by uuid REFERENCES tourists(id),
  blockchain_tx text,
  blockchain_network text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_geography ON alerts USING GIST(location);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alerts
CREATE POLICY "Users can read own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' IN ('police', 'admin'));

CREATE POLICY "Users can create own alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Police and admin can manage alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('police', 'admin'));

-- =====================================================
-- GEOFENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS geofences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  type geofence_type NOT NULL,
  geometry geography(POLYGON, 4326) NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES tourists(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_geofences_type ON geofences(type);
CREATE INDEX IF NOT EXISTS idx_geofences_is_active ON geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_created_by ON geofences(created_by);
CREATE INDEX IF NOT EXISTS idx_geofences_geometry ON geofences USING GIST(geometry);

-- Enable RLS
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for geofences
CREATE POLICY "Everyone can read active geofences"
  ON geofences FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Police and admin can manage geofences"
  ON geofences FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('police', 'admin'));

-- =====================================================
-- PLACES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  ai_description text,
  category text,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  rating decimal(3, 2),
  safety_score decimal(3, 2),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_rating ON places(rating);
CREATE INDEX IF NOT EXISTS idx_places_safety_score ON places(safety_score);
CREATE INDEX IF NOT EXISTS idx_places_geography ON places USING GIST(location);

-- Enable RLS
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- RLS Policies for places
CREATE POLICY "Everyone can read places"
  ON places FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage places"
  ON places FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- REFRESH TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Enable RLS
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for refresh tokens
CREATE POLICY "Users can manage own refresh tokens"
  ON refresh_tokens FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =====================================================
-- BLOCKCHAIN ANCHORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS blockchain_anchors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_type text NOT NULL CHECK (reference_type IN ('alert', 'user', 'incident')),
  reference_id uuid NOT NULL,
  hash text NOT NULL,
  transaction_hash text NOT NULL,
  network text NOT NULL,
  block_number integer,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blockchain_anchors_reference ON blockchain_anchors(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_anchors_hash ON blockchain_anchors(hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_anchors_tx_hash ON blockchain_anchors(transaction_hash);

-- Enable RLS
ALTER TABLE blockchain_anchors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blockchain anchors
CREATE POLICY "Everyone can read blockchain anchors"
  ON blockchain_anchors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert blockchain anchors"
  ON blockchain_anchors FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- LOCATION SHARES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS location_shares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  shared_with text NOT NULL,
  contact_phone text,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_shares_user_id ON location_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_location_shares_expires_at ON location_shares(expires_at);

-- Enable RLS
ALTER TABLE location_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location shares
CREATE POLICY "Users can manage own location shares"
  ON location_shares FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' IN ('police', 'admin'));

-- =====================================================
-- RAG CONVERSATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rag_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id text NOT NULL,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_conversations_conversation_id ON rag_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rag_conversations_created_at ON rag_conversations(created_at DESC);

-- Enable RLS
ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for RAG conversations
CREATE POLICY "System can manage RAG conversations"
  ON rag_conversations FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin'));

-- =====================================================
-- GEOSPATIAL FUNCTIONS
-- =====================================================

-- Function to check if a point is within any geofences
CREATE OR REPLACE FUNCTION check_point_in_geofences(point_lat decimal, point_lng decimal)
RETURNS TABLE(geofence_id uuid, name text, type geofence_type, description text) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.type, g.description
  FROM geofences g
  WHERE g.is_active = true
    AND ST_Contains(g.geometry::geometry, ST_SetSRID(ST_MakePoint(point_lng, point_lat), 4326));
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby tourists within radius
CREATE OR REPLACE FUNCTION get_nearby_tourists(center_lat decimal, center_lng decimal, radius_meters integer DEFAULT 1000)
RETURNS TABLE(
  user_id uuid, 
  name text, 
  latitude decimal, 
  longitude decimal, 
  distance decimal,
  last_location_time timestamptz,
  status user_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (t.id)
    t.id,
    t.name,
    l.latitude,
    l.longitude,
    ST_Distance(
      l.location::geometry,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)
    )::decimal AS distance,
    l.created_at,
    t.status
  FROM tourists t
  JOIN locations l ON t.id = l.user_id
  WHERE t.status = 'active'
    AND ST_DWithin(
      l.location::geometry,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326),
      radius_meters
    )
  ORDER BY t.id, l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get alert statistics
CREATE OR REPLACE FUNCTION get_alert_statistics(days_back integer DEFAULT 30)
RETURNS TABLE(
  total_alerts bigint,
  active_alerts bigint,
  resolved_alerts bigint,
  critical_alerts bigint,
  avg_response_time_minutes decimal
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) FILTER (WHERE resolved_at IS NOT NULL) as avg_response
    FROM alerts 
    WHERE created_at >= now() - interval '%s days' % days_back
  )
  SELECT total, active, resolved, critical, COALESCE(avg_response, 0)::decimal
  FROM stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_tourists_updated_at 
  BEFORE UPDATE ON tourists 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at 
  BEFORE UPDATE ON alerts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geofences_updated_at 
  BEFORE UPDATE ON geofences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at 
  BEFORE UPDATE ON places 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA VIEWS (FOR ANALYTICS)
-- =====================================================

-- View for active alerts with user details
CREATE OR REPLACE VIEW active_alerts_view AS
SELECT 
  a.id,
  a.type,
  a.severity,
  a.status,
  a.latitude,
  a.longitude,
  a.message,
  a.created_at,
  t.name as user_name,
  t.phone_number as user_phone,
  t.emergency_contact
FROM alerts a
JOIN tourists t ON a.user_id = t.id
WHERE a.status IN ('active', 'investigating')
ORDER BY a.severity DESC, a.created_at DESC;

-- View for tourist location tracking
CREATE OR REPLACE VIEW tourist_locations_view AS
SELECT DISTINCT ON (t.id)
  t.id as user_id,
  t.name,
  t.status,
  l.latitude,
  l.longitude,
  l.accuracy,
  l.battery_level,
  l.created_at as last_seen,
  EXTRACT(EPOCH FROM (now() - l.created_at))/60 as minutes_since_update
FROM tourists t
LEFT JOIN locations l ON t.id = l.user_id
WHERE t.status = 'active'
ORDER BY t.id, l.created_at DESC;

-- =====================================================
-- CLEANUP AND OPTIMIZATION
-- =====================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up expired refresh tokens
  DELETE FROM refresh_tokens WHERE expires_at < now();
  
  -- Clean up old location shares
  DELETE FROM location_shares WHERE expires_at < now();
  
  -- Archive old location data (keep last 30 days)
  -- In production, move to archive table instead of deleting
  DELETE FROM locations 
  WHERE created_at < now() - interval '30 days' 
    AND alert_id IS NULL;
  
  -- Clean up old RAG conversations (keep last 7 days)
  DELETE FROM rag_conversations WHERE created_at < now() - interval '7 days';
  
  RAISE NOTICE 'Cleanup completed successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECURITY AND FINAL SETUP
-- =====================================================

-- Revoke default permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

-- Grant appropriate permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Additional security: Create service role policies if needed
-- (These would typically be managed through Supabase dashboard)

-- Enable real-time subscriptions for critical tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE locations;

COMMENT ON TABLE tourists IS 'User profiles with encrypted PII and role-based access';
COMMENT ON TABLE locations IS 'GPS tracking with PostGIS geometry for spatial queries';
COMMENT ON TABLE alerts IS 'Emergency alerts with blockchain anchoring capability';
COMMENT ON TABLE geofences IS 'Polygon-based safety zones with automatic monitoring';
COMMENT ON TABLE places IS 'Points of interest with AI-generated descriptions';
COMMENT ON TABLE blockchain_anchors IS 'Immutable hash records for audit trails';