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

*Other Slide Alignments:*
- **Slide 9:** 6-Factor Tailor Match Score (Design fit, skill overlap, portfolio match, distance, rating, price fit).
- **Slide 10:** Structured Design Brief fields (Garment type, fabric, colorway, sleeve, neckline, measurements).
- **Slides 6 & 12:** Royalty Split Ratio (70% Tailor / 15% Designer / 15% Platform).
- **Slide 4:** "Structured attribute, not a chat message" framing for remix engine.

---

## 2. The Five Hackathon Pillars

1. **Feed · Follow · Save:** Curated feed of designer garments, follow capability, bookmarking with save counters.
2. **Remix + Customization:** Attribute toggles (neckline, sleeves, fabric, color, fit) writing structured design diffs.
3. **Simple 3D Avatar & Interactive Visualizer:** Real-time client-side before/after comparison visualizer with interactive slider and side-by-side mode.
4. **Tailor Matching + Quotes:** 6-factor explainable matching algorithm yielding transparent match percentages and auto-generated price/timeline quotes.
5. **Order Tracking:** Structured spec auto-fill → royalty split receipt → 5-stage status stepper with interactive tailor operator view.

---

## 3. Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide React icons.
- **Backend:** FastAPI (Python), SQLAlchemy, Pydantic v2.
- **Database:** SQLite / Supabase Postgres.
- **Deployment:** Vercel (Frontend) + Railway (Backend).

---

## 4. Data Model

```sql
posts (
  id text pk,
  designer_name text,
  designer_handle text,
  image_url text,
  title text,
  base_attributes json,   -- {neckline, sleeves, fabric, color, fit}
  price_reference int,
  created_at datetime
)

remixes (
  id text pk,
  post_id text fk -> posts,
  user_label text,
  attributes json,       -- modified attribute state
  remixed_image_url text,
  created_at datetime
)

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
)

orders (
  id text pk,
  remix_id text fk -> remixes,
  tailor_id text fk -> tailors,
  match_score float,
  measurements json,     -- {chest, length, shoulder, sleeve}
  status text,           -- 'placed' | 'accepted' | 'stitching' | 'ready' | 'delivered'
  created_at datetime
)
```

---

## 5. API Endpoints

```
GET  /posts                        → List all designer posts
GET  /posts/{id}                   → Single post detail
POST /remix                        → { post_id, attributes } → returns saved Remix
GET  /tailors/match                → { attributes, lat, lng } → top 3 matched tailors + 6-factor score + breakdown
POST /orders                       → { remix_id, tailor_id, measurements } → creates order
GET  /orders                       → List all orders
GET  /orders/{id}                  → Single order status
PATCH /orders/{id}/status          → Update order status (tailor view)
GET  /orders/{id}/receipt          → Returns 70/15/15 royalty breakdown
```

---

## 6. Tailor Match Algorithm (Slide 9's 6 Factors)

$$\text{Score} = 0.25 \times \text{SkillOverlap} + 0.20 \times \text{DistanceScore} + 0.20 \times \text{RatingScore} + 0.20 \times \text{PortfolioOverlap} + 0.15 \times \text{PriceFit}$$

Sub-score breakdowns are returned as normalized percentages and displayed as progress bars in `MatchBars.jsx`.

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

---

## 8. Demo Flow Script

1. **Discover (Feed):** Tap a garment post from top designers (e.g. *Royal Emerald Sherwani* by Anita Dongre).
2. **Remix (Studio):** Swap attributes (e.g. change neckline to Mandarin, color to Emerald, fabric to Chanderi Silk). Compare base vs. remix on the interactive visualizer.
3. **Match (Tailor Engine):** Click "MAKE THIS". See top matched tailors ranked by 6-factor score with breakdown bars.
4. **Order Brief & Receipt:** Submit body measurements, review 70/15/15 royalty split (₹1,050 Tailor / ₹225 Designer / ₹225 Platform).
5. **Track & Operate:** View real-time stepper. Toggle to Tailor mode to advance status live from *Placed* to *Delivered*.
