import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import embeddingRoutes from './routes/embeddings';
import placeRoutes from './routes/places';
import incidentRoutes from './routes/incidents';
import chatRoutes from './routes/chat';

// Import services
import { logger } from './utils/logger';
import { initializeVectorDatabase } from './services/vectorDatabase';
import { errorHandler } from './middleware/errorHandler';
import { validateApiKey } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.RAG_SERVICE_PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      vectorDatabase: 'connected',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured'
    }
  });
});

// API routes
app.use('/api/embeddings', validateApiKey, embeddingRoutes);
app.use('/api/places', validateApiKey, placeRoutes);
app.use('/api/incidents', validateApiKey, incidentRoutes);
app.use('/api/chat', validateApiKey, chatRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize vector database
    await initializeVectorDatabase();
    logger.info('Vector database initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🤖 RAG Service running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🧠 AI Model: ${process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'}`);
      logger.info(`📊 Vector Database: ${process.env.VECTOR_DB_TYPE || 'supabase'}`);
    });

  } catch (error) {
    logger.error('Failed to start RAG service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;