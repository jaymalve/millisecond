import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "../../env";
import { githubHeaders } from "./deploys";

export const getDiffTool = createTool({
  id: "get-diff",
  description: "Fetch the unified diff for a specific commit SHA.",
  inputSchema: z.object({ sha: z.string() }),
  outputSchema: z.string(),
  execute: async ({ sha }) => {
    const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commits/${sha}`;
    const res = await fetch(url, {
      headers: { ...githubHeaders(), accept: "application/vnd.github.v3.diff" },
    });
    if (!res.ok) {
      throw new Error(`GitHub diff API error: ${res.status} ${await res.text()}`);
    }
    return res.text();
  },
});
