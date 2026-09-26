# DORI — See it. Remix it. Wear it.

> **DORI** connects social fashion discovery, garment design customization, and local tailor matchmaking into one seamless creation loop. Discover inspiration from designer garment posts, remix design attributes live on an interactive preview visualizer, get matched to top local tailors with explainable 6-factor scores and instant quotes, and track your custom garment through to final delivery.

---

## ⚡ What's Built (Hackathon MVP & Social Feed Platform)

The platform provides a complete end-to-end couture creation loop and designer social feed:

### 1. Designer Social Feed & Media Hub
- **Media Upload Engine** (`POST /media/upload`): Validated multi-media upload pipeline supporting JPG, PNG, WEBP images (with PIL dimension & integrity verification up to 15MB) and MP4, WEBM, MOV videos (up to 100MB) with collision-free naming and storage abstraction.
- **AI Fashion Caption Generator** (`POST /posts/generate-caption`): Gemini multimodal vision integration that analyzes uploaded design media to produce tone-aware fashion captions (`professional`, `creative`, `minimal`, `luxury`, `casual`, `streetwear`) without hallucinating unverified materials.
- **Designer Posts & Home Feed** (`POST /posts`, `GET /posts?page=1&limit=20`): Full post authoring with media attachments, optional AI captioning, paginated feed with eager-loaded engagement metrics (no N+1 queries), and sort modes (`newest`, `popular`).
- **Post Management** (`GET /posts/{id}`, `PATCH /posts/{id}`, `DELETE /posts/{id}`): Owner-authenticated editing of captions/visibility and cascading post deletion.
- **Designer Profile Feed** (`GET /designers/{designer_id}/posts`): Paginated post portfolio by specific designer.
- **Engagement System**:
  - **Likes** (`POST/DELETE /posts/{id}/like`): Idempotent user likes with unique constraints and live counts.
  - **Comments** (`POST/GET /posts/{id}/comments`, `DELETE /comments/{id}`): Validated non-empty comments with author metadata and deletion authorization.
  - **Shares** (`POST /posts/{id}/share`): Analytics-driven share tracking.

### 2. Core DORI Creation Loop
- **Feed · Follow · Save** (`GET /posts`, `FeedPage.jsx`): Discovery grid of designer garment posts, save counts, designer handles (`@elena_couture`, `@mira_heritage`), and bookmark toggling.
- **Remix + Customization** (`POST /remix`, `RemixPage.jsx`): Tactile attribute chip UI (neckline, sleeves, fabric, color, fit) persisting structured attribute diffs (*"structured attribute, not a chat message"*).
- **Simple 3D Avatar & Interactive Visualizer** (`BeforeAfter.jsx`): Real-time client-side garment comparison engine featuring an interactive split slider and side-by-side mode without image-generation server latency.
- **Tailor Matching + Quotes** (`GET/POST /tailors/match`, `MatchPage.jsx`, `MatchBars.jsx`): 6-factor weighted scoring algorithm evaluating Skill Overlap, Location Distance, Customer Rating, Portfolio Match, and Price Fit with visual breakdown bars and transparent quotes.
- **Order Tracking & Operator Hub** (`POST /orders`, `GET /orders/{id}/receipt`, `PATCH /orders/{id}/status`, `BriefPage.jsx`, `ReceiptPage.jsx`, `TrackerPage.jsx`, `TailorPage.jsx`): Auto-filled structured design brief with custom body measurements, 70/15/15 financial royalty split (Tailor / Designer / Platform), live 5-stage status stepper (Placed → Accepted → Stitching → Ready → Delivered), and a dual-mode Tailor Operator Hub.

---

## 🚫 What's Explicitly Not Built Yet (Phase 2 & Phase 3 Roadmap)

The scope below represents future roadmap phases from Slide 15 of the pitch deck:

| Hackathon MVP (Shipped Now) | Phase 2 (0–12 Months) | Phase 3 (12–36 Months) |
|---|---|---|
| Feed · follow · save | AI recommendations (collaborative filtering over saves/follows) | AR try-on (WebXR & mobile camera overlay) |
| Designer media uploads & AI captions | Higher-fidelity 3D (PBR materials & garment draping physics) | Fabric & raw material marketplace |
| Social engagement (likes, comments, shares) | Automated attribution (blockchain / smart ledger royalty tracking) | Global tailor network & cross-border logistics |
| Remix + customization (tactile chips) | Digital measurements (3D mobile body scan capture) | Brand partnerships & co-branded capsule lines |
| Interactive preview visualizer | | |
| Tailor matching (6-factor score) + quotes | | |
| Order tracker & Tailor Operator Hub | | |

---

## 🏗️ Architecture

```
                                  +---------------------------------------+
                                  |   Frontend (React 19 + Vite + Tailwind)│
                                  |   Hosted on Vercel                      │
                                  +-------------------+-------------------+
                                                      |
                                                      | REST API Calls
                                                      v
+-----------------------------------+     +---------------------------------------+
|  Database (SQLite / Postgres)     |<----+   Backend API (FastAPI + Python 3.10+) |
|  - posts        - post_media      |     |   Hosted on Railway                       |
|  - post_likes   - post_comments   |     +-------------------+-------------------+
|  - post_shares  - tailors/orders  |                         |
+-----------------------------------+                         v
                                          +---------------------------------------+
                                          |   Storage & AI Services               |
                                          |   - LocalStorageProvider (or S3)      |
                                          |   - Gemini 1.5/2.0 Vision Multimodal  |
                                          +---------------------------------------+
```

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons (Vercel-ready).
- **Backend:** FastAPI, Python 3.10+, SQLAlchemy, Pydantic v2, Uvicorn (Railway-ready).
- **Database:** SQLite / Supabase Postgres (`backend/dora.db`) pre-seeded with 10 posts and 6 tailor profiles.
- **Storage Abstraction:** `BaseStorageProvider` with pluggable `LocalStorageProvider` (and future S3/Cloudinary/Supabase adapters).
- **Visualizer Approach:** Client-side attribute diff engine with interactive comparison slider.

---

## 🛠️ Setup & Running Locally

### Prerequisites
- **Node.js**: v18+
- **Python**: v3.10+

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run database seed script (creates & seeds dora.db)
python app/seed.py

# Run all test suites (21 unit & integration tests)
python -m pytest tests/ -v

# Start FastAPI server
python -m uvicorn app.main:app --reload --port 8008
```
Backend runs at `http://localhost:8008`. Interactive Swagger API Documentation is live at `http://localhost:8008/docs`.

### 2. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend runs at `http://localhost:5173` (or `http://localhost:3000`).

---

## 🔑 Environment Variables

Create `.env` in `backend/`:

```env
# Database
DATABASE_URL=sqlite:///./dora.db
PORT=8008
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:3001

# Gemini AI (for AI caption generation and image synthesis)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional Storage Providers
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/media/upload` | Upload image or video (multipart/form-data) |
| `POST` | `/posts/generate-caption` | Generate multimodal AI fashion caption |
| `POST` | `/posts` | Create new designer post with media & caption |
| `GET` | `/posts?page=1&limit=20` | Get paginated home feed with engagement metrics |
| `GET` | `/posts/{id}` | Get single post details and attached media |
| `PATCH`| `/posts/{id}` | Update post caption or visibility (Owner only) |
| `DELETE`| `/posts/{id}` | Delete post and cascade media/comments (Owner only) |
| `GET` | `/designers/{designer_id}/posts` | Get designer's portfolio feed |
| `POST` | `/posts/{id}/like` | Like a post (idempotent) |
| `DELETE`| `/posts/{id}/like` | Unlike a post |
| `POST` | `/posts/{id}/comments` | Add a comment to a post |
| `GET` | `/posts/{id}/comments` | Get all comments for a post |
| `DELETE`| `/comments/{id}` | Delete own comment |
| `POST` | `/posts/{id}/share` | Record a share event |
| `POST` | `/remix` | Generate or retrieve remixed garment spec |
| `POST` | `/tailors/match` | 6-factor explainable tailor matching algorithm |
| `POST` | `/orders` | Place customized order with measurements |
| `GET` | `/orders/{id}/receipt` | 70/15/15 transparent royalty receipt |
