
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htuzhmtnxkrclcrnsica.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dXpobXRueGtyY2xjcm5zaWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3Mzc4MDQsImV4cCI6MjA4MjMxMzgwNH0.LzWRTYbyevXPj7MDC8BMzBUGcNaK6ITGz8XBRFOvUXE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
