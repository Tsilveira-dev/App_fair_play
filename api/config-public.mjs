import { handler } from '../netlify/functions/config-public.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
