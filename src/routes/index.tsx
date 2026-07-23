import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreakingTicker } from "@/components/breaking-ticker";
import { ArticleCardView } from "@/components/article-card";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { listArticles, listCategories } from "@/lib/articles.functions";

const breakingQO = queryOptions({
  queryKey: ["articles", "breaking"],
  queryFn: () => listArticles({ data: { breakingOnly: true, limit: 6, sort: "newest" } }),
  staleTime: 30_000,
});
const heroQO = queryOptions({
  queryKey: ["articles", "hero"],
  queryFn: () => listArticles({ data: { limit: 9, sort: "newest" } }),
  staleTime: 30_000,
});
const trendingQO = queryOptions({
  queryKey: ["articles", "trending"],
  queryFn: () => listArticles({ data: { trendingOnly: true, limit: 5, sort: "popular" } }),
  staleTime: 30_000,
});
const catsQO = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NewsHub — Independent journalism, delivered daily" },
      { name: "description", content: "The stories shaping our world — breaking news, reporting, and analysis in politics, business, tech, and culture." },
      { property: "og:title", content: "NewsHub — Independent journalism, delivered daily" },
      { property: "og:description", content: "The stories shaping our world — breaking news, reporting, and analysis." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catsQO);
    context.queryClient.ensureQueryData(breakingQO);
    context.queryClient.ensureQueryData(heroQO);
    context.queryClient.ensureQueryData(trendingQO);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <Suspense fallback={null}><TickerBar /></Suspense>
      <main className="flex-1">
        <Suspense fallback={<div className="h-96" />}><HeroGrid /></Suspense>
        <Suspense fallback={null}><CategorySections /></Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

function TickerBar() {
  const { data } = useSuspenseQuery(breakingQO);
  return <BreakingTicker items={data.rows} />;
}

function HeroGrid() {
  const { data } = useSuspenseQuery(heroQO);
  const { data: trending } = useSuspenseQuery(trendingQO);
  const rows = data.rows;
  if (!rows.length) return null;
  const [lead, ...rest] = rows;
  const feature = rest.slice(0, 2);
  const wide = rest.slice(2, 5);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Lead story - takes 8 cols */}
        <div className="lg:col-span-8">
          <ArticleCardView article={lead} variant="hero" className="h-full" />
        </div>

        {/* Trending sidebar - 4 cols */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <TrendingUp className="h-4 w-4 text-navy-accent" />
              <h3 className="font-serif text-sm font-bold uppercase tracking-widest text-navy-dark">Most Read</h3>
            </div>
            <ol className="mt-2 divide-y divide-border">
              {trending.rows.slice(0, 5).map((a, i) => (
                <li key={a.id} className="py-3">
                  <Link to="/article/$slug" params={{ slug: a.slug }} className="group flex gap-3">
                    <span className="font-serif text-2xl font-bold text-navy-wash">{i + 1}</span>
                    <span className="font-serif text-sm font-semibold leading-snug group-hover:text-navy-accent">
                      {a.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-navy-wash p-5">
            <NewsletterSignup />
          </div>
        </aside>
      </div>

      {/* Bento row: 2 features + 3 wide stack */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {feature.map((a) => (
          <div key={a.id} className="lg:col-span-4">
            <ArticleCardView article={a} variant="feature" />
          </div>
        ))}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {wide.map((a) => (
            <ArticleCardView key={a.id} article={a} variant="wide" />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategorySections() {
  const { data: cats } = useSuspenseQuery(catsQO);
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-12">
      {cats.slice(0, 4).map((c) => (
        <Suspense key={c.id} fallback={null}>
          <CategorySection slug={c.slug} name={c.name} />
        </Suspense>
      ))}
    </div>
  );
}

function CategorySection({ slug, name }: { slug: string; name: string }) {
  const qo = queryOptions({
    queryKey: ["articles", "cat", slug],
    queryFn: () => listArticles({ data: { categorySlug: slug, limit: 4 } }),
    staleTime: 30_000,
  });
  const { data } = useSuspenseQuery(qo);
  if (!data.rows.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between border-b-2 border-navy-dark pb-2">
        <h2 className="font-serif text-2xl font-bold text-navy-dark">{name}</h2>
        <Link to="/category/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-sm font-medium text-navy-accent hover:underline">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {data.rows.map((a) => <ArticleCardView key={a.id} article={a} variant="card" />)}
      </div>
    </section>
  );
}
