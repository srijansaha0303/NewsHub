
# NewsHub — MVP Build Plan

Modular-broadsheet design (Navy Trust palette, Libre Baskerville + IBM Plex Sans, bento grid), backed by Lovable Cloud. Ships public reading experience end-to-end plus core signed-in and admin features. Deferrable polish (full analytics dashboard, notification preferences, admin comment moderation UI) noted at the end.

## Design tokens

Ported verbatim from the chosen prototype into `src/styles.css`:
- `--color-navy-dark: #0f1b3d`, `--color-navy-muted: #1e3a5f`, `--color-navy-accent: #3b6fa0`, `--color-navy-wash: #e8edf3`
- `--color-breaking: #c2410c` (accent — reserved for live/breaking signals)
- Fonts: Libre Baskerville (serif headlines) + IBM Plex Sans (body), loaded via `<link>` in `__root.tsx` head
- Light + dark mode (dark inverts to navy-dark bg / zinc-50 text; theme toggle persists in localStorage, read in `useEffect` to avoid hydration mismatch)

## Backend (Lovable Cloud)

Enable Cloud, then one migration creates:

- `profiles` — `id uuid PK -> auth.users`, `display_name`, `avatar_url`, `bio`. Auto-created via signup trigger.
- `app_role` enum + `user_roles` table + `has_role(uuid, app_role)` security-definer function (per user-roles security guidance — no role column on profiles).
- `categories` — `id`, `slug unique`, `name`, `description`. Seed 8: Politics, Business, Technology, Sports, Entertainment, Health, Science, World.
- `articles` — `id`, `slug unique`, `title`, `excerpt`, `content` (markdown/text), `cover_image_url`, `category_id`, `author_id -> profiles`, `status` ('draft'|'published'), `is_breaking bool`, `is_trending bool`, `read_time_minutes int`, `views_count int`, `published_at`, `created_at`, `updated_at`, `tags text[]`.
- `comments` — `id`, `article_id`, `user_id`, `body`, `created_at`.
- `bookmarks` — `id`, `user_id`, `article_id`, `created_at`, unique(user_id, article_id).
- `reading_history` — `id`, `user_id`, `article_id`, `read_at`.
- `newsletter_subscribers` — `id`, `email unique`, `created_at`.

RLS + grants for every public-schema table:
- `articles`: anon SELECT where `status='published'`; authors can CRUD own drafts; admins full CRUD via `has_role(auth.uid(),'admin')`.
- `categories`: anon SELECT; admin write.
- `comments`: anon SELECT; authenticated INSERT (own user_id); user UPDATE/DELETE own; admin DELETE any.
- `bookmarks` / `reading_history`: user-owned; user CRUD own only.
- `profiles`: anon SELECT (public authors); user UPDATE own.
- `user_roles`: authenticated SELECT own; admin ALL.
- `newsletter_subscribers`: anon INSERT only.

Seed ~15 placeholder articles across categories (one migration, in same file as schema) using picsum/unsplash-style placeholder URLs so home + category pages render immediately.

## Data layer

Server functions (`src/lib/*.functions.ts`):
- Public reads via server publishable client: `listPublishedArticles({category?, sort?, page?, search?})`, `getArticleBySlug`, `listCategories`, `listTrending`, `listPopular`, `listBreaking`, `listRelated(articleId)`, `subscribeNewsletter(email)` (zod-validated).
- Authenticated (`requireSupabaseAuth`): `toggleBookmark`, `listMyBookmarks`, `logReadingHistory`, `listMyHistory`, `updateProfile`, `postComment`, `deleteMyComment`.
- Admin (checks `has_role` via `context.supabase`, then dynamic-imports `supabaseAdmin`): `adminUpsertArticle`, `adminDeleteArticle`, `adminUpsertCategory`, `adminDeleteComment`, `adminListUsers`.

All list queries wired through TanStack Query with `ensureQueryData` in loaders + `useSuspenseQuery` in components. `defaultPreloadStaleTime: 0` already set.

## Routes (file-based, TanStack Router)

Public (top-level, SSR on):
- `/` — home: sticky nav, breaking ticker (marquee), category chip row, hero + trending sidebar + bento tiles (Latest, Popular, per-category previews), newsletter block, footer. Composition matches selected prototype exactly.
- `/category/$slug` — category page: filtered grid, search box, sort (newest/most-viewed), pagination (12/page).
- `/article/$slug` — article: large cover, title, byline + date + read time, tags, share buttons (Twitter/LinkedIn/copy-link), markdown content, related articles, comments section (list + inline auth-gated form). Route `head()` derives OG image/title/description from loader data.
- `/search` — query param `?q=&category=&author=`, filtered results.
- `/auth` — sign in / sign up / forgot password (tabbed), email+password, Google OAuth via Lovable broker.
- `/reset-password` — public route, handles `type=recovery`, calls `updateUser({ password })`.

Authenticated (`src/routes/_authenticated/`, integration-managed layout):
- `/_authenticated/dashboard` — tabs: Saved (bookmarks), History, Profile settings.

Admin (`_authenticated/_admin` layout with `has_role('admin')` gate + redirect to `/unauthorized`):
- `/_authenticated/_admin/admin` — landing with counts (articles/users/comments).
- `/_authenticated/_admin/admin/articles` — list + create/edit/delete (form with title/slug/category/cover/content/tags/status/breaking/trending).
- `/_authenticated/_admin/admin/categories` — CRUD.
- `/_authenticated/_admin/admin/users` — list + role assignment.

Each shareable route defines its own `head()` (unique title, description, og:title, og:description); article/category pages add og:image from loader data. Root doesn't set og:image.

## Components

Reusable (`src/components/`):
- `SiteHeader` (sticky nav, mobile hamburger sheet, search input, theme toggle, session-aware auth affordance).
- `BreakingTicker` (marquee driven by breaking articles).
- `CategoryChips` (horizontal scroll, active state from route).
- `ArticleCard` (variants: hero, trending, wash-tile, standard, list-row) — matches prototype tiles.
- `ArticleGrid`, `Pagination`, `SortSelect`, `SearchInput`.
- `NewsletterBlock`, `SiteFooter`.
- `BookmarkButton` (auth-gated, optimistic toggle).
- `ShareButtons`, `CommentList`, `CommentForm`, `RelatedArticles`, `ArticleSkeleton`, `CardSkeleton`.
- shadcn: button, input, textarea, select, tabs, sheet (mobile nav), dialog, dropdown-menu, sonner Toaster (root).

## Auth + session

- `supabase.auth.onAuthStateChange` wired once in `__root.tsx` per integration guidance (filter to SIGNED_IN/OUT/USER_UPDATED, invalidate router/queries).
- Sign-out hygiene per guidance: cancelQueries → clear → signOut → navigate replace to `/auth`.
- Google via `lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin })`, then `supabase--configure_social_auth`.
- All forms use zod validation + sonner toasts.

## Cross-cutting

- Lazy-loaded images (`loading="lazy"` + `decoding="async"`).
- Loading skeletons everywhere via Suspense fallbacks.
- Accessibility: semantic headings, aria labels on icon buttons, focus rings via `--color-ring`, keyboard-navigable menus.
- Responsive: bento collapses to single column mobile; hamburger sheet for nav; horizontal scroll for chip row.
- Sonner toasts for all mutations.

## Deferred (post-MVP)

- Admin analytics charts (basic counts only in MVP).
- Notification preferences (schema slot reserved on profiles; UI later).
- Admin comment moderation table (comments editable/deletable by users; admin DELETE policy exists, but no dedicated UI in MVP).

## Build order

1. Enable Cloud → migration (schema + seeds + RLS + grants + role scaffolding).
2. Tokens in `styles.css`, fonts in `__root.tsx`, sonner Toaster.
3. Public server fns + shared components (Header, Ticker, ArticleCard, Footer).
4. Home + category + article + search routes with head() metadata.
5. Auth pages + reset-password + auth state wiring.
6. `_authenticated` dashboard (bookmarks/history/profile) + BookmarkButton + comments.
7. Admin gate + articles/categories/users CRUD.
8. Verify build, then Playwright smoke: home renders, article page loads, sign up → bookmark → dashboard shows it.

## Admin bootstrap

After first signup, promote yourself with SQL: `INSERT INTO user_roles(user_id, role) VALUES ('<your-uid>', 'admin');` — I'll surface the exact command after the migration runs.
