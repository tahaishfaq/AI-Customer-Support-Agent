"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const components = {
  h1: ({ children }) => (
    <h2 className="mt-6 mb-2 border-b border-[var(--color-border)] pb-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)] first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-5 mb-2 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-text)] first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold text-[var(--color-text)] first:mt-0">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold text-[var(--color-text)] first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 text-[14px] leading-relaxed text-[var(--color-text-secondary)] last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[14px] text-[var(--color-text-secondary)] last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[14px] text-[var(--color-text-secondary)] last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-[var(--color-text)]">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-text)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[var(--color-primary)] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-[var(--color-primary)] pl-3 text-[14px] text-[var(--color-muted)]">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white px-1 py-0.5 text-[12px] text-[var(--color-text)]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-white p-3 text-[12px] last:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-[var(--color-border)]" />,
};

function parseFaqBlocks(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const re = /(?:^|\n)\s*Q:\s*([\s\S]*?)\n\s*A:\s*([\s\S]*?)(?=(?:\n\s*Q:)|$)/gi;
  const blocks = [];
  let match;
  while ((match = re.exec(text))) {
    const question = match[1].trim();
    const answer = match[2].trim();
    if (question && answer) {
      blocks.push({ question, answer });
    }
  }
  return blocks;
}

export function buildFaqMarkdown(pairs) {
  return pairs
    .filter((p) => p.question.trim() && p.answer.trim())
    .map((p) => `Q: ${p.question.trim()}\nA: ${p.answer.trim()}`)
    .join("\n\n");
}

export function KnowledgeMarkdown({ content, className }) {
  const raw = String(content || "").trim();
  if (!raw) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No content available.</p>
    );
  }

  const faqs = parseFaqBlocks(raw);
  const faqOnly = faqs.length > 0 && !/^#{1,6}\s/m.test(raw);

  if (faqOnly) {
    return (
      <div className={cn("space-y-3", className)}>
        {faqs.map((item, index) => (
          <article
            key={`${item.question}-${index}`}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
          >
            <p className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text)]">
              {item.question}
            </p>
            <div className="px-4 py-3">
              <ReactMarkdown components={components}>{item.answer}</ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("knowledge-md", className)}>
      <ReactMarkdown components={components}>{raw}</ReactMarkdown>
    </div>
  );
}
