import React, { useRef, useState } from 'react';
import { Check, ImagePlus, KeyRound, LoaderCircle, Save } from 'lucide-react';
import { supabase } from '../api/supabase';

export default function SettingsPage({ session, profile, onSaved }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({ full_name: profile.full_name, email: profile.email, bio: profile.bio || '', is_professional: profile.is_professional });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith('image/')) return setError('Choose an image file.');
    const reader = new FileReader();
    reader.onload = () => setAvatar({ src: reader.result, file });
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setMessage(''); setError('');
    if (newPassword && newPassword !== confirmPassword) { setSaving(false); setError('Passwords do not match.'); return; }
    if (newPassword && newPassword.length < 6) { setSaving(false); setError('Password must be at least 6 characters.'); return; }
    let avatarUrl = profile.avatar_url;
    if (avatar) {
      const image = new Image();
      const blob = await new Promise((resolve) => {
        image.onload = () => {
          const size = Math.min(image.width, image.height);
          const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
          canvas.getContext('2d').drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 512, 512);
          canvas.toBlob(resolve, 'image/jpeg', .9);
        };
        image.src = avatar.src;
      });
      const path = `${session.user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) { setSaving(false); setError(uploadError.message); return; }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const { data, error: profileError } = await supabase.from('profiles').update({ full_name: form.full_name.trim(), email: form.email.trim(), bio: form.bio.trim(), is_professional: form.is_professional, avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', profile.id).select().single();
    if (profileError) { setSaving(false); setError(profileError.message); return; }
    if (form.email !== profile.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: form.email });
      if (emailError) { setSaving(false); setError(emailError.message); return; }
      setMessage('Profile saved. Check your new email to confirm the address change.');
    } else setMessage('Profile saved.');
    if (newPassword) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) { setSaving(false); setError(passwordError.message); return; }
      setNewPassword(''); setConfirmPassword(''); setMessage('Profile and password updated.');
    }
    setSaving(false); onSaved(data);
  };

  const requestPasswordReset = async () => {
    setMessage(''); setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: `${window.location.origin}/app/settings` });
    if (resetError) setError(resetError.message); else setMessage('Password verification link sent. Open it from your email to choose a new password.');
  };

  return <form onSubmit={save} className="settings-layout">
    <section className="settings-main lp-glass-panel">
      <div className="settings-heading"><div><span className="dori-kicker">Identity / Edit</span><h2>Make this space yours</h2><p>Update your public identity and how people find you.</p></div><button type="submit" disabled={saving} className="dori-primary-button">{saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes</button></div>
      <div className="settings-avatar-row"><div className="settings-avatar">{avatar?.src || profile.avatar_url ? <img src={avatar?.src || profile.avatar_url} alt="Avatar preview" /> : <ImagePlus className="w-7 h-7" />}</div><div><input ref={fileRef} type="file" accept="image/*" onChange={chooseAvatar} className="hidden" /><button type="button" onClick={() => fileRef.current?.click()} className="dori-secondary-button">Change profile photo</button><p>Square crop is applied automatically.</p></div></div>
      <div className="settings-fields"><label>Name<input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} required /></label><label>Username<div className="username-readonly">@{profile.username}</div></label><label className="settings-wide">Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label><label className="settings-wide">Bio<textarea value={form.bio} maxLength="160" rows="4" onChange={(event) => update('bio', event.target.value)} /></label></div>
      <label className="professional-toggle"><span><strong>Professional account</strong><small>Unlock New post and make your work discoverable.</small></span><input type="checkbox" checked={form.is_professional} onChange={(event) => update('is_professional', event.target.checked)} /></label>
      {message && <p className="settings-success"><Check className="w-4 h-4" />{message}</p>}{error && <p className="settings-error">{error}</p>}
    </section>
    <section className="settings-security lp-glass-panel"><span className="dori-kicker">Security</span><h2>Password</h2><p>Password changes require email verification. Send a secure one-time link first, then return here to choose a new password.</p><button type="button" onClick={requestPasswordReset} className="dori-secondary-button"><KeyRound className="w-4 h-4" /> Send verification link</button><div className="settings-password-fields"><label>New password<input type="password" minLength="6" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" /></label><label>Confirm password<input type="password" minLength="6" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" /></label><small>After opening the verification email, enter the new password and save changes.</small></div></section>
  </form>;
}
