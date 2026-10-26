import { handler } from '../netlify/functions/verificar-gestor.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
