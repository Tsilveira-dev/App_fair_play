import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const publico = await realpath(resolve(raiz, 'public'));
const nomes = ['config-public', 'solicitar-acesso', 'consultar-acesso', 'verificar-gestor',
  'listar-participantes', 'salvar-participante', 'gerenciar-acesso', 'checkin', 'desafio'];
const rotas = new Map(await Promise.all(nomes.map(async nome =>
  [nome, (await import(pathToFileURL(resolve(raiz, `api/${nome}.mjs`)))).default]
)));
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const api = caminho.match(/^\/(?:api|\.netlify\/functions)\/([^/]+)$/);
    if (api) {
      const handler = rotas.get(api[1]);
      if (!handler) { res.statusCode = 404; return res.end(); }
      return await handler(req, res);
    }
    if (!['GET','HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
    const arquivo = await realpath(resolve(publico, '.' + (caminho === '/' ? '/index.html' : caminho)));
    if (!arquivo.startsWith(publico + sep)) { res.statusCode = 404; return res.end(); }
    const conteudo = await readFile(arquivo);
    res.setHeader('Content-Type', tipos[extname(arquivo)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : conteudo);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.PORT || 3000);
  server.listen(porta, '127.0.0.1', () => console.log(`Fair Play: servidor local iniciado na porta ${porta}.`));
}
