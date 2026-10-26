import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { lerAmbienteSupabase } from '../netlify/lib/ambiente.mjs';
import { chavePublicavelValida } from '../netlify/lib/seguranca.mjs';

export function verificarAmbienteLocal(env = process.env) {
  const pendencias = [];
  const config = lerAmbienteSupabase(env);
  if (config.erro || config.ambiente !== 'teste') {
    pendencias.push('AMBIENTE/SUPABASE_URL: configure exclusivamente o projeto de TESTE indicado em .env.example.');
  }
  const publica = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const secreta = (env.SUPABASE_SECRET_KEY || '').trim();
  if (!chavePublicavelValida(publica)) {
    pendencias.push('SUPABASE_PUBLISHABLE_KEY: preencha a chave publicável de TESTE; chave secreta não é aceita aqui.');
  }
  if (!secreta) pendencias.push('SUPABASE_SECRET_KEY: preencha a chave secreta de TESTE somente em .env.local.');
  if (publica && publica === secreta) pendencias.push('As chaves pública e secreta devem ser diferentes.');
  return pendencias;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pendencias = verificarAmbienteLocal();
  if (pendencias.length) {
    for (const item of pendencias) console.error(item);
    process.exitCode = 1;
  } else {
    console.log('Configuração local de TESTE preenchida. A conexão e o esquema Supabase ainda precisam de validação.');
  }
}
