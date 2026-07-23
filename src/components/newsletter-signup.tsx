import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { cn } from "@/lib/utils";

export function NewsletterSignup({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await subscribeNewsletter({ data: { email } });
      toast.success("You're subscribed. Look for our morning brief.");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not subscribe");
    } finally { setLoading(false); }
  };

  return (
    <div className={cn(!compact && "space-y-3")}>
      {!compact && (
        <div>
          <h3 className={cn("font-serif text-lg font-bold", dark ? "text-primary-foreground" : "text-foreground")}>
            The Morning Brief
          </h3>
          <p className={cn("text-sm", dark ? "text-primary-foreground/70" : "text-muted-foreground")}>
            The stories that matter, in your inbox at 7am.
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={cn(dark && "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50")}
        />
        <Button type="submit" disabled={loading} variant={dark ? "secondary" : "default"}>
          {loading ? "..." : "Subscribe"}
        </Button>
      </form>
    </div>
  );
}
