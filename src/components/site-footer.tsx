import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQO } from "@/components/site-header";
import { NewsletterSignup } from "@/components/newsletter-signup";

export function SiteFooter() {
  const cats = useSuspenseQuery(categoriesQO);
  return (
    <footer className="mt-16 border-t border-border bg-navy-dark text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-sm bg-primary-foreground text-navy-dark font-serif font-bold">N</div>
            <span className="font-serif text-xl font-bold">NewsHub</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-primary-foreground/70">
            Independent reporting on the stories shaping our world — filed daily by journalists you can trust.
          </p>
          <div className="mt-6">
            <NewsletterSignup dark />
          </div>
        </div>
        <div>
          <h4 className="font-serif text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">Sections</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {cats.data.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link to="/category/$slug" params={{ slug: c.slug }} className="text-primary-foreground/80 hover:text-primary-foreground">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-sm font-semibold uppercase tracking-wider text-primary-foreground/60">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
            <li>About</li><li>Ethics</li><li>Contact</li><li>Careers</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-6 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} NewsHub. All rights reserved.
      </div>
    </footer>
  );
}
