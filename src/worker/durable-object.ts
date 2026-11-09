// The only module allowed to use Cloudflare runtime types (see AGENTS.md).
import { DurableObject } from "cloudflare:workers"

export class SecretObject extends DurableObject {}
