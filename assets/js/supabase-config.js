// Supabase Configuration
const SUPABASE_URL = "https://guqvwcshdckttqubyofe.supabase.co";
const SUPABASE_KEY = "sb_publishable_TV1HLH9rR6MYuBlblNPIHQ_o5faMZky";

// Initialize Supabase client
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Export for use in other scripts
window.db = _supabase;

