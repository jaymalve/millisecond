import { env as workerEnv } from "cloudflare:workers";
import type { PostDeployCheckParams } from "./postDeploy/postDeployWorkflow";

export interface Env {
  TARGET_DB: D1Database;
  OPENAI_API_KEY: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  TARGET_SCRIPT_NAME: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_PROJECT_ID: string;
  POST_DEPLOY_CHECK: Workflow<PostDeployCheckParams>;
}

// `cloudflare:workers`'s `env` is populated by the runtime even when read
// at module scope — which is what lets `mastra/index.ts` construct
// `new Mastra({...})` (also module scope) with real bindings. One cast,
// here, so every other file just imports a correctly-typed `env`.
export const env = workerEnv as unknown as Env;
