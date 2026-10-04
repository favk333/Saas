export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sans variables d'env, l'app tourne en mode démo (données fictives, pas d'auth). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
