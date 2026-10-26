import { handler } from '../netlify/functions/salvar-participante.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
