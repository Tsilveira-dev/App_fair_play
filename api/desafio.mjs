import { handler } from '../netlify/functions/desafio.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
