/**
 * Fair Play — proteção entre Supabase de TESTE e ORIGINAL.
 *
 * TESTE (site fairplay-teste):
 *   AMBIENTE=teste
 *   SUPABASE_URL=https://jzxltkjxdefuptutpkfx.supabase.co
 *
 * ORIGINAL (site fairplay-app):
 *   AMBIENTE=original
 *   SUPABASE_URL=<URL do projeto Supabase ORIGINAL>
 *   SUPABASE_ORIGINAL_URL_ESPERADA=<MESMA URL original, copiada do painel>
 *
 * O endereço TESTE é fixado no código para impedir mistura acidental.
 * Nunca incluir chaves secretas aqui.
 */
const URL_SUPABASE_TESTE = 'https://jzxltkjxdefuptutpkfx.supabase.co';
const URL_SUPABASE_ORIGINAL = 'https://swbwbkslcotoecjlbqxe.supabase.co';

function limparUrl(valor) {
  return String(valor || '').trim().replace(/\/+$/, '');
}

export function lerAmbienteSupabase(env = process.env) {
  const ambiente = String(env.AMBIENTE || '').trim().toLowerCase();
  const url = limparUrl(env.SUPABASE_URL);

  const branch = String(env.VERCEL_GIT_COMMIT_REF ||
    ((env.NETLIFY || env.CONTEXT) && (env.HEAD || env.BRANCH)) || '');

  if (ambiente === 'teste') {
    if (branch && branch !== 'teste-supabase') return { erro: 'branch_teste_incorreta' };
    if (url !== URL_SUPABASE_TESTE) {
      return { erro: 'supabase_teste_incorreto' };
    }
    return { ambiente: 'teste', url };
  }

  if (ambiente === 'original') {
    if ((env.VERCEL_ENV && env.VERCEL_ENV !== 'production') ||
        (env.CONTEXT && env.CONTEXT !== 'production') ||
        (branch && branch !== 'main')) return { erro: 'original_fora_de_producao' };
    const esperada = limparUrl(env.SUPABASE_ORIGINAL_URL_ESPERADA);

    // O domínio original deve ser explícito e diferente do projeto de teste.
    const ehSupabase = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url);
    if (!esperada || !ehSupabase || url !== esperada || url !== URL_SUPABASE_ORIGINAL) {
      return { erro: 'supabase_original_incorreto' };
    }
    return { ambiente: 'original', url };
  }

  return { erro: 'ambiente_invalido' };
}
