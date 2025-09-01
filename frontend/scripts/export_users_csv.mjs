import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';

// Use Vite env if present, otherwise process.env (Node)
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const env = { ...process.env, ...viteEnv };

const url = env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
// If RLS blocks reads, use SERVICE ROLE **only on trusted/server machines**
// const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL/SUPABASE_KEY (or VITE_* equivalents).');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.from('users').select('*').csv();
if (error) {
  console.error('Export failed:', error);
  process.exit(1);
}

await fs.writeFile('users.csv', data, 'utf8');
console.log('✅ Wrote users.csv');