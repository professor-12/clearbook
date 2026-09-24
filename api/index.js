// Vercel Function: every /api/* request is rewritten here (see vercel.json) and
// handled by the same Express app used locally. The UI is served as static files.
import app from "../app.js";

export default app;
