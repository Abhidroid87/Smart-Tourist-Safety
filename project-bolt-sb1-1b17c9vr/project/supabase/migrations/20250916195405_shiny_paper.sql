-- =====================================================
-- SEED DATA for Smart Tourist Safety System
-- =====================================================
-- This script creates sample data for development and demo purposes

-- Insert sample tourist users
INSERT INTO tourists (id, email, password_hash, name, country, phone_number, emergency_contact, role, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'john.tourist@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'John Smith', 'USA', '+1-555-0101', '{"name": "Jane Smith", "phone": "+1-555-0102", "relationship": "spouse"}', 'tourist', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'maria.garcia@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Maria Garcia', 'Spain', '+34-600-123456', '{"name": "Carlos Garcia", "phone": "+34-600-654321", "relationship": "father"}', 'tourist', 'active'),
  ('550e8400-e29b-41d4-a716-446655440003', 'liu.wei@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Liu Wei', 'China', '+86-138-0013-8000', '{"name": "Liu Mei", "phone": "+86-138-0013-8001", "relationship": "sister"}', 'tourist', 'active'),
  ('550e8400-e29b-41d4-a716-446655440004', 'sarah.johnson@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Sarah Johnson', 'Canada', '+1-416-555-0123', '{"name": "Mike Johnson", "phone": "+1-416-555-0124", "relationship": "brother"}', 'tourist', 'active'),
  ('550e8400-e29b-41d4-a716-446655440005', 'raj.patel@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Raj Patel', 'India', '+91-98765-43210', '{"name": "Priya Patel", "phone": "+91-98765-43211", "relationship": "wife"}', 'tourist', 'active'),
  -- Police/Admin users
  ('550e8400-e29b-41d4-a716-446655440006', 'officer.delhi@police.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Officer Sharma', 'India', '+91-11-1234-5678', '{"name": "Control Room", "phone": "100", "relationship": "headquarters"}', 'police', 'active'),
  ('550e8400-e29b-41d4-a716-446655440007', 'admin.safety@tourism.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewRuE2wjyA5b/0V.', 'Tourism Admin', 'India', '+91-11-2345-6789', '{"name": "Tourism Ministry", "phone": "+91-11-2345-6700", "relationship": "department"}', 'admin', 'active');

-- Insert sample locations for tourists (Delhi area)
INSERT INTO locations (user_id, latitude, longitude, location, accuracy, speed, created_at) VALUES
  -- John Smith locations (around Red Fort area)
  ('550e8400-e29b-41d4-a716-446655440001', 28.6562, 77.2410, ST_SetSRID(ST_MakePoint(77.2410, 28.6562), 4326), 10, 1.5, now() - interval '5 minutes'),
  ('550e8400-e29b-41d4-a716-446655440001', 28.6560, 77.2412, ST_SetSRID(ST_MakePoint(77.2412, 28.6560), 4326), 8, 0.8, now() - interval '10 minutes'),
  
  -- Maria Garcia locations (around India Gate)
  ('550e8400-e29b-41d4-a716-446655440002', 28.6129, 77.2295, ST_SetSRID(ST_MakePoint(77.2295, 28.6129), 4326), 12, 2.1, now() - interval '3 minutes'),
  ('550e8400-e29b-41d4-a716-446655440002', 28.6125, 77.2290, ST_SetSRID(ST_MakePoint(77.2290, 28.6125), 4326), 15, 1.8, now() - interval '8 minutes'),
  
  -- Liu Wei locations (around Lotus Temple)
  ('550e8400-e29b-41d4-a716-446655440003', 28.5535, 77.2588, ST_SetSRID(ST_MakePoint(77.2588, 28.5535), 4326), 9, 0.5, now() - interval '2 minutes'),
  
  -- Sarah Johnson locations (around Connaught Place)
  ('550e8400-e29b-41d4-a716-446655440004', 28.6315, 77.2167, ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326), 11, 3.2, now() - interval '1 minute'),
  
  -- Raj Patel locations (around Chandni Chowk)
  ('550e8400-e29b-41d4-a716-446655440005', 28.6506, 77.2324, ST_SetSRID(ST_MakePoint(77.2324, 28.6506), 4326), 14, 0.3, now() - interval '4 minutes');

-- Insert sample geofences (Delhi area)
INSERT INTO geofences (id, name, description, type, geometry, is_active, created_by) VALUES
  -- Red Fort - Tourist Safe Zone
  ('660e8400-e29b-41d4-a716-446655440001', 'Red Fort Tourist Zone', 'Safe area around Red Fort with tourist police presence', 'safe', 
   ST_SetSRID(ST_GeomFromText('POLYGON((77.2380 28.6540, 77.2440 28.6540, 77.2440 28.6580, 77.2380 28.6580, 77.2380 28.6540))'), 4326),
   true, '550e8400-e29b-41d4-a716-446655440006'),
   
  -- Restricted Military Area
  ('660e8400-e29b-41d4-a716-446655440002', 'Restricted Military Zone', 'High security area - tourists not permitted', 'restricted',
   ST_SetSRID(ST_GeomFromText('POLYGON((77.2100 28.6000, 77.2150 28.6000, 77.2150 28.6050, 77.2100 28.6050, 77.2100 28.6000))'), 4326),
   true, '550e8400-e29b-41d4-a716-446655440006'),
   
  -- India Gate Emergency Assembly Point
  ('660e8400-e29b-41d4-a716-446655440003', 'India Gate Emergency Assembly', 'Emergency evacuation and assembly point', 'emergency',
   ST_SetSRID(ST_GeomFromText('POLYGON((77.2270 28.6110, 77.2320 28.6110, 77.2320 28.6150, 77.2270 28.6150, 77.2270 28.6110))'), 4326),
   true, '550e8400-e29b-41d4-a716-446655440006'),
   
  -- Chandni Chowk High Crime Warning
  ('660e8400-e29b-41d4-a716-446655440004', 'Chandni Chowk Pickpocket Alert', 'High pickpocket activity area - extra caution advised', 'warning',
   ST_SetSRID(ST_GeomFromText('POLYGON((77.2300 28.6480, 77.2350 28.6480, 77.2350 28.6520, 77.2300 28.6520, 77.2300 28.6480))'), 4326),
   true, '550e8400-e29b-41d4-a716-446655440006'),
   
  -- Connaught Place Safe Zone
  ('660e8400-e29b-41d4-a716-446655440005', 'Connaught Place Safe Zone', 'Well-monitored tourist area with CCTV coverage', 'safe',
   ST_SetSRID(ST_GeomFromText('POLYGON((77.2140 28.6290, 77.2190 28.6290, 77.2190 28.6340, 77.2140 28.6340, 77.2140 28.6290))'), 4326),
   true, '550e8400-e29b-41d4-a716-446655440007');

-- Insert sample places of interest
INSERT INTO places (id, name, description, ai_description, category, latitude, longitude, location, rating, safety_score) VALUES
  -- Historical Monuments
  ('770e8400-e29b-41d4-a716-446655440001', 'Red Fort (Lal Qila)', 'Historic fortified palace of Mughal emperors', 
   'The Red Fort is a magnificent example of Mughal architecture and a UNESCO World Heritage Site. Built in the 17th century, it features impressive red sandstone walls and beautiful gardens. The fort is generally safe for tourists with regular police patrols and CCTV surveillance. Best visited during morning hours to avoid crowds.', 
   'Historical Monument', 28.6562, 77.2410, ST_SetSRID(ST_MakePoint(77.2410, 28.6562), 4326), 4.5, 0.85),
   
  ('770e8400-e29b-41d4-a716-446655440002', 'India Gate', 'War memorial and iconic landmark', 
   'India Gate is a prominent landmark and war memorial honoring Indian soldiers. The area is spacious and well-maintained with good lighting and security. Popular for evening walks and picnics. Generally very safe with regular patrolling, but be cautious of pickpockets in crowded areas during festivals and events.', 
   'Monument', 28.6129, 77.2295, ST_SetSRID(ST_MakePoint(77.2295, 28.6129), 4326), 4.3, 0.90),
   
  -- Religious Sites
  ('770e8400-e29b-41d4-a716-446655440003', 'Lotus Temple', 'Bahá\'í House of Worship known for its lotus flower shape', 
   'The Lotus Temple is an architectural marvel and peaceful spiritual site. The temple maintains high safety standards with security personnel and bag checks at entry. The surrounding gardens are well-maintained and safe. Shoes must be removed before entering, and silence is maintained inside. Very safe for tourists of all backgrounds.', 
   'Religious Site', 28.5535, 77.2588, ST_SetSRID(ST_MakePoint(77.2588, 28.5535), 4326), 4.6, 0.92),
   
  -- Markets
  ('770e8400-e29b-41d4-a716-446655440004', 'Chandni Chowk', 'Historic market and food street', 
   'Chandni Chowk is one of Delhi\'s oldest and busiest markets offering traditional foods, jewelry, and textiles. While culturally rich, the area can be crowded and chaotic. Pickpocketing is common, so keep valuables secure. Traffic is heavy with narrow lanes. Best visited with a guide and during daytime hours. Stay alert and avoid displaying expensive items.', 
   'Market', 28.6506, 77.2324, ST_SetSRID(ST_MakePoint(77.2324, 28.6506), 4326), 4.0, 0.65),
   
  -- Shopping Areas
  ('770e8400-e29b-41d4-a716-446655440005', 'Connaught Place', 'Central business and shopping district', 
   'Connaught Place is Delhi\'s premier shopping and business hub with modern amenities and good infrastructure. The area is well-policed with CCTV coverage and is generally safe for tourists. Good restaurants, cafes, and shops are available. The circular design can be confusing, so use landmarks for navigation. Safe for evening visits with adequate lighting.', 
   'Shopping District', 28.6315, 77.2167, ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326), 4.2, 0.88);

-- Insert sample alerts (mix of resolved and active)
INSERT INTO alerts (id, user_id, type, severity, status, latitude, longitude, location, message, created_at, updated_at, resolved_at) VALUES
  -- Resolved alerts
  ('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'panic', 'high', 'resolved', 
   28.6562, 77.2410, ST_SetSRID(ST_MakePoint(77.2410, 28.6562), 4326), 
   'Lost my group near Red Fort, feeling unsafe in the crowd', 
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour'),
   
  ('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'medical', 'medium', 'resolved', 
   28.5535, 77.2588, ST_SetSRID(ST_MakePoint(77.2588, 28.5535), 4326), 
   'Feeling dizzy due to heat, need medical assistance', 
   now() - interval '4 hours', now() - interval '3 hours', now() - interval '3 hours'),
   
  -- Active alerts
  ('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'security', 'medium', 'investigating', 
   28.6506, 77.2324, ST_SetSRID(ST_MakePoint(77.2324, 28.6506), 4326), 
   'Someone trying to overcharge and being aggressive at market', 
   now() - interval '30 minutes', now() - interval '20 minutes', null),
   
  ('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'geofence_violation', 'low', 'active', 
   77.2125, 28.6025, ST_SetSRID(ST_MakePoint(77.2125, 28.6025), 4326), 
   'Entered restricted area: Restricted Military Zone', 
   now() - interval '15 minutes', now() - interval '15 minutes', null);

-- Insert sample refresh tokens (for testing auth)
INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'refresh_token_john_' || extract(epoch from now()), now() + interval '7 days'),
  ('550e8400-e29b-41d4-a716-446655440002', 'refresh_token_maria_' || extract(epoch from now()), now() + interval '7 days'),
  ('550e8400-e29b-41d4-a716-446655440006', 'refresh_token_officer_' || extract(epoch from now()), now() + interval '7 days');

-- Insert sample blockchain anchors
INSERT INTO blockchain_anchors (reference_type, reference_id, hash, transaction_hash, network, block_number) VALUES
  ('alert', '880e8400-e29b-41d4-a716-446655440001', 
   '0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', 
   '0x1234567890abcdef1234567890abcdef12345678', 'polygon-mumbai', 45123456),
  ('alert', '880e8400-e29b-41d4-a716-446655440002', 
   '0xb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', 
   '0x234567890abcdef1234567890abcdef123456789', 'polygon-mumbai', 45123457);

-- Insert sample location shares
INSERT INTO location_shares (user_id, shared_with, contact_phone, latitude, longitude, expires_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Jane Smith', '+1-555-0102', 28.6562, 77.2410, now() + interval '12 hours'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Liu Mei', '+86-138-0013-8001', 28.5535, 77.2588, now() + interval '6 hours');

-- Insert sample RAG conversations
INSERT INTO rag_conversations (conversation_id, user_message, ai_response, context) VALUES
  ('conv_demo_001', 'Is Red Fort safe to visit?', 
   'Red Fort is generally very safe for tourists. It''s a UNESCO World Heritage Site with regular security patrols and CCTV surveillance. The area is well-maintained and has tourist police presence. Best time to visit is during morning hours (9 AM - 11 AM) to avoid crowds. Keep your belongings secure and follow the designated paths for the best experience.',
   '{"location": {"name": "Red Fort", "latitude": 28.6562, "longitude": 77.2410}, "safety_score": 0.85}'),
   
  ('conv_demo_002', 'What should I do if I feel unsafe in Chandni Chowk?', 
   'If you feel unsafe in Chandni Chowk, here are immediate steps: 1) Move to a well-lit, crowded area with shops, 2) Contact tourist helpline at 1363, 3) Look for police personnel (they patrol regularly), 4) If you have our app, use the panic button to alert authorities with your location, 5) Keep your emergency contacts ready. The market can be overwhelming due to crowds and narrow lanes, but help is usually nearby.',
   '{"location": {"name": "Chandni Chowk", "latitude": 28.6506, "longitude": 77.2324}, "safety_score": 0.65, "emergency_contacts": ["1363", "100"]}');

-- =====================================================
-- DEMO DATA SUMMARY
-- =====================================================

-- Print summary of seeded data
DO $$
DECLARE
  tourist_count INTEGER;
  location_count INTEGER;
  alert_count INTEGER;
  geofence_count INTEGER;
  place_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tourist_count FROM tourists;
  SELECT COUNT(*) INTO location_count FROM locations;
  SELECT COUNT(*) INTO alert_count FROM alerts;
  SELECT COUNT(*) INTO geofence_count FROM geofences;
  SELECT COUNT(*) INTO place_count FROM places;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'SEED DATA INSERTED SUCCESSFULLY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Tourists: % (5 tourists + 2 staff)', tourist_count;
  RAISE NOTICE 'Location Records: %', location_count;
  RAISE NOTICE 'Alerts: % (2 resolved + 2 active)', alert_count;
  RAISE NOTICE 'Geofences: % safety zones', geofence_count;
  RAISE NOTICE 'Places: % points of interest', place_count;
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Demo Login Credentials:';
  RAISE NOTICE 'Tourist: john.tourist@example.com / password123';
  RAISE NOTICE 'Police: officer.delhi@police.gov.in / password123';
  RAISE NOTICE 'Admin: admin.safety@tourism.gov.in / password123';
  RAISE NOTICE '==========================================';
END $$;