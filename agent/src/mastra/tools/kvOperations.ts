import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "../../env";

const KvOperationPointSchema = z.object({
  date: z.string(),
  actionType: z.enum(["read", "write", "delete", "list"]),
  requests: z.number(),
});

/**
 * Narrows the GraphQL response at the fetch boundary instead of casting —
 * same reasoning as get-metrics: `data`/`viewer` are nullable rather than
 * absent-on-error.
 */
const GraphQLResponseSchema = z.object({
  data: z
    .object({
      viewer: z
        .object({
          accounts: z.array(
            z.object({
              kvOperationsAdaptiveGroups: z.array(
                z.object({
                  dimensions: z.object({
                    date: z.string(),
                    actionType: z.enum(["read", "write", "delete", "list"]),
                  }),
                  sum: z.object({ requests: z.number() }),
                }),
              ),
            }),
          ),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  // `.nullish()`, not `.optional()` — Cloudflare's GraphQL API sends an
  // explicit `"errors": null` on a clean response, not an absent key.
  // `.optional()` only accepts `undefined`; confirmed live, every
  // successful response was failing Zod parsing on this field alone.
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

/**
 * KV analytics use `date` (day granularity), not `datetimeHour` like
 * workersInvocationsAdaptive — Cloudflare's storage datasets (R2/KV/D1)
 * are all day-bucketed, confirmed against
 * developers.cloudflare.com/kv/observability/metrics-analytics/. Don't
 * "fix" this to hourly buckets; the dataset doesn't support it.
 */
export const getKvOperationsTool = createTool({
  id: "get-kv-operations",
  description:
    "Fetch daily Workers KV operation counts (read/write/delete/list) for the target worker's CACHE namespace between two dates. Use this to check whether a route is actually hitting KV as expected — e.g. an unexpectedly low read count alongside high route latency suggests the cache lookup itself isn't the bottleneck; an unexpectedly high write count suggests something is bypassing a cache that should be reused.",
  inputSchema: z.object({
    since: z.string().describe("Date, YYYY-MM-DD, inclusive"),
    until: z.string().describe("Date, YYYY-MM-DD, inclusive"),
  }),
  outputSchema: z.array(KvOperationPointSchema),
  execute: async ({ since, until }) => {
    const query = `
      query KvOperations($accountTag: string!, $namespaceId: string!, $since: Date!, $until: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            kvOperationsAdaptiveGroups(
              filter: { namespaceId: $namespaceId, date_geq: $since, date_leq: $until }
              limit: 1000
              orderBy: [date_ASC]
            ) {
              dimensions { date actionType }
              sum { requests }
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
          namespaceId: env.TARGET_KV_NAMESPACE_ID,
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

    const rows = json.data?.viewer?.accounts[0]?.kvOperationsAdaptiveGroups ?? [];
    return rows.map((r) => ({
      date: r.dimensions.date,
      actionType: r.dimensions.actionType,
      requests: r.sum.requests,
    }));
  },
});
