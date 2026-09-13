import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL yoki VITE_SUPABASE_ANON_KEY topilmadi. Vercel > Settings > Environment Variables bo'limini tekshiring va qayta Redeploy qiling."
  );
}

export const supabase = createClient(url, key);
