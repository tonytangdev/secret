// Usage counts (ADR-0005): one Workers Analytics Engine data point per created, revealed or
// expired Secret. A data point carries only the event name: never a Secret ID, IP or payload.
import { Context, Effect, Layer } from "effect"

export type UsageEvent = "created" | "revealed" | "expired"

/** What gets written for one event. Analytics Engine allows at most one index. */
export interface UsageDataPoint {
  readonly blobs: ReadonlyArray<string>
  readonly indexes: ReadonlyArray<string>
}

/** The part of an Analytics Engine binding we use; `env.USAGE` fits it structurally. */
export interface DataPointWriter {
  readonly writeDataPoint: (point: { blobs: Array<string>; indexes: Array<string> }) => void
}

export const usageDataPoint = (event: UsageEvent) => ({ blobs: [event], indexes: [event] })

export class Usage extends Context.Service<
  Usage,
  { readonly record: (event: UsageEvent) => Effect.Effect<void> }
>()("Usage") {
  static readonly layer = (writer: DataPointWriter): Layer.Layer<Usage> =>
    Layer.succeed(Usage, {
      record: (event) =>
        Effect.sync(() => {
          writer.writeDataPoint(usageDataPoint(event))
        }),
    })
}
