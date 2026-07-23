import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, User, LogOut, Bookmark, Shield, Menu } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { listCategories } from "@/lib/articles.functions";
import { queryOptions } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/user.functions";

export const categoriesQO = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
  staleTime: 60_000,
});

const meQO = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMyProfile(),
  staleTime: 30_000,
  retry: false,
});

export function SiteHeader() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const cats = useSuspenseQuery(categoriesQO);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav({ to: "/search", search: { q: q.trim() } });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-sm bg-navy-dark text-primary-foreground font-serif font-bold">
                N
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-navy-dark">NewsHub</span>
            </Link>
          </div>

          <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search articles..."
                className="pl-9"
              />
            </div>
          </form>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user ? <UserMenu /> : (
              <>
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="mt-8 flex flex-col gap-1">
                  <Link to="/" className="px-3 py-2 text-sm font-medium hover:bg-accent rounded-md">Home</Link>
                  {cats.data.map((c) => (
                    <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="px-3 py-2 text-sm hover:bg-accent rounded-md">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <nav className="hidden lg:flex h-11 items-center gap-6 border-t border-border/60">
          <Link to="/" className="text-sm font-medium text-foreground hover:text-navy-accent" activeOptions={{ exact: true }} activeProps={{ className: "text-navy-accent" }}>
            Home
          </Link>
          {cats.data.map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="text-sm text-muted-foreground hover:text-navy-accent transition-colors"
              activeProps={{ className: "text-navy-accent font-medium" }}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function UserMenu() {
  const nav = useNavigate();
  const { data } = useSuspenseQuery(meQO);
  const isAdmin = (data?.roles ?? []).includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  const name = data?.profile?.display_name ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-navy-wash text-navy-dark text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span className="hidden sm:inline max-w-[120px] truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/bookmarks"><Bookmark className="mr-2 h-4 w-4" />Bookmarks</Link></DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild><Link to="/admin"><Shield className="mr-2 h-4 w-4" />Admin</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
