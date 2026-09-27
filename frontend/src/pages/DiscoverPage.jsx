import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Link2, MapPin, Search, Sparkles, Star, Store } from 'lucide-react';
import { followProfile, getFollowState, fetchCatalog, fetchProfile, unfollowProfile, fetchTailors, fetchPosts } from '../api/client';
import Avatar from '../components/Avatar';
import CapsuleTabs from '../components/CapsuleTabs';
import FollowButton from '../components/FollowButton';
import Modal from '../components/Modal';
import PostDetail from '../components/PostDetail';
import StatRow from '../components/StatRow';
import { DoriWordmark } from '../components/DoriLogo';
import { toast } from '../utils/toast';
import { postPrice } from '../utils/time';

function DiscoverSkeleton() {
  return (
    <div className="maker-grid">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="maker-card glass is-skeleton" key={index}>
          <div className="maker-cover dori-skeleton" />
          <div className="maker-body"><span className="dori-skeleton" /><i className="dori-skeleton" /><i className="dori-skeleton" /></div>
        </div>
      ))}
    </div>
  );
}

function Mosaic({ posts, className = '' }) {
  const images = posts.filter((post) => post.image_url).slice(0, 3);
  if (!images.length) return <div className={`maker-mosaic is-empty ${className}`}><DoriWordmark /></div>;
  return <div className={`maker-mosaic n-${images.length} ${className}`}>{images.map((post) => <img key={post.id} src={post.image_url} alt="" loading="lazy" />)}</div>;
}

function Rating({ maker }) {
  if (!(maker.reviews_count > 0)) return <span className="maker-rating is-new"><Sparkles /> New on DORI</span>;
  return <span className="maker-rating"><Star fill="currentColor" /> {Number(maker.rating).toFixed(1)} <em>· {maker.reviews_count} reviews</em></span>;
}

function MakerCard({ maker, index, following, busy, isSelf, onFollow, onOpen }) {
  const skills = maker.skills || [];
  return (
    <article className="maker-card glass rise" style={{ '--i': Math.min(index, 10) }}>
      <button type="button" className="maker-cover" onClick={onOpen} aria-label={`Open ${maker.name}'s profile`}>
        <Mosaic posts={maker.posts || []} />
      </button>
      <div className="maker-body">
        <button type="button" className="maker-avatar" onClick={onOpen} tabIndex={-1} aria-hidden="true"><Avatar src={maker.photo_url} name={maker.name} size={68} /></button>
        <div className="maker-id">
          <h3>{maker.name}</h3>
          <span>{maker.username ? `@${maker.username}` : maker.price_band ? `${maker.price_band} atelier` : 'Independent maker'}{maker.location ? ` · ${maker.location}` : ''}</span>
        </div>
        <Rating maker={maker} />
        <div className="maker-skills">
          {skills.slice(0, 3).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
          {skills.length > 3 && <span className="chip">+{skills.length - 3}</span>}
        </div>
        <div className="maker-actions">
          <FollowButton following={following} busy={busy} linked={Boolean(maker.profile_id)} isSelf={isSelf} onToggle={onFollow} block />
          <button type="button" className="btn btn-sm btn-ghost" onClick={onOpen}>View <ArrowUpRight /></button>
        </div>
      </div>
    </article>
  );
}

function MakerModal({ maker, viewerProfile, following, busy, onFollow, onClose, onOpenPost, onNavigate }) {
  const [details, setDetails] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const followingRef = useRef(following);
  followingRef.current = following;
  const [tab, setTab] = useState('portfolio');
  const isSelf = viewerProfile?.id && viewerProfile.id === maker.profile_id;
  const posts = maker.posts || [];

  useEffect(() => {
    let active = true;
    fetchProfile(maker.username || maker.id)
      .then((value) => { if (active) { setDetails(value); setBaseline(followingRef.current); } })
      .catch(() => { if (active) { setDetails({}); setBaseline(followingRef.current); } });
    fetchCatalog(maker.id).then((value) => { if (active) setCatalog(value); }).catch(() => { if (active) setCatalog({ garments: [], fabrics: [] }); });
    return () => { active = false; };
  }, [maker.id, maker.username]);

  // Adjust the fetched count by any follow/unfollow made since it was loaded.
  const followers = details ? Math.max(0, (details.followers_count || 0) + (following === baseline ? 0 : following ? 1 : -1)) : 0;
  const shopCount = (catalog?.garments?.length || 0) + (catalog?.fabrics?.length || 0);

  const shareProfile = async () => {
    const handle = maker.username || details?.username;
    const url = handle ? `${window.location.origin}/app/profile/${handle}` : window.location.href;
    try { await navigator.clipboard.writeText(url); toast('Profile link copied'); } catch { toast('Couldn’t copy the link', 'bad'); }
  };

  return (
    <Modal onClose={onClose} size="xl" labelledBy="maker-modal-title" className="maker-modal">
      <div className="maker-modal-grid">
        <aside className="maker-modal-id">
          <Mosaic posts={posts} className="maker-modal-backdrop" />
          <div className="maker-modal-id-inner">
            <Avatar src={maker.photo_url} name={maker.name} size={112} />
            <span className="kicker live">{maker.profile_id ? 'Professional on DORI' : 'Demo atelier'}</span>
            <h2 id="maker-modal-title" className="display title-md">{maker.name}</h2>
            <span className="maker-modal-handle">
              {maker.username ? `@${maker.username}` : maker.price_band ? `${maker.price_band} atelier` : 'Independent maker'}
              {maker.location && <><MapPin /> {maker.location}</>}
            </span>
            {(details?.bio || maker.bio) && <p className="maker-modal-bio">{details?.bio || maker.bio}</p>}
            <StatRow
              className="maker-stats"
              stats={[
                { label: 'Designs', value: posts.length },
                { label: 'Followers', value: followers, loading: !details },
                { label: 'Following', value: details?.following_count || 0, loading: !details },
              ]}
            />
            <Rating maker={maker} />
            <div className="maker-modal-actions">
              <FollowButton following={following} busy={busy} linked={Boolean(maker.profile_id)} isSelf={isSelf} onToggle={onFollow} size="md" block />
              <button type="button" className="btn btn-icon btn-ghost" onClick={shareProfile} aria-label="Copy profile link"><Link2 /></button>
            </div>
            {isSelf && (
              <div className="maker-owner-links">
                <button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate('settings')}>Edit profile</button>
                <button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate('shop')}>Manage shop</button>
                <button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate('create')}>New post</button>
              </div>
            )}
            {!isSelf && viewerProfile && !viewerProfile.is_professional && (
              <button type="button" className="maker-upgrade" onClick={() => onNavigate('settings')}>Are you a tailor? <strong>Go professional <ArrowUpRight /></strong></button>
            )}
          </div>
        </aside>

        <section className="maker-modal-main">
          <CapsuleTabs
            size="sm"
            value={tab}
            onChange={setTab}
            ariaLabel="Profile sections"
            options={[
              { id: 'portfolio', label: `Portfolio · ${posts.length}` },
              { id: 'shop', label: `Shop · ${catalog ? shopCount : '…'}`, icon: <Store /> },
            ]}
          />
          <div className="maker-modal-scroll">
            {tab === 'portfolio' && (posts.length === 0 ? (
              <div className="empty"><Avatar size={52} /><strong>No designs yet</strong><p>When {maker.name.split(' ')[0]} shares designs, they’ll appear here.</p></div>
            ) : (
              <div className="maker-portfolio">
                {posts.map((post, index) => (
                  <button type="button" key={post.id} className="maker-portfolio-item rise" style={{ '--i': index }} onClick={() => onOpenPost(post)}>
                    <img src={post.image_url} alt="" loading="lazy" />
                    <span><strong>{post.title}</strong><em>From {postPrice(post)}</em></span>
                  </button>
                ))}
              </div>
            ))}
            {tab === 'shop' && (!catalog ? <div className="empty"><p>Loading the shop…</p></div> : shopCount === 0 ? (
              <div className="empty"><Avatar size={52} /><strong>No shop options yet</strong><p>This maker hasn’t listed garments or fabrics.</p></div>
            ) : (
              <div className="maker-shop">
                {catalog.garments.length > 0 && <h4>Garments</h4>}
                <div className="maker-shop-grid">
                  {catalog.garments.map((item) => (
                    <article key={item.id} className="maker-shop-item">
                      {item.image_url ? <img src={item.image_url} alt="" /> : <span className="maker-shop-ph"><DoriWordmark /></span>}
                      <div><strong>{item.name}</strong><span>{String(item.category || '').replaceAll('_', ' ')}</span>{item.description && <p>{item.description}</p>}</div>
                    </article>
                  ))}
                </div>
                {catalog.fabrics.length > 0 && <h4>Fabrics</h4>}
                <div className="maker-shop-grid">
                  {catalog.fabrics.map((fabric) => (
                    <article key={fabric.id} className="maker-shop-item">
                      {fabric.image_url ? <img src={fabric.image_url} alt="" /> : <span className="maker-shop-ph"><DoriWordmark /></span>}
                      <div><strong>{fabric.name}</strong><span>{[fabric.color, fabric.composition].filter(Boolean).join(' · ')}</span>{fabric.price_delta_minor > 0 && <em>+{fabric.currency} {(fabric.price_delta_minor / 100).toFixed(0)}</em>}</div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function DiscoverPage({ viewerProfile, onSelectPost, onNavigate }) {
  const [query, setQuery] = useState('');
  const [makers, setMakers] = useState([]);
  const [following, setFollowing] = useState(() => new Set());
  const [followBusy, setFollowBusy] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [openPost, setOpenPost] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTailors(), fetchPosts()])
      .then(async ([tailors, posts]) => {
        const withPosts = tailors.map((tailor) => ({ ...tailor, posts: posts.filter((post) => post.tailor_id === tailor.id) }));
        if (!active) return;
        setMakers(withPosts);
        setLoading(false);
        const states = await Promise.all(withPosts.map((item) => (item.profile_id ? getFollowState(item.id).catch(() => ({ following: false })) : { following: false })));
        if (active) setFollowing(new Set(withPosts.filter((_, index) => states[index]?.following).map((item) => item.id)));
      })
      .catch((error) => { console.error(error); if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().replace(/^@/, '').toLowerCase();
    if (!needle) return makers;
    return makers.filter((maker) => [maker.name, maker.username, maker.location, ...(maker.skills || [])].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [makers, query]);

  const toggleFollow = async (maker) => {
    const id = maker.id;
    const wasFollowing = following.has(id);
    const flip = (on) => setFollowing((current) => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });
    flip(!wasFollowing);
    setFollowBusy((current) => new Set(current).add(id));
    try {
      if (wasFollowing) await unfollowProfile(id); else await followProfile(id);
      toast(wasFollowing ? `Unfollowed ${maker.name}` : `Following ${maker.name}`);
    } catch (error) {
      flip(wasFollowing);
      toast(error.message || 'Couldn’t update follow', 'bad');
    } finally {
      setFollowBusy((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  };

  return (
    <div className="discover">
      <header className="discover-head">
        <div>
          <span className="kicker live">The professional index</span>
          <h2 className="display title-lg">Find the people behind the work.</h2>
          <p className="lede">Tailors, designers and ateliers shaping DORI — follow them to see their designs first.</p>
        </div>
        <label className="input-icon discover-search">
          <Search />
          <input className="input input-pill" aria-label="Search makers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, @username or skill" />
        </label>
      </header>

      {loading ? <DiscoverSkeleton /> : visible.length === 0 ? (
        <div className="empty glass feed-empty"><Avatar size={52} /><strong>No makers found</strong><p>Try a different name or skill.</p></div>
      ) : (
        <div className="maker-grid">
          {visible.map((maker, index) => (
            <MakerCard
              key={maker.id}
              maker={maker}
              index={index}
              following={following.has(maker.id)}
              busy={followBusy.has(maker.id)}
              isSelf={viewerProfile?.id === maker.profile_id}
              onFollow={() => toggleFollow(maker)}
              onOpen={() => setSelected(maker)}
            />
          ))}
        </div>
      )}

      {selected && (
        <MakerModal
          maker={selected}
          viewerProfile={viewerProfile}
          following={following.has(selected.id)}
          busy={followBusy.has(selected.id)}
          onFollow={() => toggleFollow(selected)}
          onClose={() => setSelected(null)}
          onOpenPost={setOpenPost}
          onNavigate={(step) => { setSelected(null); onNavigate(step); }}
        />
      )}
      {openPost && (
        <PostDetail
          post={openPost}
          viewer={viewerProfile}
          onClose={() => setOpenPost(null)}
          onRemix={(post) => { setOpenPost(null); setSelected(null); onSelectPost(post); }}
        />
      )}
    </div>
  );
}
