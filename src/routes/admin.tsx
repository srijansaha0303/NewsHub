import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile } from "@/lib/user.functions";
import {
  adminListArticles, adminGetArticle, adminSaveArticle, adminDeleteArticle,
  adminListCategories, adminSaveCategory, adminDeleteCategory,
  adminListUsers, adminSetRole, adminStats,
} from "@/lib/admin.functions";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify } from "@/lib/format";

const meQO = queryOptions({ queryKey: ["me"], queryFn: () => getMyProfile(), retry: false });

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Admin — NewsHub" },
    { name: "description", content: "NewsHub administration." },
    { property: "og:title", content: "Admin — NewsHub" },
    { property: "og:description", content: "NewsHub administration." },
    { name: "robots", content: "noindex" },
  ]}),
  component: AdminShell,
});

function AdminShell() {
  const { data, error } = useSuspenseQuery(meQO);
  useEffect(() => {
    if (error && typeof window !== "undefined") window.location.href = "/auth";
  }, [error]);
  const isAdmin = (data?.roles ?? []).includes("admin");
  const [tab, setTab] = useState<"dashboard" | "articles" | "categories" | "users">("dashboard");

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 grid place-items-center p-10">
          <div className="text-center">
            <h1 className="font-serif text-3xl text-navy-dark">Admin access required</h1>
            <p className="mt-2 text-muted-foreground">Your account doesn't have administrator privileges.</p>
            <Link to="/" className="mt-4 inline-block text-navy-accent underline">Back home</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h1 className="font-serif text-3xl font-bold text-navy-dark">Newsroom admin</h1>
        </div>

        <div className="mt-4 flex gap-1 border-b border-border">
          {(["dashboard", "articles", "categories", "users"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-navy-accent text-navy-dark" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "dashboard" && <DashboardTab />}
          {tab === "articles" && <ArticlesTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </main>
    </div>
  );
}

function DashboardTab() {
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["admin-stats"], queryFn: () => adminStats() }));
  const cards = [
    { k: "Total articles", v: data.articles },
    { k: "Published", v: data.published },
    { k: "Comments", v: data.comments },
    { k: "Users", v: data.users },
    { k: "Subscribers", v: data.subscribers },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.k} className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.k}</div>
          <div className="mt-2 font-serif text-3xl font-bold text-navy-dark">{c.v.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function ArticlesTab() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["admin-articles"], queryFn: () => adminListArticles() }));
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => adminDeleteArticle({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-articles"] }); },
  });

  if (editingId) {
    return <ArticleEditor id={editingId === "new" ? undefined : editingId} onDone={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["admin-articles"] }); }} />;
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditingId("new")}>New article</Button>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Views</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((a: { id: string; title: string; slug: string; status: string; views_count: number; category: { name: string } | null }) => (
              <tr key={a.id}>
                <td className="p-3 font-medium">{a.title}</td>
                <td className="p-3 text-muted-foreground">{a.category?.name ?? "—"}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${a.status === "published" ? "bg-navy-wash text-navy-dark" : "bg-muted text-muted-foreground"}`}>{a.status}</span></td>
                <td className="p-3 text-muted-foreground">{a.views_count}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(a.id)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this article?")) del.mutate(a.id); }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArticleEditor({ id, onDone }: { id?: string; onDone: () => void }) {
  const cats = useSuspenseQuery(queryOptions({ queryKey: ["admin-cats"], queryFn: () => adminListCategories() }));
  const existing = useSuspenseQuery(queryOptions({
    queryKey: ["admin-article", id],
    queryFn: () => id ? adminGetArticle({ data: { id } }) : Promise.resolve(null),
  }));
  const e = existing.data as (Record<string, unknown> & { tags?: string[] }) | null;

  const [title, setTitle] = useState((e?.title as string) ?? "");
  const [slug, setSlug] = useState((e?.slug as string) ?? "");
  const [excerpt, setExcerpt] = useState((e?.excerpt as string) ?? "");
  const [content, setContent] = useState((e?.content as string) ?? "");
  const [cover, setCover] = useState((e?.cover_image_url as string) ?? "");
  const [categoryId, setCategoryId] = useState((e?.category_id as string) ?? "");
  const [author, setAuthor] = useState((e?.author_name as string) ?? "");
  const [status, setStatus] = useState<"draft" | "published">((e?.status as "draft" | "published") ?? "draft");
  const [breaking, setBreaking] = useState(Boolean(e?.is_breaking));
  const [trending, setTrending] = useState(Boolean(e?.is_trending));
  const [readTime, setReadTime] = useState((e?.read_time_minutes as number) ?? 5);
  const [tags, setTags] = useState((e?.tags ?? []).join(", "));

  const save = useMutation({
    mutationFn: () => adminSaveArticle({ data: {
      id, title, slug: slug || slugify(title), excerpt: excerpt || null, content,
      cover_image_url: cover || null, category_id: categoryId || null,
      author_name: author || null, status, is_breaking: breaking, is_trending: trending,
      read_time_minutes: Number(readTime),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    } }),
    onSuccess: () => { toast.success("Saved"); onDone(); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); save.mutate(); }} className="space-y-4 rounded-lg border border-border bg-card p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold">{id ? "Edit article" : "New article"}</h2>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(ev) => { setTitle(ev.target.value); if (!id && !slug) setSlug(slugify(ev.target.value)); }} required maxLength={240} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Slug</Label><Input value={slug} onChange={(ev) => setSlug(ev.target.value)} required /></div>
        <div><Label>Author name</Label><Input value={author} onChange={(ev) => setAuthor(ev.target.value)} /></div>
      </div>
      <div><Label>Excerpt</Label><Textarea value={excerpt} onChange={(ev) => setExcerpt(ev.target.value)} rows={2} maxLength={500} /></div>
      <div><Label>Cover image URL</Label><Input value={cover} onChange={(ev) => setCover(ev.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
            <SelectContent>
              {cats.data.map((c: { id: string; name: string }) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Read time (min)</Label><Input type="number" min={1} max={120} value={readTime} onChange={(ev) => setReadTime(Number(ev.target.value))} /></div>
      </div>
      <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={(ev) => setTags(ev.target.value)} /></div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={breaking} onChange={(ev) => setBreaking(ev.target.checked)} /> Breaking</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={trending} onChange={(ev) => setTrending(ev.target.checked)} /> Trending</label>
      </div>
      <div><Label>Content</Label><Textarea value={content} onChange={(ev) => setContent(ev.target.value)} rows={16} required /></div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={save.isPending}>Save</Button>
      </div>
    </form>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["admin-cats"], queryFn: () => adminListCategories() }));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const add = useMutation({
    mutationFn: () => adminSaveCategory({ data: { name, slug: slug || slugify(name) } }),
    onSuccess: () => { setName(""); setSlug(""); toast.success("Added"); qc.invalidateQueries({ queryKey: ["admin-cats"] }); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminDeleteCategory({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cats"] }); qc.invalidateQueries({ queryKey: ["categories"] }); },
  });
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((c: { id: string; name: string; slug: string }) => (
              <tr key={c.id}>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-muted-foreground">{c.slug}</td>
                <td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) del.mutate(c.id); }}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="rounded-lg border border-border bg-card p-4 space-y-3 h-max">
        <h3 className="font-serif text-lg font-bold">Add category</h3>
        <div><Label>Name</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} required /></div>
        <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} required /></div>
        <Button type="submit" disabled={add.isPending} className="w-full">Add</Button>
      </form>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["admin-users"], queryFn: () => adminListUsers() }));
  const set = useMutation({
    mutationFn: (p: { user_id: string; role: "admin" | "moderator"; grant: boolean }) => adminSetRole({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="p-3">User</th><th className="p-3">Roles</th><th className="p-3"></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((u: { id: string; display_name: string | null; roles: string[] }) => {
            const isAdmin = u.roles.includes("admin");
            const isMod = u.roles.includes("moderator");
            return (
              <tr key={u.id}>
                <td className="p-3 font-medium">{u.display_name ?? u.id.slice(0, 8)}</td>
                <td className="p-3 text-muted-foreground">{u.roles.join(", ") || "user"}</td>
                <td className="p-3 text-right space-x-2">
                  <Button size="sm" variant={isAdmin ? "secondary" : "outline"} onClick={() => set.mutate({ user_id: u.id, role: "admin", grant: !isAdmin })}>
                    {isAdmin ? "Revoke admin" : "Make admin"}
                  </Button>
                  <Button size="sm" variant={isMod ? "secondary" : "outline"} onClick={() => set.mutate({ user_id: u.id, role: "moderator", grant: !isMod })}>
                    {isMod ? "Revoke mod" : "Make mod"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
