import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Link2, MapPin, Pencil } from 'lucide-react';
import { fetchProfile, fetchPosts } from '../api/client';
import Avatar from '../components/Avatar';
import PageLoader from '../components/PageLoader';
import PostDetail from '../components/PostDetail';
import StatRow from '../components/StatRow';
import { DoriWordmark } from '../components/DoriLogo';
import { postPrice } from '../utils/time';
import { toast } from '../utils/toast';

export default function ProfilePage({ username, profile: suppliedProfile, onEdit, onSelectPost }) {
  const [profile, setProfile] = useState(suppliedProfile);
  const [posts, setPosts] = useState(null);
  const [openPost, setOpenPost] = useState(null);

  useEffect(() => {
    let active = true;
    fetchProfile(username)
      .then((fresh) => { if (active) setProfile((old) => ({ ...old, ...fresh })); })
      .catch(() => { if (active && !suppliedProfile) setProfile(null); });
    return () => { active = false; };
  }, [username, suppliedProfile]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let active = true;
    fetchPosts()
      .then((data) => { if (active) setPosts(data.filter((post) => post.profile_id === profile.id || post.designer_handle === `@${profile.username}` || post.tailor_id === profile.id)); })
      .catch(() => { if (active) setPosts([]); });
    return () => { active = false; };
  }, [profile?.id, profile?.username]);

  if (profile === undefined) return <PageLoader label="Loading profile…" />;
  if (!profile) return <div className="empty glass feed-empty"><Avatar size={52} /><strong>Profile not found</strong><p>This @username doesn’t exist on DORI yet.</p><a className="btn btn-sm" href="/app/">Open DORI</a></div>;

  const shareProfile = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/app/profile/${profile.username}`); toast('Profile link copied'); }
    catch { toast('Couldn’t copy the link', 'bad'); }
  };

  const stats = [
    { label: 'Designs', value: posts?.length || 0, loading: posts === null },
    { label: 'Followers', value: profile.followers_count ?? 0 },
    { label: 'Following', value: profile.following_count ?? 0 },
  ];
  if (profile.is_professional && profile.rating) stats.push({ label: `Rating · ${profile.reviews_count || 0} reviews`, value: Number(profile.rating), format: (value) => value.toFixed(1) });

  const cover = (posts || []).filter((post) => post.image_url).slice(0, 3);

  return (
    <div className="profile-page">
      <section className="profile-hero glass">
        <div className="profile-hero-backdrop" aria-hidden="true">
          {cover.length ? cover.map((post) => <img key={post.id} src={post.image_url} alt="" />) : <DoriWordmark />}
        </div>
        <div className="profile-hero-main">
          <Avatar src={profile.avatar_url} name={profile.full_name} size={132} />
          <div className="profile-hero-id">
            <span className="kicker live">{profile.is_professional ? 'Professional · tailor & designer' : 'DORI member'}</span>
            <h2 className="display title-lg">{profile.full_name || profile.username}</h2>
            <span className="profile-hero-handle">@{profile.username}{profile.location && <><MapPin /> {profile.location}</>}</span>
            {profile.bio && <p className="lede">{profile.bio}</p>}
          </div>
          <div className="profile-hero-actions">
            {onEdit ? <button type="button" className="btn btn-sm" onClick={onEdit}><Pencil /> Edit profile</button> : <a className="btn btn-sm" href="/app/">Open DORI</a>}
            <button type="button" className="btn btn-sm btn-ghost" onClick={shareProfile}><Link2 /> Share</button>
          </div>
        </div>
        <StatRow stats={stats} className="profile-stats" />
      </section>

      {onEdit && !profile.is_professional && (
        <button type="button" className="profile-upgrade glass" onClick={onEdit}>
          <span><strong>Are you a tailor or designer?</strong><em>Switch to a professional account to get an order inbox, a shop and a public portfolio.</em></span>
          <span className="btn btn-sm btn-solid">Go professional <ArrowUpRight /></span>
        </button>
      )}

      <section className="profile-work">
        <div className="feed-section-head">
          <h3 className="display title-sm">Designs</h3>
          {posts && <span className="muted tiny">{posts.length} {posts.length === 1 ? 'design' : 'designs'}</span>}
        </div>
        {posts?.length === 0 ? (
          <div className="empty glass feed-empty"><Avatar size={52} /><strong>No designs yet</strong><p>{onEdit ? 'Designs you publish will appear here.' : 'Nothing published yet.'}</p></div>
        ) : (
          <div className="maker-portfolio profile-grid">
            {(posts || []).map((post, index) => (
              <button type="button" key={post.id} className="maker-portfolio-item rise" style={{ '--i': index }} onClick={() => setOpenPost(post)}>
                <img src={post.image_url} alt="" loading="lazy" />
                <span><strong>{post.title}</strong><em>From {postPrice(post)}</em></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {openPost && (
        <PostDetail
          post={openPost}
          viewer={suppliedProfile}
          onClose={() => setOpenPost(null)}
          onRemix={(post) => { setOpenPost(null); if (onSelectPost) onSelectPost(post); else window.location.href = `/app/?post=${encodeURIComponent(post.id)}`; }}
        />
      )}
    </div>
  );
}
