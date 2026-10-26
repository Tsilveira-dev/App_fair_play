import { handler } from '../netlify/functions/checkin.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';

export default adaptar(handler);
