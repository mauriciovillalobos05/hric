import { createClient } from "@supabase/supabase-js";

export async function fetchUserAndRole() {
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  // 1) Auth user
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null, enterpriseId: null };

  // 2) Try canonical source: enterprise_user → enterprise.enterprise_type
  // (Assume one active enterprise per user for now; refine later if multi-tenant)
  const { data: eu } = await supabase
    .from("enterprise_user")
    .select("enterprise:enterprise_id(id, enterprise_type)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const dbRole = eu?.enterprise?.enterprise_type || null;

  // 3) Fallback to auth metadata (set during Register)
  const metaRole = user.user_metadata?.role || null;

  return {
    user,
    role: dbRole || metaRole,           // DB wins; metadata is fallback
    enterpriseId: eu?.enterprise?.id || user.user_metadata?.enterprise_id || null,
  };
}
