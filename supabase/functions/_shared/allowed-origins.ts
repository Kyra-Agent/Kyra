// Browser origins allowed to call the owner-scoped transaction and swap
// functions. kyraagent.netlify.app is the production site's Netlify address
// and keeps the private workspace usable while the custom domain is moving.
export const allowedBrowserOrigins: ReadonlySet<string> = new Set([
  "https://kyraagent.xyz",
  "https://www.kyraagent.xyz",
  "https://kyraagent.netlify.app",
  "http://localhost:4173",
  "http://localhost:4176",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4176",
  "http://127.0.0.1:5173",
]);
