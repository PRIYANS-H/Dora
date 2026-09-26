# DORI Frontend — React + Vite

Frontend application for **DORI** (*"See it. Remix it. Wear it."*).

For full project documentation, architecture, API reference, and setup instructions, please see:
- [Main README](file:///e:/dora/README.md)
- [PROJECT Roadmap & Build Plan](file:///e:/dora/PROJECT.md)

## Development

```bash
npm install
npm run dev
```

Create `frontend/.env.local` with the Supabase project URL and publishable key before starting Vite:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

In Supabase, add `http://localhost:3000/app/` (and the deployed `/app/` URL) to the Auth URL Configuration allow list. The landing page opens the React app at `/app/`; users authenticate there and are then sent to the feed.

