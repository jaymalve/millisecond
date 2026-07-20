import { Mastra } from "@mastra/core";
import { Observability } from "@mastra/observability";
import { BraintrustExporter } from "@mastra/braintrust";
import { D1Store } from "@mastra/cloudflare-d1";
import { env } from "../env";
import { investigatorAgent } from "./agents/investigator";

// Every binding used here is read at module scope via `env` from
// `../env` (itself backed by `cloudflare:workers`), and kept inline in
// this constructor call rather than hoisted into intermediate variables —
// see agent/CLAUDE.md for why that ordering matters under Workers.
export const mastra = new Mastra({
  agents: { investigator: investigatorAgent },
  // Mastra's own thread/message storage, namespaced away from target/'s
  // `spans` table in the same D1 database. Investigation traces
  // themselves go to Braintrust below, not here — D1 storage doesn't
  // support persisting the observability domain.
  storage: new D1Store({ id: "millisecond-agent-storage", binding: env.TARGET_DB, tablePrefix: "mastra_" }),
  observability: new Observability({
    configs: {
      braintrust: {
        serviceName: "millisecond-agent",
        exporters: [
          new BraintrustExporter({
            apiKey: env.BRAINTRUST_API_KEY,
            projectName: "millisecond-dev",
          }),
        ],
      },
    },
  }),
});
