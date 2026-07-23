import { Link } from "@tanstack/react-router";
import type { ArticleCard } from "@/lib/articles.functions";
import { formatRelative } from "@/lib/format";

export function BreakingTicker({ items }: { items: ArticleCard[] }) {
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="border-y border-border bg-breaking text-primary-foreground overflow-hidden">
      <div className="mx-auto max-w-7xl flex items-stretch">
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-navy-dark font-serif text-xs font-bold uppercase tracking-widest">
          <span className="h-2 w-2 rounded-full bg-breaking animate-pulse" />
          Breaking
        </div>
        <div className="relative flex-1 overflow-hidden no-scrollbar">
          <div className="marquee-track gap-10 py-2 pl-6 whitespace-nowrap">
            {doubled.map((a, i) => (
              <Link key={`${a.id}-${i}`} to="/article/$slug" params={{ slug: a.slug }} className="text-sm hover:underline">
                <span className="opacity-70 mr-2">{formatRelative(a.published_at)} ·</span>
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
