import ReactMarkdown from "react-markdown";
import Link from "next/link";

const components = {
  a: ({ href, children }) => {
    const url = String(href || "");
    const internal = url.startsWith("/docs");
    if (internal) {
      return (
        <Link href={url} className="font-medium text-primary underline underline-offset-2">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={url}
        className="font-medium text-primary underline underline-offset-2"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  },
  h1: ({ children }) => (
    <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 text-xl font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[15px] leading-relaxed text-foreground/90">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[15px] text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-[15px] text-foreground/90">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[12px] leading-relaxed">
      {children}
    </pre>
  ),
  img: ({ src, alt }) => (
    <span className="mb-6 mt-2 block overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- docs markdown images from /public */}
      <img
        src={src}
        alt={alt || ""}
        className="h-auto w-full max-w-full"
        loading="lazy"
      />
    </span>
  ),
};

export function DocsArticle({ title, description, body }) {
  return (
    <article className="min-w-0 max-w-3xl">
      {description ? (
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <ReactMarkdown components={components}>{body}</ReactMarkdown>
      {/* Keep title in DOM for crawlers even when H1 is in markdown */}
      <h1 className="sr-only">{title}</h1>
    </article>
  );
}
