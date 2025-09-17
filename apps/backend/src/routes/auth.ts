import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  country: Joi.string().min(2).max(100).required(),
  phoneNumber: Joi.string().optional(),
  emergencyContact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    relationship: Joi.string().required()
  }).optional(),
  role: Joi.string().valid('tourist', 'police', 'admin').default('tourist')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, country, phoneNumber, emergencyContact, role } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('tourists')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user profile
    const { data: user, error } = await supabase
      .from('tourists')
      .insert({
        email,
        password_hash: hashedPassword,
        name,
        country,
        phone_number: phoneNumber,
        emergency_contact: emergencyContact,
        role,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select(`
        id, email, name, country, phone_number, 
        emergency_contact, role, status, created_at
      `)
      .single();

    if (error) {
      logger.error('Registration error:', error);
      throw new ApiError(500, 'Failed to create user account');
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await supabase
      .from('refresh_tokens')
      .insert({
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

    logger.info(`New user registered: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          country: user.country,
          role: user.role,
          status: user.status
        },
        tokens: {
          accessToken,
          refreshToken
        }
      },
      message: 'Registration successful'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return JWT
 * @access Public
 */
router.post('/login', validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const { data: user, error } = await supabase
      .from('tourists')
      .select(`
        id, email, name, country, phone_number, 
        password_hash, role, status, last_login
      `)
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Store refresh token and update last login
    await Promise.all([
      supabase
        .from('refresh_tokens')
        .insert({
          user_id: user.id,
          token: refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }),
      supabase
        .from('tourists')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    ]);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          country: user.country,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        }
      },
      message: 'Login successful'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;

    // Check if refresh token exists and is valid
    const { data: tokenRecord, error } = await supabase
      .from('refresh_tokens')
      .select('id, user_id, expires_at')
      .eq('token', refreshToken)
      .eq('user_id', decoded.userId)
      .single();

    if (error || !tokenRecord) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('id', tokenRecord.id);
      throw new ApiError(401, 'Refresh token expired');
    }

    // Get user details
    const { data: user } = await supabase
      .from('tourists')
      .select('id, email, role')
      .eq('id', tokenRecord.user_id)
      .single();

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      data: {
        accessToken
      },
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Invalid refresh token'));
    }
    next(error);
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user and invalidate refresh token
 * @access Private
 */
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.headers['x-refresh-token'] as string;

    if (refreshToken) {
      // Remove refresh token from database
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('token', refreshToken);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new ApiError(401, 'Access token required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get user profile
    const { data: user, error } = await supabase
      .from('tourists')
      .select(`
        id, email, name, country, phone_number,
        emergency_contact, role, status, created_at, last_login
      `)
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          country: user.country,
          phoneNumber: user.phone_number,
          emergencyContact: user.emergency_contact,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLogin: user.last_login
        }
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Invalid access token'));
    }
    next(error);
  }
});

export default router;