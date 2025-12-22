// Supabase Configuration
const SUPABASE_URL = "https://guqvwcshdckttqubyofe.supabase.co";
const SUPABASE_KEY = "sb_publishable_TV1HLH9rR6MYuBlblNPIHQ_o5faMZky";

// Initialize Supabase client
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Export for use in other scripts
window.db = _supabase;

// Date Utilities
window.formatDateForDisplay = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || "-";
  // Handle both ISO strings and YYYY-MM-DD
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${m}-${d}-${y}`;
};

window.formatDateForDb = (displayDate) => {
  if (!displayDate) return null;
  const parts = displayDate.split('-');
  if (parts.length !== 3) return displayDate; 
  const [m, d, y] = parts;
  // Basic validation to ensure we have a 4-digit year and 2-digit month/day
  if (y.length !== 4) return displayDate;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

