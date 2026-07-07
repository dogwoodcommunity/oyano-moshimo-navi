import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

type MobileSupabaseClient = SupabaseClient<any, "public", any>;

let cachedClient: MobileSupabaseClient | null = null;
let cachedKey = "";

export function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cacheKey = `${url}:${key}`;
  if (cachedClient && cachedKey === cacheKey) return cachedClient;

  cachedKey = cacheKey;
  cachedClient = createClient<any, "public", any>(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage
    }
  });

  return cachedClient;
}
