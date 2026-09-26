import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Search, Sparkles, UserRoundCheck } from 'lucide-react';
import { followProfile, getFollowState, fetchCatalog, unfollowProfile } from '../api/client';

export default function DiscoverPage({ viewerProfile }) {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [following, setFollowing] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedCatalog, setSelectedCatalog] = useState({ garments: [], fabrics: [] });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [tailorsRes, postsRes] = await Promise.all([
          fetch('/api/tailors'),
          fetch('/api/posts')
        ]);
        if (!tailorsRes.ok || !postsRes.ok) throw new Error('Fetch failed');
        
        let tailors = await tailorsRes.json();
        const allPosts = await postsRes.json();
        
        if (query.trim()) {
          const needle = query.trim().replace(/^@/, '').toLowerCase();
          tailors = tailors.filter((t) => t.name.toLowerCase().includes(needle) || (t.username || '').toLowerCase().includes(needle));
        }
        
        // Attach up to 3 posts to each tailor
        const profilesWithPosts = tailors.map(t => {
          const tailorPosts = allPosts.filter(p => p.tailor_id === t.id).slice(0, 3);
          return { ...t, posts: tailorPosts };
        });
        const followStates = await Promise.all(profilesWithPosts.map((item) => getFollowState(item.id).catch(() => ({ following: false }))));
        if (active) { setProfiles(profilesWithPosts); setFollowing(new Set(profilesWithPosts.filter((_, index) => followStates[index]?.following).map((item) => item.id))); setLoading(false); }
      } catch (e) {
        console.error(e);
        if (active) setLoading(false);
      }
    };
    
    const timer = window.setTimeout(load, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const toggleFollow = async (username) => {
    const wasFollowing = following.has(username);
    setFollowing((current) => { const next = new Set(current); wasFollowing ? next.delete(username) : next.add(username); return next; });
    try { wasFollowing ? await unfollowProfile(username) : await followProfile(username); }
    catch (error) { setFollowing((current) => { const next = new Set(current); wasFollowing ? next.add(username) : next.delete(username); return next; }); window.alert(error.message); }
  };

  useEffect(() => {
    if (!selectedProfile) return undefined;
    let active = true;
    setSelectedCatalog({ garments: [], fabrics: [] });
    fetchCatalog(selectedProfile.id).then((value) => { if (active) setSelectedCatalog(value); }).catch(() => { if (active) setSelectedCatalog({ garments: [], fabrics: [] }); });
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedProfile(null); };
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('profile-dashboard-open');
    return () => {
      active = false;
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('profile-dashboard-open');
    };
  }, [selectedProfile]);

  return (
    <div className="discover-page">
      <div className="discover-intro">
        <div>
          <span className="dori-kicker">The professional index</span>
          <h2>Find the people behind the work.</h2>
          <p>Meet the creators, tailors, and designers shaping DORI.</p>
        </div>
        <label className="discover-search">
          <Search className="w-4 h-4" />
          <input aria-label="Search professional usernames" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search @username" />
        </label>
      </div>
      {loading ? <div className="empty-state">Loading professionals...</div> : profiles.length === 0 ? <div className="empty-state">No professional profiles found yet.</div> : (
        <div className="professional-grid">
          {profiles.map((item) => {
            const isFollowing = following.has(item.id);
            return (
              <div
                className="profile-card-v2"
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${item.name}'s profile`}
                onClick={() => setSelectedProfile(item)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedProfile(item);
                  }
                }}
              >
                <img src={item.photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop'} alt={item.name} />
                <section>
                  <h2>{item.name}</h2>
                  <p>{item.reviews_count > 0 ? `⭐️ ${item.rating} (${item.reviews_count} reviews)` : 'New on DORI'}<br/>{(item.skills || []).join(', ')}</p>
                  <div>
                    <div className="tag" aria-label={`${item.reviews_count} reviews`}>
                      <UserRoundCheck className="w-4 h-4 inline" /> {item.reviews_count}
                    </div>
                    <button type="button" disabled={!item.profile_id} title={!item.profile_id ? 'This demo tailor has not connected a DORI account yet.' : undefined} className={isFollowing ? 'following' : ''} onClick={(event) => { event.stopPropagation(); toggleFollow(item.id); }}>
                      {!item.profile_id ? 'Unlinked' : isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                    <button type="button" className="profile-card-view" onClick={(event) => { event.stopPropagation(); setSelectedProfile(item); }}>View profile <ArrowUpRight className="w-4 h-4" /></button>
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      )}
      {selectedProfile && (
        <div className="profile-dashboard-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProfile(null); }}>
          <section className="profile-dashboard" role="dialog" aria-modal="true" aria-labelledby="profile-dashboard-title">
            <button type="button" className="profile-dashboard-close" onClick={() => setSelectedProfile(null)} aria-label="Close profile">×</button>
            <header className="profile-dashboard-header">
              <div className="profile-dashboard-avatar">{selectedProfile.photo_url ? <img src={selectedProfile.photo_url} alt="" /> : <UserRoundCheck />}</div>
              <div className="profile-dashboard-identity">
                <span className="dori-kicker">DORI tailor profile</span>
                <h2 id="profile-dashboard-title">Hello, {viewerProfile?.full_name || 'there'}</h2>
                <p className="profile-viewing-name">Viewing {selectedProfile.name}</p>
                <span className="profile-dashboard-handle">{selectedProfile.price_band || 'Professional tailor'}</span>
              </div>
              <div className="profile-dashboard-stat"><strong>{(selectedProfile.posts || []).length}</strong><span>Designs</span></div>
            </header>
            <div className="profile-dashboard-body">
              <section className="profile-about">
                <div><span className="dori-kicker">About this maker</span><p>{selectedProfile.bio || (selectedProfile.skills || []).join(' · ') || 'Independent fashion professional on DORI.'}</p>{selectedProfile.location && <span className="profile-maker-location">{selectedProfile.location}</span>}</div>
                <div className="profile-rating"><strong>{selectedProfile.reviews_count > 0 ? `★ ${selectedProfile.rating}` : 'New maker'}</strong><span>{selectedProfile.reviews_count || 0} reviews</span></div>
              </section>
              {viewerProfile?.id === selectedProfile.profile_id && <div className="profile-owner-actions"><a className="profile-upgrade" href="/app/settings">Edit profile <strong>Update your information <ArrowUpRight className="w-4 h-4" /></strong></a><a className="profile-upgrade" href="/app/shop">Shop inventory <strong>Manage garments and fabrics <ArrowUpRight className="w-4 h-4" /></strong></a><a className="profile-upgrade" href="/app/create">Add a design <strong>Publish to your portfolio <ArrowUpRight className="w-4 h-4" /></strong></a></div>}
              {viewerProfile && viewerProfile.id !== selectedProfile.profile_id && !viewerProfile.is_professional && <a className="profile-upgrade" href="/app/settings">Are you a tailor? <strong>Set up a professional account <ArrowUpRight className="w-4 h-4" /></strong></a>}
              <section className="profile-shop-section"><div className="profile-posts-heading"><div><span className="dori-kicker">The shop</span><h3>Available options</h3></div></div>{selectedCatalog.garments.length || selectedCatalog.fabrics.length ? <><div className="profile-shop-garments">{selectedCatalog.garments.map((item) => <article key={item.id}><strong>{item.name}</strong><span>{item.category.replaceAll('_', ' ')}</span>{item.description && <p>{item.description}</p>}</article>)}</div><div className="profile-shop-fabrics">{selectedCatalog.fabrics.map((fabric) => <article key={fabric.id}>{fabric.image_url && <img src={fabric.image_url} alt={`${fabric.name} sample`} />}<div><strong>{fabric.name}</strong><span>{[fabric.color, fabric.composition].filter(Boolean).join(' · ')}</span>{fabric.price_delta_minor > 0 && <small>+{fabric.currency} {(fabric.price_delta_minor / 100).toFixed(2)}</small>}</div></article>)}</div></> : <p className="order-hint">No shop options have been added yet.</p>}</section>
              <div className="profile-posts-heading"><div><span className="dori-kicker">The portfolio</span><h3>Dress designs</h3></div><span>{(selectedProfile.posts || []).length} designs</span></div>
              {(selectedProfile.posts || []).length === 0 ? <div className="profile-posts-empty"><Sparkles /><strong>No posts yet</strong><span>When this tailor shares dress designs, they’ll appear here.</span></div> : (
                <div className="profile-design-grid">
                  {selectedProfile.posts.map((post) => <button type="button" className="profile-design-card" key={post.id} onClick={() => { window.location.href = `/app/?post=${encodeURIComponent(post.id)}`; }} aria-label={`Open ${post.title} to like, comment, share, or remix`}><img src={post.image_url} alt={post.title} /><div className="profile-design-caption"><div><h4>{post.title}</h4><p>{post.caption || post.base_attributes?.description || 'A design from this tailor’s portfolio.'}</p><span>{post.currency || 'INR'} {(Number(post.starting_price_minor || ((post.price_reference || 0) * 100)) / 100).toLocaleString()}</span></div></div></button>)}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
