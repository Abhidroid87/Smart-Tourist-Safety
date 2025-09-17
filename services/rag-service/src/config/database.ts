import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Mock Supabase client if environment variables are not set
let supabase: any;

try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    logger.info('Supabase client initialized');
  } else {
    logger.warn('Supabase environment variables not set, using mock client');
    // Mock Supabase client
    supabase = {
      from: (table: string) => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null })
      })
    };
  }
} catch (error) {
  logger.error('Failed to initialize Supabase client:', error);
  // Provide mock client as fallback
  supabase = {
    from: (table: string) => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null })
    })
  };
}

export { supabase };