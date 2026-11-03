import ReactMarkdown from 'react-markdown';

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <h3 className="font-semibold text-base mb-1">{children}</h3>,
        h2: ({ children }) => <h3 className="font-semibold text-base mb-1">{children}</h3>,
        h3: ({ children }) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock ? (
            <pre className="bg-black/30 rounded-lg p-3 my-2 overflow-x-auto text-xs">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-white/10 rounded px-1 py-0.5 text-[0.9em]">{children}</code>
          );
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic my-2">{children}</blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-sm border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }: { children?: React.ReactNode }) => <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50">{children}</th>,
        td: ({ children }: { children?: React.ReactNode }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
