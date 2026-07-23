import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCardView } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listArticles, listCategories } from "@/lib/articles.functions";

const catsQO = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${cap(params.slug)} — NewsHub` },
      { name: "description", content: `Latest ${params.slug} news and analysis from NewsHub.` },
      { property: "og:title", content: `${cap(params.slug)} — NewsHub` },
      { property: "og:description", content: `Latest ${params.slug} news and analysis from NewsHub.` },
    ],
    links: [{ rel: "canonical", href: `/category/${params.slug}` }],
  }),
  loader: async ({ context, params }) => {
    const cats = await context.queryClient.ensureQueryData(catsQO);
    const cat = cats.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    return { category: cat };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col"><SiteHeader />
      <div className="flex-1 grid place-items-center p-10">
        <div className="text-center">
          <h1 className="font-serif text-3xl">Section not found</h1>
        </div>
      </div>
    </div>
  ),
  component: CategoryPage,
});

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const PAGE = 12;

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  const qo = queryOptions({
    queryKey: ["articles", "cat-page", category.slug, sort, page],
    queryFn: () => listArticles({ data: { categorySlug: category.slug, sort, page, pageSize: PAGE } }),
    staleTime: 30_000,
  });
  const { data } = useSuspenseQuery(qo);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-10">
        <div className="border-b border-border pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-navy-accent">Section</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl font-bold text-navy-dark">{category.name}</h1>
          {category.description && <p className="mt-3 max-w-2xl text-muted-foreground">{category.description}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Tabs value={sort} onValueChange={(v) => { setSort(v as "newest" | "popular"); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="newest">Newest</TabsTrigger>
              <TabsTrigger value="popular">Most read</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">{data.total.toLocaleString()} articles</p>
        </div>

        {data.rows.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">No articles in this section yet.</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((a) => <ArticleCardView key={a.id} article={a} variant="card" />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => { setPage(page - 1); qc.invalidateQueries(); }}>Previous</Button>
            <span className="text-sm text-muted-foreground px-3">Page {page} of {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => { setPage(page + 1); qc.invalidateQueries(); }}>Next</Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
