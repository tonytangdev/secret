// Worker entry. Cloudflare routes only /api/* here (`run_worker_first` in wrangler.jsonc); every
// other path is a static asset or the single-page-application fallback.
import { API_HEADERS } from "../shared/index.ts"

export { SecretObject } from "./durable-object.ts"

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...API_HEADERS, "Content-Type": "application/json" },
  })

export default {
  fetch: (request: Request): Response =>
    new URL(request.url).pathname === "/api/health"
      ? json({ status: "ok" }, 200)
      : json({ error: "not_found" }, 404),
}
