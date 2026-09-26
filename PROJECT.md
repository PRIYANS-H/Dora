# DORI — Full Roadmap & Hackathon Build Plan

*"See it. Remix it. Wear it."*

---

## 1. Deck Alignment Map (Slide 15 Roadmap Table)

| Hackathon MVP (Shipped) | Phase 2 (0–12 months) | Phase 3 (12–36 months) |
|---|---|---|
| Feed · follow · save | AI recommendations | AR try-on |
| **Remix + customization** | Higher-fidelity 3D | Fabric marketplace |
| Simple 3D avatar & visualizer | Automated attribution | Global tailor network |
| Tailor matching + quotes | Digital measurements | Brand partnerships |
| Order tracking | | |
| **Designer Social Feed & Media** | | |

*Other Slide Alignments:*
- **Slide 9:** 6-Factor Tailor Match Score (Design fit, skill overlap, portfolio match, distance, rating, price fit).
- **Slide 10:** Structured Design Brief fields (Garment type, fabric, colorway, sleeve, neckline, measurements).
- **Slides 6 & 12:** Royalty Split Ratio (70% Tailor / 15% Designer / 15% Platform).
- **Slide 4:** "Structured attribute, not a chat message" framing for remix engine.

---

## 2. Core Pillars & Platform Features

1. **Designer Social Feed & Media Hub:** Multi-media upload (images/videos), Gemini-powered AI fashion caption generation, post authoring, paginated feed with aggregate engagement metrics, likes, comments, and shares.
2. **Feed · Follow · Save:** Curated feed of designer garments, follow capability, bookmarking with save counters.
3. **Remix + Customization:** Attribute toggles (neckline, sleeves, fabric, color, fit) writing structured design diffs.
4. **Simple 3D Avatar & Interactive Visualizer:** Real-time client-side before/after comparison visualizer with interactive slider and side-by-side mode.
5. **Tailor Matching + Quotes:** 6-factor explainable matching algorithm yielding transparent match percentages and auto-generated price/timeline quotes.
6. **Order Tracking:** Structured spec auto-fill → royalty split receipt → 5-stage status stepper with interactive tailor operator view.

---

## 3. Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide React icons.
- **Backend:** FastAPI (Python 3.10+), SQLAlchemy 2.0, Pydantic v2, Pillow.
- **Storage:** `BaseStorageProvider` abstraction with `LocalStorageProvider` for development; ready for S3 / Cloudinary / Supabase.
- **AI Services:** Google Gemini 1.5/2.0 Flash Vision multimodal model for captioning and styling diffs.
- **Database:** SQLite / Supabase Postgres.
- **Deployment:** Vercel (Frontend) + Railway (Backend).

---

## 4. Extended Data Model

```sql
posts (
  id text pk,
  designer_id text indexed,
  designer_name text,
  designer_handle text,
  designer_avatar text,
  title text,
  caption text,
  image_url text,
  base_attributes json,   -- {neckline, sleeves, fabric, color, fit}
  price_reference int,
  is_published boolean default true,
  created_at datetime indexed,
  updated_at datetime
);

post_media (
  id text pk,
  post_id text fk -> posts (cascade delete) indexed,
  media_type text,        -- 'image' | 'video'
  file_name text,
  file_path text,
  url text,
  mime_type text,
  file_size int,
  width int,
  height int,
  duration float,
  created_at datetime indexed
);

post_likes (
  id text pk,
  post_id text fk -> posts (cascade delete) indexed,
  user_id text indexed,
  created_at datetime,
  unique (post_id, user_id)
);

post_comments (
  id text pk,
  post_id text fk -> posts (cascade delete) indexed,
  user_id text indexed,
  user_name text,
  user_avatar text,
  content text,
  created_at datetime indexed,
  updated_at datetime
);

post_shares (
  id text pk,
  post_id text fk -> posts (cascade delete) indexed,
  user_id text indexed,
  created_at datetime
);

remixes (
  id text pk,
  post_id text fk -> posts,
  user_label text,
  attributes json,       -- modified attribute state
  remixed_image_url text,
  created_at datetime
);

tailors (
  id text pk,
  name text,
  photo_url text,
  skills json,           -- ['embroidery', 'zardozi', 'silk stitching', ...]
  lat float,
  lng float,
  rating float,
  reviews_count int,
  price_band text,       -- 'budget' | 'mid' | 'premium'
  portfolio_tags json
);

orders (
  id text pk,
  remix_id text fk -> remixes,
  tailor_id text fk -> tailors,
  match_score float,
  measurements json,     -- {chest, length, shoulder, sleeve}
  status text,           -- 'placed' | 'accepted' | 'stitching' | 'ready' | 'delivered'
  created_at datetime
);
```

---

## 5. API Endpoints

### Designer Social Feed & Media
```
POST   /media/upload                  → Upload image or video
POST   /posts/generate-caption        → Generate multimodal AI caption from media
POST   /posts                         → Create post with media & caption
GET    /posts                         → Paginated feed (?page=1&limit=20) or legacy list
GET    /posts/{id}                    → Single post detail with media & stats
PATCH  /posts/{id}                    → Edit post caption or visibility (Owner only)
DELETE /posts/{id}                    → Delete post and associated assets (Owner only)
GET    /designers/{designer_id}/posts → Get designer's portfolio feed
POST   /posts/{id}/like               → Like a post (idempotent)
DELETE /posts/{id}/like               → Unlike a post
POST   /posts/{id}/comments           → Add comment
GET    /posts/{id}/comments           → Get post comments
DELETE /comments/{id}                 → Delete own comment
POST   /posts/{id}/share              → Record share event
```

### Core DORI Creation Loop
```
GET    /health                        → System status
GET    /remixes                       → List all remixes
POST   /remix                         → { post_id, attributes } → returns saved Remix
GET    /tailors/match                 → { attributes, lat, lng } → top 3 matched tailors + 6-factor score
POST   /orders                        → { remix_id, tailor_id, measurements } → creates order
GET    /orders                        → List all orders
GET    /orders/{id}                   → Single order status
PATCH  /orders/{id}/status           → Update order status (tailor view)
GET    /orders/{id}/receipt           → Returns 70/15/15 royalty breakdown
```

---

## 6. Tailor Match Algorithm (Slide 9's 6 Factors)

$$\text{Score} = 0.25 \times \text{SkillOverlap} + 0.20 \times \text{DistanceScore} + 0.20 \times \text{RatingScore} + 0.20 \times \text{PortfolioOverlap} + 0.15 \times \text{PriceFit}$$

---

## 7. Phase 2 and Phase 3 Roadmap

### Phase 2 (0–12 Months)
- **AI Recommendations:** Learn user preferences from save/follow activity to personalize feed recommendations.
- **Higher-Fidelity 3D:** Upgrade avatar preview to physically-based garment rendering and cloth simulation.
- **Automated Attribution:** Tracing design lineage automatically and routing royalty payouts via smart ledger.
- **Digital Measurements:** Mobile camera-based 3D body measurement scanning.

### Phase 3 (12–36 Months)
- **AR Try-On:** Live WebXR / AR camera preview of remixed garments on the user's body.
- **Fabric Marketplace:** Direct raw material and fabric sourcing integration for tailors and designers.
- **Global Tailor Network:** Cross-border tailor matching, logistics, and quality assurance.
- **Brand Partnerships:** Co-branded capsule collections with established fashion houses.
