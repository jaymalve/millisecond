import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "../../env";

const MetricPointSchema = z.object({
  datetimeHour: z.string(),
  requests: z.number(),
  errors: z.number(),
  cpuTimeP50Ms: z.number(),
  cpuTimeP99Ms: z.number(),
  wallTimeP50Ms: z.number(),
  wallTimeP99Ms: z.number(),
});

/**
 * Narrows the GraphQL response at the fetch boundary instead of casting
 * — `data`/`viewer` are nullable rather than absent-on-error, matching
 * how a GraphQL response can carry `errors` alongside partial/null `data`
 * rather than one or the other.
 */
const GraphQLResponseSchema = z.object({
  data: z
    .object({
      viewer: z
        .object({
          accounts: z.array(
            z.object({
              workersInvocationsAdaptive: z.array(
                z.object({
                  dimensions: z.object({ datetimeHour: z.string() }),
                  sum: z.object({ requests: z.number(), errors: z.number() }),
                  quantiles: z.object({
                    cpuTimeP50: z.number(),
                    cpuTimeP99: z.number(),
                    wallTimeP50: z.number(),
                    wallTimeP99: z.number(),
                  }),
                }),
              ),
            }),
          ),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

/**
 * Field names below are the `workersInvocationsAdaptive` GraphQL dataset
 * as of early 2025 — verify against Cloudflare's schema explorer
 * (https://developers.cloudflare.com/analytics/graphql-api/) if this
 * starts erroring; the dataset shape has changed before.
 *
 * Cloudflare returns cpuTime/wallTime quantiles in microseconds, not
 * milliseconds — confirmed against a live query where wallTimeP50 came
 * back as 180460 for a route that actually takes ~180ms. Converted to ms
 * here so every downstream consumer (regression detection, cost
 * estimates, the agent's own reasoning) works in one consistent unit.
 */
export const getMetricsTool = createTool({
  id: "get-metrics",
  description:
    "Fetch hourly request count, error count, and CPU/wall-time quantiles (in milliseconds) for the target worker between two ISO timestamps.",
  inputSchema: z.object({
    since: z.string().describe("ISO 8601 start time"),
    until: z.string().describe("ISO 8601 end time"),
  }),
  outputSchema: z.array(MetricPointSchema),
  execute: async ({ since, until }) => {
    const query = `
      query WorkerMetrics($accountTag: String!, $scriptName: String!, $since: Time!, $until: Time!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            workersInvocationsAdaptive(
              limit: 200
              filter: { scriptName: $scriptName, datetime_geq: $since, datetime_leq: $until }
              orderBy: [datetimeHour_ASC]
            ) {
              dimensions { datetimeHour }
              sum { requests errors }
              quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: env.CF_ACCOUNT_ID,
          scriptName: env.TARGET_SCRIPT_NAME,
          since,
          until,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Cloudflare GraphQL API error: ${res.status} ${await res.text()}`);
    }

    const json = GraphQLResponseSchema.parse(await res.json());
    if (json.errors?.length) {
      throw new Error(`Cloudflare GraphQL API returned errors: ${JSON.stringify(json.errors)}`);
    }

    const rows = json.data?.viewer?.accounts[0]?.workersInvocationsAdaptive ?? [];
    return rows.map((r) => ({
      datetimeHour: r.dimensions.datetimeHour,
      requests: r.sum.requests,
      errors: r.sum.errors,
      cpuTimeP50Ms: r.quantiles.cpuTimeP50 / 1000,
      cpuTimeP99Ms: r.quantiles.cpuTimeP99 / 1000,
      wallTimeP50Ms: r.quantiles.wallTimeP50 / 1000,
      wallTimeP99Ms: r.quantiles.wallTimeP99 / 1000,
    }));
  },
});
