import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth';
import touristRoutes from './routes/tourist';
import locationRoutes from './routes/location';
import alertRoutes from './routes/alerts';
import geofenceRoutes from './routes/geofence';
import blockchainRoutes from './routes/blockchain';
import placesRoutes from './routes/places';

// Import services
import { initializeSocketIO } from './services/socketService';
import { initializeDatabase } from './config/database';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tourists', authMiddleware, touristRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/alerts', authMiddleware, alertRoutes);
app.use('/api/geofences', authMiddleware, geofenceRoutes);
app.use('/api/blockchain', authMiddleware, blockchainRoutes);
app.use('/api/places', authMiddleware, placesRoutes);

// WebSocket initialization
initializeSocketIO(io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize services
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Smart Tourist Safety Backend running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 WebSocket server initialized`);
      logger.info(`🔒 Security middleware enabled`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

export { app, io };