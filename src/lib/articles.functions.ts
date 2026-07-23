import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPublicSupabase } from "./supabase-public";

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  read_time_minutes: number;
  views_count: number;
  is_breaking: boolean;
  is_trending: boolean;
  published_at: string | null;
  tags: string[];
  category: { slug: string; name: string } | null;
};

export type ArticleDetail = ArticleCard & { content: string };

const ARTICLE_SELECT = "id, slug, title, excerpt, cover_image_url, author_name, read_time_minutes, views_count, is_breaking, is_trending, published_at, tags, category:categories(slug, name)";

const ARTICLE_DETAIL_SELECT = ARTICLE_SELECT + ", content";

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getPublicSupabase();
  const { data, error } = await sb.from("categories").select("id, slug, name, description, sort_order").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

const listInput = z.object({
  categorySlug: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "popular"]).optional().default("newest"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(48).optional().default(12),
  breakingOnly: z.boolean().optional(),
  trendingOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(48).optional(),
});

export const listArticles = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicSupabase();
    let q = sb
      .from("articles")
      .select(ARTICLE_SELECT, { count: "exact" })
      .eq("status", "published");
    if (data.categorySlug) {
      const { data: cat } = await sb.from("categories").select("id").eq("slug", data.categorySlug).maybeSingle();
      if (!cat) return { rows: [] as ArticleCard[], total: 0 };
      q = q.eq("category_id", cat.id);
    }
    if (data.breakingOnly) q = q.eq("is_breaking", true);
    if (data.trendingOnly) q = q.eq("is_trending", true);
    if (data.search) {
      const term = data.search.replace(/[%_]/g, "");
      q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,author_name.ilike.%${term}%`);
    }
    if (data.sort === "popular") q = q.order("views_count", { ascending: false });
    else q = q.order("published_at", { ascending: false, nullsFirst: false });

    const limit = data.limit ?? data.pageSize;
    const from = data.limit ? 0 : (data.page - 1) * data.pageSize;
    const to = from + limit - 1;
    q = q.range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as unknown as ArticleCard[], total: count ?? 0 };
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicSupabase();
    const { data: row, error } = await sb
      .from("articles")
      .select(ARTICLE_DETAIL_SELECT)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const typed = row as unknown as ArticleDetail;
    // fire-and-forget view increment
    sb.from("articles").update({ views_count: typed.views_count + 1 }).eq("id", typed.id).then(() => undefined);
    return typed;
  });

export const listRelated = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ articleId: z.string().uuid(), categoryId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicSupabase();
    let q = sb.from("articles").select(ARTICLE_SELECT).eq("status", "published").neq("id", data.articleId).limit(3);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ArticleCard[];
  });

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ articleId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = getPublicSupabase();
    const { data: raw, error } = await sb
      .from("comments").select("id, body, created_at, user_id").eq("article_id", data.articleId).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((raw ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await sb.from("profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    return (raw ?? []).map((r) => ({
      id: r.id, body: r.body, created_at: r.created_at, user_id: r.user_id,
      display_name: map.get(r.user_id)?.display_name ?? "Reader",
      avatar_url: map.get(r.user_id)?.avatar_url ?? null,
    }));
  });
