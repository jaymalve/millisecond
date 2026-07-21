import { codeToHtml } from "shiki";

const SUPPORTED_LANGS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "bash",
  "sh",
  "sql",
  "diff",
  "toml",
  "yaml",
  "html",
  "css",
  "text",
]);

/** Shiki throws on an unrecognized language id, so unknown/streaming-partial language hints fall back to plain text rather than erroring the whole render. */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const safeLang = SUPPORTED_LANGS.has(lang) ? lang : "text";
  return codeToHtml(code, { lang: safeLang, theme: "github-dark" });
}
