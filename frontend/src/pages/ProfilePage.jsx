import React, { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, Sparkles } from 'lucide-react';
import { supabase } from '../api/supabase';

export default function ProfilePage({ username, profile: suppliedProfile, onEdit }) {
  const [profile, setProfile] = useState(suppliedProfile);

  useEffect(() => {
    if (suppliedProfile || !supabase) return;
    supabase.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [username, suppliedProfile]);

  if (profile === undefined) return <div className="min-h-screen bg-transparent text-gray-400 flex items-center justify-center"><LoaderCircle className="w-5 h-5 animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen bg-transparent text-gray-100 flex items-center justify-center"><p>Profile not found.</p></div>;

  return (
    <main className="min-h-screen bg-transparent text-gray-100 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl lp-glass-panel rounded-2xl border border-white/20 p-8 text-center">
        {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-amber-400" /> : <div className="w-28 h-28 rounded-full lp-glass-button  mx-auto flex items-center justify-center"><Sparkles /></div>}
        <p className="text-sm text-gray-300 font-mono mt-5">@{profile.username}</p>
        <h1 className="text-3xl font-bold mt-1">{profile.full_name}</h1>
        {profile.is_professional && <span className="inline-block mt-3 px-3 py-1 rounded-full lp-glass-button/10 border border-amber-400/30 text-xs text-gray-300">Professional account</span>}
        <p className="text-gray-400 mt-5 whitespace-pre-wrap">{profile.bio || 'Welcome to my DORI profile.'}</p>
        {onEdit ? <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 mt-8 text-sm text-gray-300 hover:text-white">Edit profile <ExternalLink className="w-4 h-4" /></button> : <a href="/app/" className="inline-flex items-center gap-2 mt-8 text-sm text-gray-300 hover:text-white">Open DORI <ExternalLink className="w-4 h-4" /></a>}
      </section>
    </main>
  );
}