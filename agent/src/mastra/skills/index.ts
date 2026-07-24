import { ROUTE_REGRESSION_SKILL } from "./routeRegression";
import { CLOUDFLARE_OPS_SKILL } from "./cloudflareOps";

export const SKILL_NAMES = ["route-regression", "cloudflare-ops"] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

interface Skill {
  description: string;
  content: string;
}

export const skills: Record<SkillName, Skill> = {
  "route-regression": {
    description:
      'Investigating a specific performance or cost regression on a known route (e.g. "/api/orders got slower", "why did CPU cost jump this week"). Ties a metrics regression to the deploy and code change that caused it.',
    content: ROUTE_REGRESSION_SKILL,
  },
  "cloudflare-ops": {
    description:
      "General Cloudflare operational questions that aren't about a specific known regression — cache behavior (is KV actually being hit, read vs write volume), whole-worker traffic/cost trends, or anything where there's no single route/deploy to pin down yet.",
    content: CLOUDFLARE_OPS_SKILL,
  },
};
