import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { Bookmark, Clock, Eye, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCardView } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { getArticleBySlug, listRelated, listComments } from "@/lib/articles.functions";
import { toggleBookmark, isBookmarked, postComment, deleteMyComment, logReadingHistory } from "@/lib/user.functions";

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ params, context }) => {
    const article = await context.queryClient.ensureQueryData(
      queryOptions({ queryKey: ["article", params.slug], queryFn: () => getArticleBySlug({ data: { slug: params.slug } }) })
    );
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Article — NewsHub" }, { name: "robots", content: "noindex" }] };
    const a = loaderData.article;
    const desc = a.excerpt ?? a.title;
    return {
      meta: [
        { title: `${a.title} — NewsHub` },
        { name: "description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:title", content: a.title },
        { property: "og:description", content: desc },
        ...(a.cover_image_url ? [{ property: "og:image", content: a.cover_image_url }, { name: "twitter:image", content: a.cover_image_url }] : []),
      ],
      links: [{ rel: "canonical", href: `/article/${a.slug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen"><SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl">Article not found</h1>
        <Link to="/" className="mt-4 inline-block text-navy-accent underline">Back to home</Link>
      </div>
    </div>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const { user } = useAuth();

  useEffect(() => {
    if (user) logReadingHistory({ data: { articleId: article.id } }).catch(() => undefined);
  }, [user, article.id]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try { await navigator.share({ title: article.title, url }); return; } catch { /* ignore */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const paragraphs = article.content.split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10">
          {article.category && (
            <Link to="/category/$slug" params={{ slug: article.category.slug }} className="text-xs font-bold uppercase tracking-widest text-navy-accent">
              {article.category.name}
            </Link>
          )}
          <h1 className="mt-3 font-serif text-3xl md:text-5xl font-bold leading-tight text-navy-dark">{article.title}</h1>
          {article.excerpt && <p className="mt-4 font-serif text-lg md:text-xl italic text-muted-foreground leading-relaxed">{article.excerpt}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
            <div className="text-sm">
              <span className="font-semibold">{article.author_name ?? "NewsHub Staff"}</span>
              <span className="text-muted-foreground"> · {formatDate(article.published_at)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{article.read_time_minutes} min read</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{article.views_count.toLocaleString()}</span>
              <BookmarkButton articleId={article.id} />
              <Button variant="ghost" size="sm" onClick={share}><Share2 className="h-4 w-4 mr-1" /> Share</Button>
            </div>
          </div>

          {article.cover_image_url && (
            <img src={article.cover_image_url} alt="" className="mt-6 aspect-video w-full rounded-lg object-cover" />
          )}

          <div className="prose-newshub mt-8 space-y-5 text-base md:text-lg leading-relaxed text-foreground/90">
            {paragraphs.map((p: string, i: number) => (
              <p key={i} className="font-serif">{p}</p>
            ))}
          </div>

          {(article.tags?.length ?? 0) > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {(article.tags as string[]).map((t: string) => (
                <span key={t} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}

          <Separator className="my-10" />

          <Suspense fallback={null}><CommentsSection articleId={article.id} /></Suspense>
        </article>

        <Suspense fallback={null}>
          <RelatedSection articleId={article.id} categoryId={null} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

function BookmarkButton({ articleId }: { articleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["bookmarked", articleId, user?.id],
    queryFn: () => isBookmarked({ data: { articleId } }),
    enabled: !!user,
  });
  const m = useMutation({
    mutationFn: () => toggleBookmark({ data: { articleId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["bookmarked", articleId] });
      qc.invalidateQueries({ queryKey: ["my-bookmarks"] });
      toast.success(r.bookmarked ? "Saved to bookmarks" : "Removed from bookmarks");
    },
  });
  if (!user) return null;
  const on = data?.bookmarked;
  return (
    <Button variant={on ? "secondary" : "ghost"} size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
      <Bookmark className={`h-4 w-4 mr-1 ${on ? "fill-current" : ""}`} />
      {on ? "Saved" : "Save"}
    </Button>
  );
}

function RelatedSection({ articleId, categoryId }: { articleId: string; categoryId: string | null }) {
  const { data } = useSuspenseQuery(queryOptions({
    queryKey: ["related", articleId],
    queryFn: () => listRelated({ data: { articleId, categoryId } }),
  }));
  if (!data.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="font-serif text-2xl font-bold text-navy-dark border-b-2 border-navy-dark pb-2">Also on NewsHub</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {data.map((a) => <ArticleCardView key={a.id} article={a} variant="card" />)}
      </div>
    </section>
  );
}

function CommentsSection({ articleId }: { articleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const qo = queryOptions({
    queryKey: ["comments", articleId],
    queryFn: () => listComments({ data: { articleId } }),
  });
  const { data } = useSuspenseQuery(qo);

  const post = useMutation({
    mutationFn: () => postComment({ data: { articleId, body } }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["comments", articleId] }); toast.success("Comment posted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteMyComment({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", articleId] }),
  });

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-navy-dark">Reader discussion ({data.length})</h2>
      {user ? (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) post.mutate(); }} className="mt-4 space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your perspective..." rows={3} maxLength={2000} />
          <div className="flex justify-end">
            <Button type="submit" disabled={post.isPending || !body.trim()}>Post comment</Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-muted p-4 text-sm">
          <Link to="/auth" className="font-medium text-navy-accent underline">Sign in</Link> to join the conversation.
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {data.map((c) => (
          <li key={c.id} className="border-b border-border pb-4">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-wash text-navy-dark text-xs font-semibold">
                {c.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.display_name}</span>
                  <span>· {formatDate(c.created_at)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                {user?.id === c.user_id && (
                  <button onClick={() => del.mutate(c.id)} className="mt-1 text-xs text-muted-foreground hover:text-destructive">Delete</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
