import React, { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, Sparkles, Share2, User } from 'lucide-react';
import { fetchProfile, fetchPosts } from '../api/client';

export default function ProfilePage({ username, profile: suppliedProfile, onEdit }) {
  const [profile, setProfile] = useState(suppliedProfile);

  useEffect(() => {
    if (suppliedProfile) { fetchProfile(username).then((fresh) => setProfile((old) => ({ ...old, ...fresh }))).catch(() => {}); return; }
    fetchProfile(username).then(setProfile).catch(() => setProfile(null));
  }, [username, suppliedProfile]);

  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    if (!profile) return;
    fetchPosts().then((data) => setPosts(data.filter((post) => post.profile_id === profile.id || post.designer_handle === `@${profile.username}` || post.tailor_id === profile.id))).catch(console.error);
  }, [profile]);

  const followers = profile.followers_count ?? 0;

  if (profile === undefined) return <div className="min-h-screen bg-transparent text-gray-400 flex items-center justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen bg-transparent text-gray-100 flex items-center justify-center"><p>Profile not found.</p></div>;

  return (
    <main className="min-h-screen bg-transparent text-gray-100 p-8 max-w-6xl mx-auto space-y-8">
      <div className="dashboard-header">
        <div className="dashboard-user">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} />
          ) : (
            <div className="w-[120px] h-[120px] rounded-full border border-gray-700 lp-glass-input flex items-center justify-center bg-gray-800/50 mb-4 mx-auto">
              <User className="w-10 h-10 text-gray-500" />
            </div>
          )}
          <h2 className="text-xl font-bold">{profile.full_name || profile.username}</h2>
          <span className="text-xs text-gray-400">@{profile.username}</span>
          
        </div>
        <div className="dashboard-info">
          <div className="flex justify-between items-start">
            <div>
              <h2>Hello, {profile.full_name || profile.username}!</h2>
              {profile.bio && <p className="text-gray-300">{profile.bio}</p>}
            </div>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/app/profile/${profile.username}`;
                navigator.clipboard.writeText(url);
                alert('Profile link copied to clipboard!');
              }}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              title="Share Profile"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          {!profile.is_professional && (
            <div className="mt-4 p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl text-amber-200">
              <p className="font-semibold mb-2">Are you a tailor?</p>
              <button onClick={onEdit} className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition-colors">
                Upgrade to Professional Account
              </button>
            </div>
          )}
          {profile.is_professional && (
            <div className="mt-4">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-xs text-amber-300 font-bold">
                PRO TAILOR
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-dashboard-stats rounded-b-xl overflow-hidden">
        <div className="stat-box">
          <h3>{posts.length}</h3>
          <p>Posts</p>
        </div>
        <div className="stat-box">
          <h3>{followers}</h3>
          <p>Followers</p>
        </div>
        <div className="stat-box">
          <h3>{profile.rating || 'N/A'}</h3>
          <p>Rating</p>
        </div>
        <div className="stat-box">
          <h3>{profile.reviews_count || 0}</h3>
          <p>Reviews</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold mb-6 border-b border-white/10 pb-2">Your Feed & Collections</h3>
        {posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 border border-white/10 rounded-2xl bg-black/20">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No post yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {posts.map(post => (
              <div key={post.id} className="aspect-[4/5] rounded-xl overflow-hidden border border-white/10 relative group">
                <img src={post.image_url} alt={post.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <h4 className="font-bold">{post.title}</h4>
                  <p className="text-xs text-gray-300">From {new Intl.NumberFormat('en-IN', { style: 'currency', currency: post.currency || 'INR' }).format(Number(post.starting_price_minor || ((post.price_reference || 0) * 100)) / 100)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {onEdit ? (
        <div className="pt-8 flex justify-center">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 px-6 py-3 rounded-full transition-colors border border-white/10">
            Edit profile settings <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="pt-8 flex justify-center">
          <a href="/app/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 px-6 py-3 rounded-full transition-colors border border-white/10">
            Open DORI <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </main>
  );
}
