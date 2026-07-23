import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { ArticleCardView } from "@/components/article-card";
import { listArticles } from "@/lib/articles.functions";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Search — NewsHub" },
      { name: "description", content: "Search NewsHub articles by keyword, author, or topic." },
      { property: "og:title", content: "Search — NewsHub" },
      { property: "og:description", content: "Search NewsHub articles by keyword, author, or topic." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const nav = Route.useNavigate();
  const [term, setTerm] = useState(initial ?? "");

  const { data, isFetching } = useQuery({
    queryKey: ["search", initial],
    queryFn: () => listArticles({ data: { search: initial, limit: 40 } }),
    enabled: !!initial,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ search: { q: term.trim() || undefined } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-10">
        <h1 className="font-serif text-3xl font-bold text-navy-dark">Search</h1>
        <form onSubmit={onSubmit} className="mt-4 relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Try 'election', 'climate', or an author name..." className="pl-9 h-12 text-base" autoFocus />
        </form>

        <div className="mt-8">
          {!initial && <p className="text-sm text-muted-foreground">Enter a search term to see results.</p>}
          {initial && isFetching && <p className="text-sm text-muted-foreground">Searching...</p>}
          {initial && data && data.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches for "{initial}".</p>
          )}
          {data && data.rows.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground mb-4">{data.rows.length} result{data.rows.length === 1 ? "" : "s"} for "{initial}"</p>
              <div className="grid gap-4">
                {data.rows.map((a) => <ArticleCardView key={a.id} article={a} variant="wide" />)}
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
