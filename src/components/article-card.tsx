import { Link } from "@tanstack/react-router";
import { Clock, Eye } from "lucide-react";
import type { ArticleCard } from "@/lib/articles.functions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Variant = "hero" | "feature" | "card" | "compact" | "wide";

export function ArticleCardView({ article, variant = "card", className }: { article: ArticleCard; variant?: Variant; className?: string }) {
  const to = "/article/$slug" as const;
  const params = { slug: article.slug };
  const cat = article.category?.name;

  if (variant === "hero") {
    return (
      <Link to={to} params={params} className={cn("group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card", className)}>
        {article.cover_image_url && (
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            <img src={article.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-linear-to-t from-navy-dark/80 via-navy-dark/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
              {cat && <span className="inline-block rounded-sm bg-breaking px-2 py-0.5 text-xs font-bold uppercase tracking-widest">{cat}</span>}
              <h2 className="mt-3 font-serif text-2xl md:text-4xl font-bold leading-tight group-hover:underline decoration-2 underline-offset-4">
                {article.title}
              </h2>
              {article.excerpt && <p className="mt-3 max-w-2xl text-sm md:text-base text-primary-foreground/85 line-clamp-2">{article.excerpt}</p>}
              <Meta article={article} className="mt-4 text-primary-foreground/70" />
            </div>
          </div>
        )}
      </Link>
    );
  }

  if (variant === "feature") {
    return (
      <Link to={to} params={params} className={cn("group flex flex-col gap-3 rounded-lg border border-border bg-card overflow-hidden", className)}>
        {article.cover_image_url && (
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            <img src={article.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        )}
        <div className="px-4 pb-4 flex flex-col gap-2">
          {cat && <span className="text-xs font-bold uppercase tracking-wider text-navy-accent">{cat}</span>}
          <h3 className="font-serif text-xl font-bold leading-snug text-foreground group-hover:text-navy-accent transition-colors">{article.title}</h3>
          {article.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>}
          <Meta article={article} className="mt-1" />
        </div>
      </Link>
    );
  }

  if (variant === "wide") {
    return (
      <Link to={to} params={params} className={cn("group grid grid-cols-[minmax(0,1fr)_140px] gap-4 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_200px]", className)}>
        <div className="min-w-0 flex flex-col justify-between">
          <div>
            {cat && <span className="text-xs font-bold uppercase tracking-wider text-navy-accent">{cat}</span>}
            <h3 className="mt-1 font-serif text-lg font-semibold leading-snug group-hover:text-navy-accent">{article.title}</h3>
            {article.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>}
          </div>
          <Meta article={article} className="mt-3" />
        </div>
        {article.cover_image_url && (
          <div className="aspect-square overflow-hidden rounded-md bg-muted shrink-0">
            <img src={article.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link to={to} params={params} className={cn("group flex flex-col gap-1 border-b border-border pb-3", className)}>
        {cat && <span className="text-[10px] font-bold uppercase tracking-widest text-navy-accent">{cat}</span>}
        <h4 className="font-serif text-base font-semibold leading-snug group-hover:text-navy-accent">{article.title}</h4>
        <Meta article={article} className="mt-1" />
      </Link>
    );
  }

  return (
    <Link to={to} params={params} className={cn("group flex flex-col gap-3 rounded-lg border border-border bg-card overflow-hidden", className)}>
      {article.cover_image_url && (
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img src={article.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      )}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {cat && <span className="text-xs font-bold uppercase tracking-wider text-navy-accent">{cat}</span>}
        <h3 className="font-serif text-lg font-semibold leading-snug group-hover:text-navy-accent">{article.title}</h3>
        {article.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>}
        <Meta article={article} className="mt-1" />
      </div>
    </Link>
  );
}

function Meta({ article, className }: { article: ArticleCard; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {article.author_name && <span>{article.author_name}</span>}
      <span>·</span>
      <span>{formatRelative(article.published_at)}</span>
      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{article.read_time_minutes} min</span>
      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{article.views_count.toLocaleString()}</span>
    </div>
  );
}
