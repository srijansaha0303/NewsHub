import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPublicSupabase } from "./supabase-public";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(320) }).parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicSupabase();
    const { error } = await sb.from("newsletter_subscribers").insert({ email: data.email });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });
