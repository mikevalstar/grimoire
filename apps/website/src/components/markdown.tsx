import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 className="mt-6 mb-3 text-xl font-bold first:mt-0" {...props} />,
        h2: (props) => <h2 className="mt-5 mb-2 text-lg font-semibold first:mt-0" {...props} />,
        h3: (props) => <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...props} />,
        p: (props) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
        ul: (props) => <ul className="mb-3 list-disc pl-6 last:mb-0" {...props} />,
        ol: (props) => <ol className="mb-3 list-decimal pl-6 last:mb-0" {...props} />,
        li: (props) => <li className="mb-1" {...props} />,
        a: (props) => (
          <a
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            {...props}
          />
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code
                className="block overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <div className="mb-3 last:mb-0">{children}</div>,
        blockquote: (props) => (
          <blockquote
            className="mb-3 border-l-2 border-primary/30 pl-4 italic text-muted-foreground last:mb-0"
            {...props}
          />
        ),
        table: (props) => (
          <div className="mb-3 overflow-x-auto last:mb-0">
            <table className="w-full text-sm" {...props} />
          </div>
        ),
        thead: (props) => <thead className="border-b" {...props} />,
        tr: (props) => <tr className="border-b last:border-0" {...props} />,
        th: (props) => (
          <th className="px-3 py-2 text-left font-medium text-muted-foreground" {...props} />
        ),
        td: (props) => <td className="px-3 py-2" {...props} />,
        hr: () => <hr className="my-4 border-border" />,
        strong: (props) => <strong className="font-semibold" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
