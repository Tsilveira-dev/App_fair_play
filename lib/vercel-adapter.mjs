// Adapta req/res Node da Vercel para o contrato já usado nas funções Netlify.
// O limite é aplicado antes do parse, mesmo quando req.body já foi preparado.
const LIMITE_CORPO = 4096;

export function adaptar(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      let body = '';
      if (req.body !== undefined) {
        body = Buffer.isBuffer(req.body) ? req.body.toString('utf8')
          : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        if (Buffer.byteLength(body, 'utf8') > LIMITE_CORPO) {
          res.statusCode = 413;
          return res.end(JSON.stringify({ erro: 'Corpo da requisição muito grande.' }));
        }
      } else {
        let tamanho = 0;
        const partes = [];
        for await (const parte of req) {
          const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
          tamanho += buffer.length;
          if (tamanho > LIMITE_CORPO) {
            res.statusCode = 413;
            return res.end(JSON.stringify({ erro: 'Corpo da requisição muito grande.' }));
          }
          partes.push(buffer);
        }
        body = Buffer.concat(partes).toString('utf8');
      }
      const url = new URL(req.url, 'http://localhost');
      const headers = Object.fromEntries(Object.entries(req.headers || {}).map(
        ([nome, valor]) => [nome.toLowerCase(), Array.isArray(valor) ? valor.join(', ') : valor]
      ));
      const resultado = await handler({
        httpMethod: req.method,
        path: url.pathname,
        headers,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body: body || null,
        isBase64Encoded: false
      });
      res.statusCode = resultado.statusCode;
      for (const [nome, valor] of Object.entries(resultado.headers || {})) {
        res.setHeader(nome, valor);
      }
      return res.end(resultado.body || '');
    } catch {
      // Nunca devolver mensagens arbitrárias de exceções, tokens ou dados do banco.
      res.statusCode = 500;
      return res.end(JSON.stringify({ erro: 'Não foi possível concluir a operação.' }));
    }
  };
}
