# DORI — See it. Remix it. Wear it.

> **DORI** connects social fashion discovery, garment design customization, and local tailor matchmaking into one seamless creation loop. Discover inspiration from designer garment posts, remix design attributes live on an interactive preview visualizer, get matched to top local tailors with explainable 6-factor scores and instant quotes, and track your custom garment through to final delivery.

---

## ⚡ What's Built (Hackathon MVP)

The 5 core hackathon-MVP pillars from the pitch deck roadmap are fully implemented in this repository:

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
| Remix + customization (tactile chips) | Higher-fidelity 3D (PBR materials & garment draping physics) | Fabric & raw material marketplace |
| Interactive preview visualizer | Automated attribution (blockchain / smart ledger royalty tracking) | Global tailor network & cross-border logistics |
| Tailor matching (6-factor score) + quotes | Digital measurements (3D mobile body scan capture) | Brand partnerships & co-branded capsule lines |
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
|  - posts   - remixes             |     |   Hosted on Railway                       |
|  - tailors - orders               |     +---------------------------------------+
+-----------------------------------+
```

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons (Vercel-ready).
- **Backend:** FastAPI, Python 3.10+, SQLAlchemy, Pydantic v2, Uvicorn (Railway-ready).
- **Database:** SQLite / Supabase Postgres (`backend/dora.db`) pre-seeded with 10 posts and 6 tailor profiles.
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

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend runs at `http://localhost:8000`. API Documentation is live at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend runs at `http://localhost:5173`.

---

## 🔑 Environment Variables

Create `.env` files in your backend and frontend directories as needed:

```env
# Backend (.env)
DATABASE_URL=sqlite:///./dora.db
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🎬 Demo Flow

1. **Feed (`FeedPage.jsx`)**: Browse designer posts, follow handles (`@elena_couture`), and click **"Remix Design"**.
2. **Remix Studio (`RemixPage.jsx`)**: Toggle attributes (Neckline, Sleeves, Fabric, Color, Fit). Slide the **Interactive Split** handle to compare base vs. remix. Click **"MAKE THIS"**.
3. **Tailor Match (`MatchPage.jsx`)**: Review tailors ranked by 6-factor score with percentage breakdown bars (Skill, Distance, Rating, Portfolio, Price) and custom quote.
4. **Order Brief (`BriefPage.jsx`)**: Auto-fill structured brief, input body measurements (chest, length, shoulder, sleeve), and place order.
5. **Confirmation (`ReceiptPage.jsx`)**: Inspect transparent royalty breakdown (70% Tailor / 15% Designer / 15% Platform).
6. **Order Tracker (`TrackerPage.jsx` & `TailorPage.jsx`)**: Monitor status stepper. Switch to **Tailor Mode** in the header to advance order stages live.
