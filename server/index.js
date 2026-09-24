// Local server: the same app Vercel runs, plus the built UI from client/dist.
// (On Vercel, client/dist is served as static files and api/index.js runs the app.)
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "../app.js";
import { hasKey } from "./jev.js";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "dist");
const PORT = Number(process.env.PORT) || 5174;

if (fs.existsSync(PUBLIC)) {
  app.use(express.static(PUBLIC));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(PUBLIC, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Clearbook on http://localhost:${PORT}${fs.existsSync(PUBLIC) ? "" : " (run `npm run build` to serve the UI)"}`);
  if (!hasKey()) console.warn("⚠  No TypeSafe key found: set TYPESAFE_API_KEY or ~/.config/typesafe/api_key");
});
