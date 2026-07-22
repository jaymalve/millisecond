import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "../../env";

const DeployInfoSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  message: z.string(),
  authoredAt: z.string(),
  url: z.string(),
});

/** Narrows the GitHub commits API response at the fetch boundary instead of casting. */
const GitHubCommitSchema = z.object({
  sha: z.string(),
  html_url: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({ date: z.string() }),
  }),
});

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "millisecond-dev-agent",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

/**
 * Lists commits touching the target worker's source (path filter on
 * `target/`), treating each commit as a "deploy" — the demo project
 * deploys on every push, so commit and deploy history line up. Works
 * unauthenticated against public repos at GitHub's lower rate limit
 * (60 req/hr); set GITHUB_TOKEN to raise it.
 */
export const listDeploysTool = createTool({
  id: "list-deploys",
  description: "List recent commits (treated as deploys) that touched the target worker's source.",
  inputSchema: z.object({}),
  outputSchema: z.array(DeployInfoSchema),
  execute: async () => {
    const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commits?path=target&per_page=20`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) {
      throw new Error(`GitHub commits API error: ${res.status} ${await res.text()}`);
    }
    const rows = z.array(GitHubCommitSchema).parse(await res.json());
    return rows.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit.message,
      authoredAt: c.commit.author.date,
      url: c.html_url,
    }));
  },
});
