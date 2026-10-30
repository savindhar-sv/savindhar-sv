const { createClient } = require('@supabase/supabase-js');

const TABLE_NAME = 'listings';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY before using Supabase.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

async function getAvailableListings() {
  const { data, error } = await getSupabaseClient()
    .from(TABLE_NAME)
    .select('*')
    .eq('status', 'available');

  if (error) throw error;
  return data;
}

module.exports = { getSupabaseClient, getAvailableListings };
