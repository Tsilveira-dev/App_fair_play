
/**
 * Fair Play - Protecao do ambiente de testes
 * Impede conexoes acidentais com outro Supabase.
 */

const URL_SUPABASE_TESTE =
  "https://jzxltkjxdefuptutpkfx.supabase.co";

export function lerAmbienteSupabase(env = process.env) {
  const ambiente = (env.AMBIENTE || "").trim();

  const url = (env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  // Aceita exclusivamente o ambiente de testes.
  if (ambiente !== "teste") {
    return { erro: "ambiente_invalido" };
  }

  // Bloqueia qualquer Supabase diferente do projeto de testes.
  if (url !== URL_SUPABASE_TESTE) {
    return { erro: "supabase_incorreto" };
  }

  return {
    ambiente: "teste",
    url
  };
}
