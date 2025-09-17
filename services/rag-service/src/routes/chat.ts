import { Router } from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware/validation';
import { generateChatResponse } from '../services/chatService';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const chatRequestSchema = Joi.object({
  message: Joi.string().max(1000).required(),
  context: Joi.object({
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      name: Joi.string().optional()
    }).optional(),
    user: Joi.object({
      id: Joi.string(),
      name: Joi.string(),
      language: Joi.string().default('en')
    }).optional(),
    incident_id: Joi.string().uuid().optional()
  }).optional(),
  conversation_id: Joi.string().uuid().optional(),
  language: Joi.string().valid('en', 'es', 'fr', 'de', 'hi', 'zh').default('en')
});

/**
 * @route POST /api/chat
 * @desc Generate AI chat response with RAG context
 * @access Private (API Key required)
 */
router.post('/', validateRequest(chatRequestSchema), async (req, res, next) => {
  try {
    const { message, context, conversation_id, language } = req.body;

    logger.info('Chat request received:', {
      message: message.substring(0, 100) + '...',
      hasLocation: !!context?.location,
      language,
      conversationId: conversation_id
    });

    const response = await generateChatResponse({
      message,
      context,
      conversationId: conversation_id,
      language
    });

    res.json({
      success: true,
      data: {
        response: response.message,
        conversationId: response.conversationId,
        context: response.context,
        sources: response.sources,
        confidence: response.confidence,
        language: response.language,
        processingTime: response.processingTime
      }
    });

  } catch (error) {
    logger.error('Chat generation failed:', error);
    next(error);
  }
});

/**
 * @route POST /api/chat/place-info
 * @desc Get AI-generated place information
 * @access Private (API Key required)
 */
router.post('/place-info', async (req, res, next) => {
  try {
    const { latitude, longitude, name, language = 'en' } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const placeInfo = await generateChatResponse({
      message: `Tell me about this place: ${name || 'Unknown location'} at coordinates ${latitude}, ${longitude}. Include safety information, tourist attractions, and local tips.`,
      context: {
        location: { latitude, longitude, name },
        user: { language }
      },
      language
    });

    res.json({
      success: true,
      data: {
        name: name || 'Unknown Location',
        description: placeInfo.message,
        coordinates: { latitude, longitude },
        safetyScore: placeInfo.context?.safetyScore || 0.5,
        sources: placeInfo.sources,
        language: placeInfo.language,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Place info generation failed:', error);
    next(error);
  }
});

/**
 * @route POST /api/chat/incident-summary
 * @desc Generate AI incident summary for reports
 * @access Private (API Key required)
 */
router.post('/incident-summary', async (req, res, next) => {
  try {
    const { incident_data, language = 'en' } = req.body;

    if (!incident_data) {
      return res.status(400).json({
        success: false,
        error: 'Incident data is required'
      });
    }

    const summary = await generateChatResponse({
      message: `Generate a professional incident summary for this emergency alert: ${JSON.stringify(incident_data)}. Include timeline, location details, severity assessment, and recommended actions.`,
      context: {
        incident_id: incident_data.id,
        user: { language }
      },
      language
    });

    res.json({
      success: true,
      data: {
        incidentId: incident_data.id,
        summary: summary.message,
        keyPoints: extractKeyPoints(summary.message),
        severity: assessSeverity(incident_data),
        recommendedActions: extractActions(summary.message),
        confidence: summary.confidence,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Incident summary generation failed:', error);
    next(error);
  }
});

/**
 * @route GET /api/chat/conversations/:id
 * @desc Get conversation history
 * @access Private (API Key required)
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // TODO: Implement conversation storage and retrieval
    // For now, return empty conversation
    
    res.json({
      success: true,
      data: {
        conversationId: id,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Conversation retrieval failed:', error);
    next(error);
  }
});

// Helper functions
function extractKeyPoints(text: string): string[] {
  // Simple extraction logic - in production, use more sophisticated NLP
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, 3).map(s => s.trim());
}

function assessSeverity(incidentData: any): 'low' | 'medium' | 'high' | 'critical' {
  // Simple severity assessment based on incident data
  if (incidentData.type === 'panic' || incidentData.severity === 'critical') {
    return 'critical';
  }
  if (incidentData.type === 'medical' || incidentData.severity === 'high') {
    return 'high';
  }
  if (incidentData.severity === 'medium') {
    return 'medium';
  }
  return 'low';
}

function extractActions(text: string): string[] {
  // Extract action items from the summary
  const actionKeywords = ['recommend', 'should', 'must', 'need to', 'action', 'response'];
  const sentences = text.split(/[.!?]+/);
  
  return sentences
    .filter(sentence => 
      actionKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      )
    )
    .slice(0, 3)
    .map(s => s.trim());
}

export default router;