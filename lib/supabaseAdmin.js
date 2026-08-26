// =============================================================
// Cliente Supabase usado SÓ no servidor (funções da Vercel).
// Usa a service_role key, que tem acesso total ao banco — por
// isso NUNCA deve ser exposta ao front-end nem commitada no
// GitHub. Ela vive apenas nas variáveis de ambiente da Vercel.
// =============================================================

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam as variáveis de ambiente SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabaseAdmin;
