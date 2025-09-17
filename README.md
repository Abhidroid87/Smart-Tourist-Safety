# Smart Tourist Safety - Fullstack Hackathon Starter

A comprehensive fullstack monitoring and incident response system for tourist safety, built with modern web technologies, AI integration, and blockchain anchoring.

## 🏗️ Architecture Overview

```
smart-tourist-safety/
├── apps/
│   ├── backend/           # Node.js + TypeScript API server
│   ├── web-dashboard/     # React admin dashboard
│   └── mobile/           # React Native (Expo) tourist app
├── services/
│   └── rag/             # AI/RAG microservice
├── scripts/
│   └── blockchain/      # Blockchain anchoring utilities
├── supabase/
│   ├── migrations/      # Database schema
│   └── seed.sql        # Sample data
└── docker/             # Container configurations
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Docker & Docker Compose
- Supabase CLI (optional for local development)
- Expo CLI (for mobile development)

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd smart-tourist-safety
pnpm install

# Copy environment variables
cp .env.example .env

# Start development services
docker-compose up -d
pnpm dev
```

### Environment Setup

1. **Supabase Setup**:
   - Create a new Supabase project
   - Enable PostGIS extension
   - Run migrations: `supabase db push`
   - Add environment variables to `.env`

2. **API Keys**:
   - Google Maps API key with Places/Geocoding
   - OpenAI API key for RAG service
   - FCM server key for push notifications
   - Blockchain testnet RPC URL

## 📱 Core Features

### 1. Mobile App (Tourist Experience)
- **Digital ID & Registration**: Secure tourist onboarding
- **Panic Button**: One-tap emergency alert with location
- **Geofence Monitoring**: Automatic alerts for restricted areas
- **AI Place Cards**: Context-aware location information
- **Real-time Tracking**: Optional location sharing with authorities

### 2. Web Dashboard (Monitoring)
- **Live Tourist Map**: Real-time location clustering
- **Alert Management**: Incident response and escalation
- **Geofence Administration**: Create and manage safety zones
- **Analytics**: Tourist flow patterns and safety metrics
- **Blockchain Verification**: Audit trail for critical incidents

### 3. Backend Services
- **RESTful API**: Tourist registration, alerts, location tracking
- **Real-time Subscriptions**: WebSocket connections for live updates
- **RAG Service**: AI-powered incident analysis and place information
- **Blockchain Anchoring**: Immutable record keeping for critical events

## 🛠️ Development

### Running Services Individually

```bash
# Backend API (Port 3001)
pnpm --filter backend dev

# Web Dashboard (Port 3000)
pnpm --filter web-dashboard dev

# Mobile App
pnpm --filter mobile start

# RAG Service (Port 3002)
pnpm --filter rag-service dev
```

### Database Operations

```bash
# Run migrations
npx supabase db push

# Seed sample data
npx supabase db seed

# Reset database
npx supabase db reset
```

### Mobile Development

```bash
cd apps/mobile
npx expo start

# For physical device testing
npx expo start --tunnel
```

## 🗃️ Database Schema

### Core Tables

- **tourists**: User profiles with encrypted PII
- **locations**: GPS tracking with PostGIS geometries
- **alerts**: Panic button activations and incidents
- **geofences**: Safety zones with polygon boundaries
- **places**: POI data with AI-generated descriptions
- **blockchain_anchors**: Hash records for critical events

### Security Features

- Row Level Security (RLS) on all tables
- Encrypted PII fields using Supabase Vault
- Role-based access control (tourist/police/admin)
- Audit logging for sensitive operations

## 🤖 AI & RAG Pipeline

The RAG service provides:

1. **Vector Embeddings**: Place descriptions and incident reports
2. **Semantic Search**: Context-aware information retrieval
3. **LLM Generation**: Dynamic place cards and incident summaries
4. **Multilingual Support**: Tourist-friendly content in multiple languages

### RAG Workflow

```
User Query → Embedding → Vector Search → Context Retrieval → LLM Response
```

## ⛓️ Blockchain Integration

### Anchoring Process

1. **Event Trigger**: Critical alert or incident
2. **Hash Generation**: SHA-256 of event metadata
3. **Blockchain Write**: Hash stored on Polygon Mumbai testnet
4. **Verification**: Transaction ID stored for audit trail

### Supported Networks

- Polygon Mumbai (Testnet)
- Ganache (Local development)
- Ethereum Sepolia (Alternative testnet)

## 📍 Geofencing & Maps

### Features

- **Google Maps Integration**: Satellite imagery and street view
- **Geofence Visualization**: Color-coded safety zones
- **Tourist Clustering**: Privacy-preserving location aggregation
- **AI Place Cards**: Context-aware location information
- **Heatmap Analytics**: Tourist flow patterns

### Geofence Types

- 🔴 **Restricted Areas**: Government/military zones
- 🟡 **High-Risk Trails**: Adventure tourism warnings
- 🟢 **Safe Zones**: Tourist-friendly areas
- 🔵 **Emergency Assembly**: Evacuation points

## 🚨 Alert System

### Alert Types

1. **Panic Button**: Manual emergency activation
2. **Geofence Breach**: Automatic restricted area alerts
3. **Anomaly Detection**: Unusual behavior patterns
4. **Health Emergency**: Medical assistance requests

### Response Workflow

```
Alert Triggered → Location Captured → Authorities Notified → 
Response Dispatched → Blockchain Anchored → Resolution Logged
```

## 🔒 Security & Privacy

### Data Protection

- **Encryption at Rest**: AES-256 for PII fields
- **API Security**: JWT tokens with role-based claims
- **Network Security**: HTTPS/WSS for all communications
- **Audit Logging**: Comprehensive activity tracking

### Privacy Controls

- **Consent Management**: Granular tracking permissions
- **Data Minimization**: Only necessary data collection
- **Right to Deletion**: GDPR-compliant data removal
- **Anonymization**: Tourist identity protection in analytics

## 📊 Monitoring & Analytics

### Dashboard Metrics

- Active tourists and alert response times
- Geofence breach patterns and hotspot analysis
- System health and API performance metrics
- Blockchain anchoring success rates

### Alerting

- Real-time notifications for critical incidents
- Performance monitoring and system alerts
- Automated escalation for unacknowledged emergencies

## 🚀 Deployment

### Production Deployment

```bash
# Build all applications
pnpm build

# Deploy web dashboard (Vercel)
pnpm deploy:web

# Deploy backend (Render/Railway)
pnpm deploy:backend

# Build mobile app
pnpm deploy:mobile
```

### Environment Configuration

#### Production Variables
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# External APIs
GOOGLE_MAPS_API_KEY=your-google-maps-key
OPENAI_API_KEY=your-openai-key
FCM_SERVER_KEY=your-fcm-key

# Blockchain
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
PRIVATE_KEY=your-wallet-private-key

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-key
```

## 🧪 Demo Script

### 1. Tourist Registration
```bash
# Register a new tourist
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tourist@example.com","name":"John Doe","country":"USA"}'
```

### 2. Panic Button Simulation
```bash
# Trigger panic alert
curl -X POST http://localhost:3001/api/alerts/panic \
  -H "Authorization: Bearer <token>" \
  -d '{"lat":28.6139,"lng":77.2090,"message":"Emergency assistance needed"}'
```

### 3. Dashboard Monitoring
- Open `http://localhost:3000`
- View live tourist map
- Monitor incoming alerts
- Track response times

### 4. Blockchain Verification
```bash
# Check blockchain anchor
curl http://localhost:3001/api/blockchain/verify/<alert_id>
```

## 🤝 Contributing

### Development Guidelines

1. **Code Standards**: ESLint + Prettier configuration
2. **Testing**: Jest for unit tests, Cypress for E2E
3. **Documentation**: JSDoc comments for all public APIs
4. **Git Workflow**: Feature branches with PR reviews

### Team Handoff

- **Architecture Docs**: `/docs/architecture.md`
- **API Documentation**: Auto-generated OpenAPI specs
- **Component Library**: Storybook for UI components
- **Database Docs**: Auto-generated schema documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For hackathon support and questions:
- **Technical Issues**: Check GitHub Issues
- **Setup Problems**: Review environment configuration
- **Feature Requests**: Submit enhancement proposals

---

**Built for hackathons, designed for production** 🚀