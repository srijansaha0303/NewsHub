import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getMyProfile, updateMyProfile, listMyHistory } from "@/lib/user.functions";

const meQO = queryOptions({ queryKey: ["me"], queryFn: () => getMyProfile(), retry: false });
const histQO = queryOptions({ queryKey: ["my-history"], queryFn: () => listMyHistory(), retry: false });

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "Your profile — NewsHub" },
    { name: "description", content: "Manage your NewsHub profile and reading history." },
    { property: "og:title", content: "Your profile — NewsHub" },
    { property: "og:description", content: "Manage your NewsHub profile." },
    { name: "robots", content: "noindex" },
  ]}),
  component: ProfilePage,
});

function ProfilePage() {
  const { data, error } = useSuspenseQuery(meQO);
  const { data: history } = useSuspenseQuery(histQO);
  const qc = useQueryClient();

  useEffect(() => {
    if (error && typeof window !== "undefined") window.location.href = "/auth";
  }, [error]);

  const [name, setName] = useState(data?.profile?.display_name ?? "");
  const [bio, setBio] = useState(data?.profile?.bio ?? "");
  const [avatar, setAvatar] = useState(data?.profile?.avatar_url ?? "");

  const save = useMutation({
    mutationFn: () => updateMyProfile({ data: { display_name: name, bio: bio || null, avatar_url: avatar || null } }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl w-full px-4 py-10 space-y-10">
        <section>
          <h1 className="font-serif text-3xl font-bold text-navy-dark border-b-2 border-navy-dark pb-3">Your profile</h1>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio ?? ""} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} />
            </div>
            <div>
              <Label htmlFor="av">Avatar URL</Label>
              <Input id="av" value={avatar ?? ""} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>Save changes</Button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-navy-dark border-b border-border pb-2">Recently read</h2>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing here yet — your reading history will appear as you browse.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {history.slice(0, 15).map((h: { id: string; read_at: string; article: { slug: string; title: string; category: { name: string } | null } | null }) => h.article && (
                <li key={h.id} className="py-3">
                  <a href={`/article/${h.article.slug}`} className="text-sm font-serif font-medium hover:text-navy-accent">
                    {h.article.title}
                  </a>
                  {h.article.category && <span className="ml-2 text-xs text-muted-foreground">{h.article.category.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
