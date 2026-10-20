// Edge Function: el superadmin agrega un dueño a un negocio (existente o nuevo).
// - Si el correo ya tiene cuenta, solo se le asigna el negocio.
// - Si no, Supabase le envía una invitación para que defina su contraseña.
// Usa la service role key, que Supabase pone en el entorno de la función: nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;

  // Quien llama tiene que ser superadmin (se comprueba con su propia sesión).
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: isSuperadmin } = await caller.rpc('is_superadmin');
  if (isSuperadmin !== true) {
    return json({ error: 'Solo el superadmin puede agregar dueños.', code: '42501' }, 403);
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'El correo no es válido.', code: 'invalid_email' }, 400);
  }
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : undefined;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Negocio existente, o uno nuevo (activo: lo crea el superadmin, no hace falta aprobarlo).
  let businessId: string | undefined = body?.businessId;
  let createdBusiness = false;
  if (!businessId) {
    const { data, error } = await admin
      .from('businesses')
      .insert({ name: String(body?.name ?? '').trim(), slug: String(body?.slug ?? ''), status: 'active' })
      .select('id')
      .single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    businessId = data.id;
    createdBusiness = true;
  }
  // Si algo falla después, no dejar un negocio nuevo sin dueño.
  const undo = async () => {
    if (createdBusiness) await admin.from('businesses').delete().eq('id', businessId);
  };

  const { data: existingUserId, error: findError } = await admin.rpc('find_user_id_by_email', {
    target_email: email,
  });
  if (findError) {
    await undo();
    return json({ error: findError.message }, 500);
  }

  let userId: string = existingUserId;
  let invited = false;
  if (userId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role, business_id')
      .eq('user_id', userId)
      .maybeSingle();
    const ownsAnother = profile?.business_id && profile.business_id !== businessId;
    if (profile?.role === 'superadmin' || ownsAnother) {
      await undo();
      return json({ error: 'Ese correo ya administra otro negocio.', code: 'owner_taken' }, 409);
    }
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      await undo();
      return json({ error: error.message, code: error.code }, 400);
    }
    userId = data.user.id;
    invited = true;
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: userId, role: 'tenant_admin', business_id: businessId });
  if (profileError) {
    await undo();
    return json({ error: profileError.message }, 500);
  }

  return json({ businessId, invited });
});
