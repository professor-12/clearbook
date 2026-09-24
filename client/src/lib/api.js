const CODE_KEY = "clearbook.accessCode";

export function getAccessCode() {
  try { return localStorage.getItem(CODE_KEY) ?? ""; } catch { return ""; }
}
export function setAccessCode(code) {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* private mode: keep it for this page only */ }
  memoryCode = code;
}
let memoryCode = getAccessCode();

export class NeedsCodeError extends Error {}
export class NeedsPasswordError extends Error {
  constructor(message, reason) { super(message); this.reason = reason; }
}

const headers = (extra = {}) => ({ ...extra, ...(memoryCode ? { "x-access-code": memoryCode } : {}) });

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && body.needsCode) throw new NeedsCodeError(body.error);
  if (body.needsPassword) throw new NeedsPasswordError(body.error, body.reason);
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const health = () => fetch("/api/health").then(json);

export function parseFile(file, password) {
  const fd = new FormData();
  fd.append("file", file);
  if (password) fd.append("password", password);
  return fetch("/api/parse", { method: "POST", body: fd, headers: headers() }).then(json);
}

// Samples are static files; they go through the same upload path as a user's file.
export async function loadSample(format) {
  const name = `sample-statement.${format}`;
  const [blob, labels] = await Promise.all([
    fetch(`/samples/${name}`).then((r) => r.blob()),
    fetch("/samples/sample-labels.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const parsed = await parseFile(new File([blob], name));
  return { ...parsed, labels };
}

// Reads the NDJSON stream and hands each event to onEvent as it arrives.
export async function analyze({ transactions, holder }, onEvent, signal) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ transactions, holder }),
    signal,
  });
  if (!res.ok) await json(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
