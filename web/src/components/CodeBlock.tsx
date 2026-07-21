import { useEffect, useState } from "react";
import { highlightCode } from "../lib/highlightCode";

interface CodeBlockProps {
  code: string;
  lang: string;
}

/**
 * Syntax-highlights one fenced code block via Shiki. The `useEffect` here
 * is the legitimate case our own principles carve out: synchronizing with
 * an external, async system (Shiki's WASM-backed highlighter), not
 * chasing local state.
 */
export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="code-block code-block--loading">
        <code>{code}</code>
      </pre>
    );
  }

  return <div className="code-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
