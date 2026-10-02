// Paste your Supabase Project URL and Publishable Key here.
// Dashboard -> Project Settings -> API
const SUPABASE_URL = "https://cxoofuznqvxivluhuhvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_rLuMdkTCnS_Zisb1GqshUg_3lXFvkNs";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
