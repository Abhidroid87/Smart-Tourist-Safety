import OpenAI from 'openai';
import { supabase } from '../config/database';
import { generateEmbedding, searchSimilarDocuments } from './embeddingService';
import { logger } from '../utils/logger';

interface ChatRequest {
  message: string;
  context?: {
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
    };
    user?: {
      id?: string;
      name?: string;
      language?: string;
    };
    incident_id?: string;
  };
  conversationId?: string;
  language?: string;
}

interface ChatResponse {
  message: string;
  conversationId: string;
  context?: any;
  sources: Array<{
    id: string;
    content: string;
    similarity: number;
    type: string;
  }>;
  confidence: number;
  language: string;
  processingTime: number;
}

// Conditionally initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

/**
 * Generate AI chat response with RAG context
 */
export async function generateChatResponse(request: ChatRequest): Promise<ChatResponse> {
  const startTime = Date.now();
  const conversationId = request.conversationId || generateConversationId();

  try {
    // Step 1: Generate embedding for the user query
    const queryEmbedding = await generateEmbedding(request.message);

    // Step 2: Search for relevant documents
    const relevantDocs = await searchSimilarDocuments(
      queryEmbedding,
      {
        limit: 5,
        threshold: 0.7,
        location: request.context?.location,
        type: inferDocumentType(request.message)
      }
    );

    // Step 3: Build context from retrieved documents
    const contextText = buildContextFromDocuments(relevantDocs);

    // Step 4: Create system prompt with context
    const systemPrompt = buildSystemPrompt(request.context, request.language);

    // Step 5: Generate AI response
    let aiResponse: string;
    
    if (!openai) {
      logger.warn('OpenAI API key not configured, using fallback response');
      aiResponse = `I understand you're asking about: "${request.message}". While I don't have access to AI services right now, I can tell you that this appears to be related to tourist safety. Please contact local authorities if this is an emergency, or check with tourist information centers for general inquiries.`;
    } else {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Context: ${contextText}\n\nQuestion: ${request.message}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
      });

      aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I cannot generate a response at this time.';
    }

    // Step 6: Calculate confidence score
    const confidence = calculateConfidence(relevantDocs, aiResponse);

    // Step 7: Store conversation (optional)
    await storeConversation(conversationId, request.message, aiResponse, request.context);

    const processingTime = Date.now() - startTime;

    return {
      message: aiResponse,
      conversationId,
      context: {
        location: request.context?.location,
        safetyScore: calculateSafetyScore(relevantDocs),
        nearbyPlaces: extractNearbyPlaces(relevantDocs)
      },
      sources: relevantDocs.map(doc => ({
        id: doc.id,
        content: doc.content.substring(0, 200) + '...',
        similarity: doc.similarity,
        type: doc.metadata?.type || 'unknown'
      })),
      confidence,
      language: request.language || 'en',
      processingTime
    };

  } catch (error) {
    logger.error('Chat response generation failed:', error);
    
    // Fallback response
    return {
      message: 'I apologize, but I am unable to process your request at this time. Please try again later or contact support for assistance.',
      conversationId,
      context: {},
      sources: [],
      confidence: 0,
      language: request.language || 'en',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Build system prompt with context and language
 */
function buildSystemPrompt(context?: any, language?: string): string {
  let prompt = `You are a helpful AI assistant for the Smart Tourist Safety system. Your role is to provide accurate, helpful, and safety-focused information to tourists and authorities.

Key responsibilities:
- Prioritize tourist safety and well-being
- Provide accurate location and travel information
- Offer emergency guidance when appropriate
- Be culturally sensitive and respectful
- Give clear, actionable advice

Guidelines:
- Always prioritize safety over convenience
- Provide specific, actionable information when possible
- If you're unsure about safety information, recommend contacting local authorities
- Be concise but comprehensive
- Include relevant emergency contact information when appropriate`;

  if (language && language !== 'en') {
    prompt += `\n\nPlease respond in ${getLanguageName(language)}. Use clear, simple language appropriate for tourists.`;
  }

  if (context?.location) {
    prompt += `\n\nLocation context: The user is asking about or is located near ${context.location.name || `coordinates ${context.location.latitude}, ${context.location.longitude}`}.`;
  }

  if (context?.incident_id) {
    prompt += `\n\nEmergency context: This is related to an active emergency incident. Prioritize immediate safety and response information.`;
  }

  return prompt;
}

/**
 * Build context text from retrieved documents
 */
function buildContextFromDocuments(docs: Array<{ content: string; metadata?: any }>): string {
  if (!docs.length) {
    return 'No specific context available.';
  }

  return docs
    .map((doc, index) => `[Context ${index + 1}]: ${doc.content}`)
    .join('\n\n');
}

/**
 * Infer document type from user query
 */
function inferDocumentType(message: string): string | undefined {
  const message_lower = message.toLowerCase();
  
  if (message_lower.includes('emergency') || message_lower.includes('danger') || message_lower.includes('help')) {
    return 'emergency';
  }
  if (message_lower.includes('place') || message_lower.includes('location') || message_lower.includes('visit')) {
    return 'place';
  }
  if (message_lower.includes('safety') || message_lower.includes('safe')) {
    return 'safety';
  }
  
  return undefined;
}

/**
 * Calculate confidence score based on retrieved documents and response
 */
function calculateConfidence(docs: Array<{ similarity: number }>, response: string): number {
  if (!docs.length) return 0.3;
  
  const avgSimilarity = docs.reduce((sum, doc) => sum + doc.similarity, 0) / docs.length;
  const responseQuality = response.length > 50 ? 0.8 : 0.5; // Simple heuristic
  
  return Math.min(avgSimilarity * responseQuality, 1.0);
}

/**
 * Calculate safety score from retrieved documents
 */
function calculateSafetyScore(docs: Array<{ metadata?: any }>): number {
  if (!docs.length) return 0.5;
  
  const safetyScores = docs
    .filter(doc => doc.metadata?.safetyScore)
    .map(doc => doc.metadata.safetyScore);
    
  if (!safetyScores.length) return 0.5;
  
  return safetyScores.reduce((sum, score) => sum + score, 0) / safetyScores.length;
}

/**
 * Extract nearby places from documents
 */
function extractNearbyPlaces(docs: Array<{ metadata?: any }>): Array<any> {
  return docs
    .filter(doc => doc.metadata?.type === 'place' && doc.metadata?.name)
    .slice(0, 3)
    .map(doc => ({
      name: doc.metadata.name,
      category: doc.metadata.category,
      rating: doc.metadata.rating,
      distance: doc.metadata.distance
    }));
}

/**
 * Store conversation for history (optional)
 */
async function storeConversation(
  conversationId: string,
  userMessage: string,
  aiResponse: string,
  context?: any
): Promise<void> {
  try {
    await supabase
      .from('rag_conversations')
      .insert({
        conversation_id: conversationId,
        user_message: userMessage,
        ai_response: aiResponse,
        context,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    logger.warn('Failed to store conversation:', error);
    // Non-critical error - don't throw
  }
}

/**
 * Generate unique conversation ID
 */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get language name from code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    hi: 'Hindi',
    zh: 'Chinese'
  };
  return languages[code] || 'English';
}