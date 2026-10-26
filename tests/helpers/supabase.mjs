import assert from 'node:assert/strict';
export const UID = '11111111-1111-4111-8111-111111111111';
export const GESTOR = '22222222-2222-4222-8222-222222222222';
export const PARTICIPANTE = '33333333-3333-4333-8333-333333333333';
export const SESSAO = '44444444-4444-4444-8444-444444444444';
export const URL_TESTE = 'https://jzxltkjxdefuptutpkfx.supabase.co';
export const AGORA = new Date('2026-01-01T15:00:00Z').getTime();
export const TOKEN = 'token-estudante-teste';
export const TOKEN_GESTOR = 'token-gestor-teste';
// Sentinelas apenas em memória, nunca credenciais de um projeto real.
export const PUBLICA = 'sb_publishable_fixture';
export const SECRETA = 'sb_secret_fixture';

export function preparar(t, opcoes = {}) {
  const nomes = ['AMBIENTE','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
    'SUPABASE_ORIGINAL_URL_ESPERADA','VERCEL_ENV','VERCEL_GIT_COMMIT_REF','NETLIFY','CONTEXT','HEAD','BRANCH'];
  const anteriores = Object.fromEntries(nomes.map(n => [n, process.env[n]]));
  t.after(() => { for (const n of nomes) {
    if (anteriores[n] === undefined) delete process.env[n]; else process.env[n] = anteriores[n];
  } });
  for (const n of nomes) delete process.env[n];
  Object.assign(process.env, { AMBIENTE:'teste', SUPABASE_URL:URL_TESTE,
    SUPABASE_PUBLISHABLE_KEY:PUBLICA, SUPABASE_SECRET_KEY:SECRETA });
  t.mock.timers.enable({ apis: ['Date'], now: AGORA });
  const db = {
    gestores: [{ usuario_auth_id: GESTOR }],
    participantes: [{ id: PARTICIPANTE, nome:'Exemplo', nome_chave:'exemplo', ativo:true, criado_em:new Date().toISOString() }],
    configuracao_teste: [{ id:1, data_inicio:'2026-01-01', ativo:true }],
    sessoes_participantes: [{ id: SESSAO, participante_id: PARTICIPANTE,
      usuario_auth_id:UID, status:'aprovada', tipo_dispositivo:'individual',
      solicitado_em:new Date().toISOString(), autorizado_em:new Date().toISOString(),
      expira_em:'2026-01-09T02:59:59Z', autorizado_por:GESTOR }],
    checkins: [], desafios_registros: [], solicitacoes_tentativas: [],
    ...opcoes.db
  };
  const chamadas = [];
  const usuarios = {
    [TOKEN]: { id:UID, is_anonymous:true, app_metadata:{provider:'anonymous'} },
    [TOKEN_GESTOR]: { id:GESTOR, is_anonymous:false, email:'gestor@example.invalid', app_metadata:{provider:'email'} },
    ...opcoes.usuarios
  };
  const json = (v, status = 200) => new Response(status === 204 ? null : JSON.stringify(v), {status});
  const fetch = async (endereco, opts = {}) => {
    const u = new URL(endereco);
    assert.equal(u.origin, URL_TESTE, 'O teste não pode acessar outro banco ou rede');
    const method = opts.method || 'GET';
    chamadas.push({url:u, method, headers:opts.headers, body:opts.body ? JSON.parse(opts.body) : null});
    if (opcoes.falha) return json({erro:'indisponivel'}, 503);
    if (u.pathname === '/auth/v1/user') {
      assert.equal(opts.headers.apikey, PUBLICA);
      const token = opts.headers.Authorization?.replace(/^Bearer /,'');
      return usuarios[token] ? json(usuarios[token]) : json({},401);
    }
    assert.equal(opts.headers.apikey, SECRETA);
    if (u.pathname === '/rest/v1/rpc/registrar_tentativa_acesso') {
      return json(opcoes.limite || {bloqueado:false});
    }
    const nome = u.pathname.replace('/rest/v1/','');
    assert(db[nome], `Tabela inesperada: ${nome}`);
    const filtros = [...u.searchParams].filter(([k]) => !['select','order','limit'].includes(k));
    const filtrar = row => filtros.every(([k,v]) => {
      const i=v.indexOf('.'), operador=v.slice(0,i), valor=v.slice(i+1);
      const a=String(row[k]);
      return operador==='eq' ? a===valor : operador==='neq' ? a!==valor
        : operador==='gte' ? a>=valor : operador==='gt' ? a>valor
        : operador==='lte' ? a<=valor : operador==='lt' ? a<valor : false;
    });
    let rows;
    if (method === 'GET') rows=db[nome].filter(filtrar);
    else if (method === 'POST') {
      const dados=JSON.parse(opts.body);
      const duplicado = ['checkins','desafios_registros'].includes(nome) && db[nome].some(
        r => r.participante_id===dados.participante_id && r.dia_numero===dados.dia_numero);
      if (duplicado || opcoes.conflito) return json({code:'23505'},409);
      const row={ id:crypto.randomUUID(), primeiro_envio_em:new Date().toISOString(),
        oferecido_em:new Date().toISOString(), criado_em:new Date().toISOString(), ativo:true, ...dados };
      db[nome].push(row); rows=[row];
    } else if (method === 'PATCH') {
      rows=db[nome].filter(filtrar);
      rows.forEach(row=>Object.assign(row, JSON.parse(opts.body)));
    } else throw new Error('Método não permitido no teste');
    if (u.searchParams.has('order')) {
      const [k,ord]=u.searchParams.get('order').split('.');
      rows=[...rows].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(ord==='desc'?-1:1));
    }
    rows=rows.slice(0,Number(u.searchParams.get('limit') || rows.length));
    if (u.searchParams.has('select')) {
      const cols=u.searchParams.get('select').split(',');
      rows=rows.map(row=>Object.fromEntries(cols.map(k=>[k,row[k]])));
    }
    if (opts.headers.Prefer === 'return=minimal') return json(null,204);
    return json(rows, method==='POST'?201:200);
  };
  t.mock.method(globalThis, 'fetch', fetch);
  return {db, chamadas, usuarios};
}
export function evento(method='GET', body, token=TOKEN, query={}) {
  return { httpMethod:method, headers:token?{authorization:`Bearer ${token}`}:{},
    body:body===undefined?null:JSON.stringify(body), queryStringParameters:query, isBase64Encoded:false };
}
export function alternativas(dia=1, escolha=1) {
  return Array.from({length:5},(_,i)=>`D${String(dia).padStart(2,'0')}_P${i+1}_A${escolha}`);
}
export function dados(r) { return JSON.parse(r.body); }
