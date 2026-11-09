// Supabase på serversidan: kolla att ett anrop kommer från en inloggad användare.
// Adressen och den publika nyckeln är samma som webbläsaren använder (se /api/config).
export const SUPA = {
  url: () => (Netlify.env.get('SUPABASE_URL') || 'https://pvjuzsqimwqekthmnelm.supabase.co').trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, ''),
  anon: () => Netlify.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_4fCFFWe5844ZPw83R8pjbQ_jA4MjgGE'
};

// Returnerar användaren om token är giltig, annars null
export async function userFromRequest(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const r = await fetch(SUPA.url() + '/auth/v1/user', { headers: { apikey: SUPA.anon(), authorization: 'Bearer ' + m[1] }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? u : null;
  } catch { return null; }
}
