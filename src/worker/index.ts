// Worker entry. The HTTP API arrives in later tickets.
export { SecretObject } from "./durable-object.ts"

export default {
  fetch: (): Response => new Response("Not found", { status: 404 }),
}
