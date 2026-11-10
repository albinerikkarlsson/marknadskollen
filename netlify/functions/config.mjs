// GET /api/config  →  offentliga inställningar för webbläsaren.
// Supabase-adressen och den publika "anon"-nyckeln är gjorda för att visas i webbläsaren.
// Googles klient-ID (GOOGLE_CLIENT_ID) är också publikt. Det gör att Google-rutan öppnas på vår egen adress.
// Är de inte inlagda i Netlify är inloggningen avstängd och bevakningen sparas lokalt.
export default async () => {
  // Projektets adress och publika nyckel. Båda är publika och får synas i webbläsaren.
  // Miljövariabler i Netlify går före om de finns.
  const url = Netlify.env.get('SUPABASE_URL') || 'https://pvjuzsqimwqekthmnelm.supabase.co';
  const anon = Netlify.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_4fCFFWe5844ZPw83R8pjbQ_jA4MjgGE';
  return new Response(JSON.stringify({ supabase: url && anon ? { url: url.trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, ''), anon } : null, ai: !!Netlify.env.get('ANTHROPIC_API_KEY'), google: (Netlify.env.get('GOOGLE_CLIENT_ID') || '178888834947-h26luhdo7436dpsmsa55pk87mo5kavv6.apps.googleusercontent.com').trim() || null }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', 'netlify-cdn-cache-control': 'public, s-maxage=60' }
  });
};

export const config = { path: '/api/config' };
