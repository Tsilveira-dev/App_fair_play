// Esta leitura não autentica JWTs; só impede publicar uma chave de serviço por engano.
// A autenticação de usuários continua sendo feita pelo Supabase Auth.
export function chavePublicavelValida(chave) {
  if (chave.startsWith('sb_publishable_')) return chave.length > 'sb_publishable_'.length;
  try {
    const partes = chave.split('.');
    return partes.length === 3 && JSON.parse(Buffer.from(partes[1], 'base64url')).role === 'anon';
  } catch {
    return false;
  }
}

export function identidadeGestor(usuario) {
  return usuario?.is_anonymous !== true &&
    usuario?.app_metadata?.provider === 'email' &&
    typeof usuario?.email === 'string' && usuario.email.length > 0;
}

export function dataValida(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === iso;
}
