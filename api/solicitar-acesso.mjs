import { handler } from '../netlify/functions/solicitar-acesso.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
