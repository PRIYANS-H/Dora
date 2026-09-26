import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { fetchPosts } from '../api/client';
import CapsuleTabs from '../components/CapsuleTabs';
import PostDetail from '../components/PostDetail';
import Avatar from '../components/Avatar';
import { swatchFor, fabricTexture } from '../utils/attributes';
import { postPrice } from '../utils/time';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'silk', label: 'Silk' },
  { id: 'linen', label: 'Linen' },
  { id: 'cotton', label: 'Cotton' },
  { id: 'wool', label: 'Wool' },
];
const HERO_WORDS = ['See it.', 'Remix it.', 'Wear it.'];

function FeedSkeleton() {
  return (
    <div className="feed-grid">
      {Array.from({ length: 8 }, (_, index) => <div key={index} className="post-card is-skeleton"><div className="dori-skeleton post-card-media" /></div>)}
    </div>
  );
}

// Slow cross-fade through the top designs — the landing's video stage, in stills.
function HeroStage({ images }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % images.length), 6500);
    return () => window.clearInterval(timer);
  }, [images.length]);
  return (
    <div className="feed-hero-stage" aria-hidden="true">
      {images.map((src, position) => <img key={src} src={src} alt="" className={position === index ? 'is-active' : ''} />)}
    </div>
  );
}

function PostCard({ post, index, onOpen }) {
  const attrs = post.base_attributes || {};
  const colorDot = swatchFor(attrs.color);
  return (
    <article className="post-card rise" style={{ '--i': Math.min(index, 12) }}>
      <button type="button" className="post-card-hit" onClick={() => onOpen(post)} aria-label={`Open ${post.title}`}>
        <div className="post-card-media">
          <img src={post.image_url} alt="" loading="lazy" />
          <span className="post-card-price glass-capsule">From {postPrice(post)}</span>
          <span className="post-card-cta glass-capsule"><Sparkles /> Open & remix</span>
          <div className="post-card-caption">
            <h3>{post.title}</h3>
            <div className="post-card-by">
              <Avatar name={post.designer_name} size={22} />
              <span>{post.designer_name || 'DORI designer'}</span>
            </div>
          </div>
        </div>
      </button>
      {(colorDot || attrs.fabric || attrs.fit) && (
        <div className="post-card-attrs">
          {colorDot && <span className="chip"><i className="chip-dot" style={{ background: colorDot }} />{attrs.color}</span>}
          {attrs.fabric && <span className="chip"><i className="chip-dot" style={{ background: fabricTexture(attrs.fabric) }} />{attrs.fabric}</span>}
          {attrs.fit && <span className="chip">{attrs.fit}</span>}
        </div>
      )}
    </article>
  );
}

export default function FeedPage({ onSelectPost, initialPostId, viewerProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [activePost, setActivePost] = useState(null);

  useEffect(() => {
    fetchPosts()
      .then((data) => {
        setPosts(data);
        if (initialPostId) setActivePost(data.find((post) => post.id === initialPostId) || null);
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, [initialPostId]);

  const filteredPosts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesSearch = !needle || [post.title, post.designer_name, post.designer_handle, post.garment_type].some((value) => String(value || '').toLowerCase().includes(needle));
      const matchesFabric = filter === 'all' || String(post.base_attributes?.fabric || '').toLowerCase().includes(filter);
      return matchesSearch && matchesFabric;
    });
  }, [posts, searchTerm, filter]);

  const heroImages = useMemo(() => posts.filter((post) => post.image_url).slice(0, 4).map((post) => post.image_url), [posts]);

  return (
    <div className="feed">
      <section className="feed-hero glass">
        <HeroStage images={heroImages} />
        <div className="feed-hero-copy">
          <span className="kicker live">Remixable couture network</span>
          <h2 className="display feed-hero-title">
            {HERO_WORDS.map((word, index) => <span key={index} style={{ '--i': index }}>{word}</span>)}
          </h2>
          <p className="lede">Open any design, swap the neckline, fabric or colour, then match with a tailor who can make it for you.</p>
        </div>
        <div className="feed-hero-controls">
          <CapsuleTabs options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter by fabric" />
          <label className="input-icon feed-search">
            <Search />
            <input className="input input-pill" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search designs or designers" aria-label="Search designs or designers" />
          </label>
        </div>
      </section>

      <div className="feed-section-head">
        <h3 className="display title-sm">{filter === 'all' ? 'Fresh in your orbit' : `${FILTERS.find((item) => item.id === filter)?.label} designs`}</h3>
        {!loading && <span className="muted tiny">{filteredPosts.length} {filteredPosts.length === 1 ? 'design' : 'designs'}</span>}
      </div>

      {loading ? <FeedSkeleton /> : filteredPosts.length === 0 ? (
        <div className="empty glass feed-empty">
          <Avatar size={52} />
          <strong>Nothing matches that yet</strong>
          <p>Try another fabric or clear the search to see every design.</p>
          <button type="button" className="btn btn-sm" onClick={() => { setFilter('all'); setSearchTerm(''); }}>Show everything <ArrowUpRight /></button>
        </div>
      ) : (
        <div className="feed-grid">
          {filteredPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} onOpen={setActivePost} />)}
        </div>
      )}

      {activePost && (
        <PostDetail
          post={activePost}
          viewer={viewerProfile}
          onClose={() => setActivePost(null)}
          onRemix={(post) => { setActivePost(null); onSelectPost(post); }}
        />
      )}
    </div>
  );
}
