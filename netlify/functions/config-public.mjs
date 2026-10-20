// Netlify Function: config-publica
// Devolve somente a URL do projeto e a chave PUBLICÁVEL do Supabase.
// Nunca retorna SUPABASE_SECRET_KEY nem qualquer outro segredo.

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: CABECALHOS,
  body: JSON.stringify(corpo)
});

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return resposta(405, { erro: 'Método não permitido.' });
  }

  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chavePublicavel = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const chaveSecreta = (process.env.SUPABASE_SECRET_KEY || '').trim();

  const urlValida = /^https:\/\/[^\s/]+$/.test(url);
  const chaveValida = chavePublicavel.length > 0;

  // Proteção extra: recusa devolver a chave secreta por engano
  // (por exemplo, se a variável pública tiver sido preenchida com o valor secreto).
  const chaveEhSecreta =
    chavePublicavel.startsWith('sb_secret_') ||
    (chaveSecreta.length > 0 && chavePublicavel === chaveSecreta);

  if (!urlValida || !chaveValida || chaveEhSecreta) {
    // Não registra valores nem detalhes no log.
    console.error('config-publica: variáveis de ambiente ausentes ou inválidas.');
    return resposta(500, { erro: 'Configuração indisponível.' });
  }

  return resposta(200, {
    supabaseUrl: url,
    supabasePublishableKey: chavePublicavel
  });
};