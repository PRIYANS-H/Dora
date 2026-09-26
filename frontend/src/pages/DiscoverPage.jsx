import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { supabase } from '../api/supabase';

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      let request = supabase.from('profiles').select('username,full_name,bio,avatar_url,is_professional').eq('is_professional', true).order('created_at', { ascending: false }).limit(24);
      if (query.trim()) request = request.ilike('username', `%${query.trim().toLowerCase()}%`);
      const { data } = await request;
      if (active) { setProfiles(data || []); setLoading(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  return <div className="discover-page"><div className="discover-intro"><div><span className="dori-kicker">The professional index</span><h2>Find the people behind the work.</h2><p>Search creators, tailors, and designers by their public username.</p></div><div className="discover-search"><Search className="w-4 h-4" /><input aria-label="Search professional usernames" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search @username" /></div></div>{loading ? <div className="empty-state">Loading professionals...</div> : profiles.length === 0 ? <div className="empty-state">No professional profiles found yet.</div> : <div className="professional-grid">{profiles.map((item) => <a href={`/profile/${item.username}`} className="professional-card" key={item.username}>{item.avatar_url ? <img src={item.avatar_url} alt={item.full_name} /> : <div className="professional-placeholder"><Sparkles /></div>}<div><span>@{item.username}</span><h3>{item.full_name}</h3><p>{item.bio || 'Fashion maker on DORI.'}</p></div><ArrowUpRight className="professional-arrow w-5 h-5" /></a>)}</div>}</div>;
}
