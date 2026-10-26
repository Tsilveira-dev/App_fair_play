import { chavePublicavelValida } from "../lib/seguranca.mjs";

/*
 * Fair Play - Netlify Function: config-public
 * Retorna apenas a URL e a chave publicavel.
 * Nunca retorna a chave secreta.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const CABECALHOS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: CABECALHOS,
  body: JSON.stringify(corpo)
});

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return resposta(405, {
      erro: "Metodo nao permitido."
    });
  }

  // Confere se estamos usando o Supabase de testes.
  const configuracao = lerAmbienteSupabase();

  const chavePublicavel = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const chaveSecreta = (
    process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  const chaveEhSecreta =
    !chavePublicavelValida(chavePublicavel) ||
    (
      chaveSecreta.length > 0 &&
      chavePublicavel === chaveSecreta
    );

  if (
    configuracao.erro ||
    !chavePublicavel ||
    chaveEhSecreta
  ) {
    console.error(
      "config-public: configuracao invalida.",
      configuracao.erro || "chave_invalida"
    );

    return resposta(500, {
      erro: "Configuracao indisponivel."
    });
  }

  return resposta(200, {
    ambiente: configuracao.ambiente,
    supabaseUrl: configuracao.url,
    supabasePublishableKey: chavePublicavel
  });
};
