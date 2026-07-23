import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { listMyBookmarks } from "@/lib/user.functions";

const qo = queryOptions({ queryKey: ["my-bookmarks"], queryFn: () => listMyBookmarks() });

export const Route = createFileRoute("/bookmarks")({
  head: () => ({ meta: [
    { title: "Your bookmarks — NewsHub" },
    { name: "description", content: "Articles you've saved on NewsHub." },
    { property: "og:title", content: "Your bookmarks — NewsHub" },
    { property: "og:description", content: "Articles you've saved on NewsHub." },
    { name: "robots", content: "noindex" },
  ]}),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { data, error } = useSuspenseQuery({ ...qo, retry: false });
  if (error) {
    if (typeof window !== "undefined") window.location.href = "/auth";
    return null;
  }
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-10">
        <h1 className="font-serif text-3xl font-bold text-navy-dark border-b-2 border-navy-dark pb-3">Your bookmarks</h1>
        {data.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">No bookmarks yet. Tap the save icon on any article.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border">
            {data.map((b: { id: string; article: { slug: string; title: string; excerpt: string | null; cover_image_url: string | null; category: { name: string } | null } | null }) => b.article && (
              <li key={b.id} className="py-5">
                <Link to="/article/$slug" params={{ slug: b.article.slug }} className="group grid grid-cols-[minmax(0,1fr)_100px] gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="min-w-0">
                    {b.article.category && <span className="text-xs font-bold uppercase tracking-wider text-navy-accent">{b.article.category.name}</span>}
                    <h3 className="mt-1 font-serif text-lg font-semibold group-hover:text-navy-accent">{b.article.title}</h3>
                    {b.article.excerpt && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{b.article.excerpt}</p>}
                  </div>
                  {b.article.cover_image_url && (
                    <img src={b.article.cover_image_url} alt="" className="h-full max-h-24 w-full rounded-md object-cover shrink-0" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
