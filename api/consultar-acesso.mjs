import { handler } from '../netlify/functions/consultar-acesso.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
