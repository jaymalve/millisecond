import { Mastra } from "@mastra/core";
import { Observability } from "@mastra/observability";
import { BraintrustExporter } from "@mastra/braintrust";
import { D1Store } from "@mastra/cloudflare-d1";
import { initLogger } from "braintrust";
import type { Env } from "../env";
import { createInvestigatorAgent } from "./agents/investigator";

/**
 * Built per-request from Hono's `c.env`, not as a module-scope singleton:
 * Wrangler's deploy-time validation pass executes this module's top level
 * before any request exists, so `env.TARGET_DB` (a binding, not a plain
 * string) isn't populated yet — constructing `D1Store` eagerly here fails
 * validation with "D1 binding is required". Building everything from an
 * explicit `env` parameter at request time sidesteps that entirely.
 */
export function createMastra(env: Env): Mastra {
  // @mastra/braintrust's BraintrustExporterConfig only accepts a
  // `projectName` (which silently creates a new project if none matches) —
  // it has no `projectId` field, even though the underlying Braintrust SDK
  // supports logging into a specific existing project by ID. So the logger
  // is initialized directly here and handed to the exporter via
  // `braintrustLogger`, which takes precedence over apiKey/projectName.
  const braintrustLogger = initLogger({
    projectId: env.BRAINTRUST_PROJECT_ID,
    apiKey: env.BRAINTRUST_API_KEY,
  });

  return new Mastra({
    agents: { investigator: createInvestigatorAgent(env) },
    // Mastra's own thread/message storage, namespaced away from target/'s
    // `spans` table in the same D1 database. Investigation traces
    // themselves go to Braintrust below, not here — D1 storage doesn't
    // support persisting the observability domain.
    storage: new D1Store({ id: "millisecond-agent-storage", binding: env.TARGET_DB, tablePrefix: "mastra_" }),
    observability: new Observability({
      configs: {
        braintrust: {
          serviceName: "millisecond-agent",
          exporters: [new BraintrustExporter({ braintrustLogger })],
        },
      },
      // Observability auto-appends a SensitiveDataFilter that redacts any
      // span field matching key/token/secret/auth-like names before it
      // reaches Braintrust — plausible cause of tool call input/output
      // not showing up there. Safe to disable: real secrets only ever
      // live inside `env` and are read inside tool `execute` bodies, never
      // passed as tool arguments or returned as tool results.
      sensitiveDataFilter: false,
    }),
  });
}
