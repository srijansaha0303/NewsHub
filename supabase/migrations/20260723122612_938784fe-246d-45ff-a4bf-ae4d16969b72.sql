
-- Roles enum + table + security-definer role check
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Articles
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_breaking boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  read_time_minutes int NOT NULL DEFAULT 5,
  views_count int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_category_idx ON public.articles(category_id);
CREATE INDEX articles_published_idx ON public.articles(status, published_at DESC);
GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles public read" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "Authors read own drafts" ON public.articles FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Admins read all" ON public.articles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage articles" ON public.articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_article_idx ON public.comments(article_id, created_at DESC);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments public read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users post comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins moderate comments" ON public.comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Bookmarks
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reading history
CREATE TABLE public.reading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reading_history_user_idx ON public.reading_history(user_id, read_at DESC);
GRANT SELECT, INSERT, DELETE ON public.reading_history TO authenticated;
GRANT ALL ON public.reading_history TO service_role;
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own history" ON public.reading_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Newsletter subscribers
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone subscribes" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Seed categories
INSERT INTO public.categories (slug, name, description, sort_order) VALUES
  ('politics','Politics','Policy, governance, elections',1),
  ('business','Business','Markets, economy, industry',2),
  ('technology','Technology','Tech, science of computing, startups',3),
  ('sports','Sports','Games, athletes, leagues',4),
  ('entertainment','Entertainment','Film, music, culture',5),
  ('health','Health','Medicine, wellness, public health',6),
  ('science','Science','Research and discovery',7),
  ('world','World','Global affairs and dispatches',8);

-- Seed articles (published, placeholder cover images via picsum.photos with fixed seeds)
INSERT INTO public.articles (slug, title, excerpt, content, cover_image_url, category_id, author_name, status, is_breaking, is_trending, read_time_minutes, views_count, tags, published_at)
SELECT * FROM (VALUES
  ('fragile-architecture-maritime-trade','The Fragile Architecture of Global Maritime Trade','As shipping bottlenecks intensify, a new network of secondary ports is emerging to redefine how goods move across the hemisphere.','The world''s shipping lanes are undergoing a quiet transformation.\n\nFrom the Strait of Malacca to the Panama Canal, capacity constraints and climate volatility have exposed how brittle the global trade network truly is. Investors are pouring capital into a new tier of regional ports designed to absorb the shock.\n\n"We''re watching a decade of consolidation unwind in real time," said one senior analyst at a Rotterdam-based logistics group.\n\nThe implications extend well beyond freight rates. Manufacturers are re-routing supply chains, insurers are recalibrating models, and governments are re-thinking sovereign resilience.','https://picsum.photos/seed/maritime/1600/900', (SELECT id FROM public.categories WHERE slug='world'), 'Helena Vance','published', true, true, 12, 4230, ARRAY['trade','shipping','economy'], now() - interval '2 hours'),
  ('sub-nanometer-race-intel','The Sub-Nanometer Race: Intel''s Bold Bet','Inside the multi-billion-dollar wager to leapfrog TSMC and reclaim the frontier of silicon manufacturing.','Intel''s Arizona fabs are humming again.\n\nThe company has committed to an aggressive roadmap that would push transistor pitch below the two-nanometer threshold before rivals in Taiwan and South Korea can respond.\n\nSuccess is far from guaranteed. Yield problems have plagued each new node, and geopolitical friction complicates the equipment supply chain.','https://picsum.photos/seed/intel/1600/900', (SELECT id FROM public.categories WHERE slug='technology'), 'Marcus Thorne','published', false, true, 9, 3100, ARRAY['semiconductors','intel','manufacturing'], now() - interval '4 hours'),
  ('legislative-gridlock-infrastructure','Legislative Gridlock Threatens Urban Infrastructure Funding','Cities warn of construction pauses as a critical federal appropriations bill stalls in committee.','Mayors across the country are sounding the alarm.\n\nWith federal appropriations frozen, hundreds of transit, water, and bridge projects face indefinite delays. Municipal bond markets have already begun to price in the uncertainty.','https://picsum.photos/seed/politics/1600/900', (SELECT id FROM public.categories WHERE slug='politics'), 'Julian Vane','published', false, true, 7, 2210, ARRAY['policy','infrastructure'], now() - interval '6 hours'),
  ('arctic-permafrost-2023','Arctic Permafrost Release Exceeds 2023 Projections','New satellite data suggests methane emissions from thawing tundra are outpacing consensus climate models.','A team of researchers has published startling findings.\n\nMeasurements from the Yamal Peninsula indicate that permafrost thaw is releasing far more methane than earlier atmospheric models predicted. The scientists caution against overreaction but urge policymakers to revisit assumptions.','https://picsum.photos/seed/arctic/1600/900', (SELECT id FROM public.categories WHERE slug='science'), 'Dr. Iris Kowalski','published', true, false, 8, 1890, ARRAY['climate','methane','arctic'], now() - interval '8 hours'),
  ('value-investing-tech-resurgence','Why ''Value Investing'' Is Seeing a Quiet Resurgence in Tech','Investors are pivoting from growth-at-all-costs to sustainable dividends and defensible margins.','A generation of fund managers cut their teeth on growth stocks.\n\nNow, with interest rates elevated and public markets skeptical of story-driven valuations, capital is flowing back into companies with real cash flow. Even in technology, once the province of unprofitable disruptors, dividend-paying incumbents are back in fashion.','https://picsum.photos/seed/markets/1600/900', (SELECT id FROM public.categories WHERE slug='business'), 'Marcus Thorne','published', false, false, 8, 1520, ARRAY['markets','investing'], now() - interval '10 hours'),
  ('brutalist-revival-digital','The Brutalist Revival in Digital Interface Design','A younger generation of designers is rejecting rounded corners and pastel gradients in favor of raw, uncompromising layouts.','Sharp corners are back.\n\nInside the studios of a handful of influential design shops, a new visual language is taking hold — one that prizes exposed grids, monospaced type, and unapologetic color. Critics call it brutalist; practitioners just call it honest.','https://picsum.photos/seed/design/1600/900', (SELECT id FROM public.categories WHERE slug='entertainment'), 'Nora Alighieri','published', false, true, 6, 980, ARRAY['design','culture'], now() - interval '12 hours'),
  ('biometric-data-peak-performance','How Biometric Data Is Altering the Peak of Human Performance','Elite athletes now train, sleep, and eat according to metrics that would have been unimaginable a decade ago.','Coaches used to guess.\n\nToday, wearable sensors deliver real-time telemetry on lactate, hydration, and neuromuscular fatigue. The result: incremental gains that compound into records once thought unbreakable.','https://picsum.photos/seed/sports/1600/900', (SELECT id FROM public.categories WHERE slug='sports'), 'Diego Prat','published', false, false, 7, 1340, ARRAY['sports','biometrics'], now() - interval '14 hours'),
  ('solid-state-battery-longevity','New Research Reveals Breakthrough in Solid-State Battery Longevity','A university lab has demonstrated 10,000 charge cycles without meaningful degradation.','The holy grail of energy storage may be a step closer.\n\nResearchers at a European university have published results showing that a new electrolyte formulation can dramatically extend battery lifespan without sacrificing energy density.','https://picsum.photos/seed/battery/1600/900', (SELECT id FROM public.categories WHERE slug='science'), 'Dr. Iris Kowalski','published', true, true, 6, 2670, ARRAY['batteries','energy'], now() - interval '16 hours'),
  ('central-banks-rate-pause','Global Markets Stabilize as Central Banks Signal Pause on Rate Hikes','Bond yields eased following coordinated statements from three major central banks.','A moment of calm.\n\nFor the first time in eighteen months, all three major central banks have signaled they may hold rates steady through the remainder of the year, giving markets room to breathe.','https://picsum.photos/seed/bonds/1600/900', (SELECT id FROM public.categories WHERE slug='business'), 'Marcus Thorne','published', false, false, 5, 3410, ARRAY['rates','markets'], now() - interval '18 hours'),
  ('vaccine-distribution-continent','Vaccine Distribution Reaches Remote Corners of the Continent','A coalition of NGOs and mobile clinics has delivered treatments to communities long beyond the reach of national health systems.','It took eight years.\n\nA quiet coalition of NGOs, telecoms, and drone operators has managed to deliver primary vaccines to more than fifty million people previously classified as unreachable.','https://picsum.photos/seed/health/1600/900', (SELECT id FROM public.categories WHERE slug='health'), 'Amina Osei','published', false, false, 9, 1120, ARRAY['health','vaccines'], now() - interval '20 hours'),
  ('quiet-return-of-the-independent-film','The Quiet Return of the Independent Film','Streaming fatigue is driving audiences back to smaller theaters and festival releases.','Something is shifting at the box office.\n\nAfter a decade in which franchise blockbusters dominated screens, a wave of low-budget independent films is drawing surprising crowds.','https://picsum.photos/seed/film/1600/900', (SELECT id FROM public.categories WHERE slug='entertainment'), 'Nora Alighieri','published', false, false, 6, 890, ARRAY['film','culture'], now() - interval '22 hours'),
  ('renewables-cross-fifty-percent','Renewables Cross Fifty Percent of European Generation','A milestone that few analysts predicted would arrive this decade.','For the first time in modern history, more than half of Europe''s electricity came from renewable sources over a full quarter.\n\nThe achievement is uneven — some countries dramatically outperform others — but the trend line is clear.','https://picsum.photos/seed/renewables/1600/900', (SELECT id FROM public.categories WHERE slug='world'), 'Julian Vane','published', false, true, 7, 2050, ARRAY['energy','climate','europe'], now() - interval '1 day'),
  ('ai-diagnosis-oncology','AI Auto-Diagnosis Shows Promise in Oncology Trials','Multi-center trials suggest algorithmic screening can match specialist accuracy on certain cancers.','A multi-year clinical trial has produced encouraging results.\n\nAn algorithmic screening tool matched — and in some cases exceeded — the diagnostic accuracy of experienced oncologists on early-stage detection.','https://picsum.photos/seed/ai-health/1600/900', (SELECT id FROM public.categories WHERE slug='health'), 'Amina Osei','published', false, false, 8, 1610, ARRAY['ai','oncology','health'], now() - interval '1 day 4 hours'),
  ('championship-final-overtime','Championship Final Decided in Double Overtime','A game destined for the record books ended on a play few will forget.','It was the sort of night that gets talked about for a generation.\n\nBoth teams traded leads through regulation and a full extra period before a single moment of brilliance settled the match.','https://picsum.photos/seed/finals/1600/900', (SELECT id FROM public.categories WHERE slug='sports'), 'Diego Prat','published', false, true, 5, 4820, ARRAY['sports','finals'], now() - interval '1 day 8 hours'),
  ('housing-supply-crisis','The Housing Supply Crisis Nobody Wants to Solve','A tangle of zoning laws, financing bottlenecks, and NIMBY politics has left a generation locked out.','The problem is not new.\n\nWhat is new is the recognition — across the political spectrum — that the current status quo cannot hold. What is missing is any coalition willing to actually change it.','https://picsum.photos/seed/housing/1600/900', (SELECT id FROM public.categories WHERE slug='politics'), 'Helena Vance','published', false, false, 10, 1740, ARRAY['housing','policy'], now() - interval '1 day 12 hours'),
  ('quantum-networking-milestone','Quantum Networking Reaches a Continental Milestone','Researchers successfully entangled photons across a distance previously thought impractical.','A quiet Wednesday afternoon marked a leap for quantum communication.\n\nEntangled photons were transmitted across more than a thousand kilometers of fiber, an achievement that brings quantum networking meaningfully closer to practical use.','https://picsum.photos/seed/quantum/1600/900', (SELECT id FROM public.categories WHERE slug='technology'), 'Marcus Thorne','published', false, false, 8, 1290, ARRAY['quantum','networking'], now() - interval '2 days')
) AS t;
