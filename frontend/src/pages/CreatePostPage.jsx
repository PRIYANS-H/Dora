import React, { useState } from 'react';
import { ImagePlus, Send } from 'lucide-react';
import { supabase } from '../api/supabase';

export default function CreatePostPage({ profile, onPosted }) {
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setStatus('');
    const { error } = await supabase.from('posts').insert({ title, image_url: imageUrl, designer_name: profile.full_name, designer_handle: `@${profile.username}`, base_attributes: { description }, price_reference: 0 });
    setSaving(false);
    if (error) setStatus(error.message); else { setStatus('Published to the feed.'); setTitle(''); setImageUrl(''); setDescription(''); onPosted(); }
  };

  return <form onSubmit={submit} className="create-post-page lp-glass-panel"><div className="create-post-art"><ImagePlus className="w-10 h-10" /><span>Paste an image URL to publish your work</span></div><div className="create-post-fields"><span className="dori-kicker">Professional / New post</span><h2>Put your work in the orbit.</h2><label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A name for this piece" /></label><label>Image URL<input required type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." /></label><label>Caption<textarea rows="4" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell the community about this look" /></label><button type="submit" disabled={saving} className="dori-primary-button"><Send className="w-4 h-4" />{saving ? 'Publishing...' : 'Publish post'}</button>{status && <p className="settings-success">{status}</p>}</div></form>;
}
