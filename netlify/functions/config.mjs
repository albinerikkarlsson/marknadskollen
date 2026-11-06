// GET /api/config  →  offentliga inställningar för webbläsaren.
// Supabase-adressen och den publika "anon"-nyckeln är gjorda för att visas i webbläsaren.
// Är de inte inlagda i Netlify är inloggningen avstängd och bevakningen sparas lokalt.
export default async () => {
  const url = Netlify.env.get('SUPABASE_URL') || '';
  const anon = Netlify.env.get('SUPABASE_ANON_KEY') || '';
  return new Response(JSON.stringify({ supabase: url && anon ? { url: url.replace(/\/+$/, ''), anon } : null, ai: !!Netlify.env.get('ANTHROPIC_API_KEY') }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', 'netlify-cdn-cache-control': 'public, s-maxage=60' }
  });
};

export const config = { path: '/api/config' };
