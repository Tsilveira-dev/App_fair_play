import { handler } from '../netlify/functions/listar-participantes.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
