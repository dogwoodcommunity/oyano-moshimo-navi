import { createClient } from "@supabase/supabase-js";

/**
 * Next.jsのData CacheはRoute Handler内のGET fetchも既定でキャッシュする。
 * Supabaseへの参照が固定化されると、古い家族やメンバーを返してしまうため必ず外す。
 */
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: noStoreFetch
    }
  });
}

/**
 * RPC側の auth.uid() を効かせるため、利用者のアクセストークンで動くクライアントを返す。
 * service role クライアントでは auth.uid() が null になり、招待系RPCが通らない。
 */
export function getUserSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: noStoreFetch,
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  });
}
