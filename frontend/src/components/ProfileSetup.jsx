import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, MapPin } from 'lucide-react';
import { AuthStage } from './AuthPage';
import Avatar from './Avatar';
import { checkUsername, createMyProfile, uploadImage } from '../api/client';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export default function ProfileSetup({ session, onComplete }) {
  const fileRef = useRef(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState(session.user?.user_metadata?.full_name || session.user?.email?.split('@')[0] || '');
  const [bio, setBio] = useState('');
  const [isProfessional, setIsProfessional] = useState(false);
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [availability, setAvailability] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return setAvailability('');
    if (!USERNAME_PATTERN.test(normalized)) return setAvailability('Use 3-24 lowercase letters, numbers, or underscores.');
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkUsername(normalized);
        if (cancelled) return;
        setAvailability(result.available ? 'Username is available.' : result.reason || 'That username is already taken.');
      } catch { if (!cancelled) setAvailability('Username check is temporarily unavailable.'); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [username]);

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => setImage({ src: reader.result });
    reader.readAsDataURL(file);
  };

  const cropAvatar = () => new Promise((resolve) => {
    if (!image) return resolve(null);
    const source = new Image();
    source.onload = () => {
      const size = Math.min(source.width, source.height) / zoom;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      context.drawImage(source, (source.width - size) / 2, (source.height - size) / 2, size, size, 0, 0, 512, 512);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    };
    source.src = image.src;
  });

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toFixed(4));
          setLongitude(position.coords.longitude.toFixed(4));
        },
        (err) => {
          console.error(err);
          setError('Could not fetch location. Please ensure location permissions are granted.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) return setError('Username must be 3-24 lowercase letters, numbers, or underscores.');
    if (!fullName.trim()) return setError('Add your name to continue.');
    if (availability === 'That username is already taken.') return setError('Choose an available username first.');
    if (availability !== 'Username is available.') return setError('Wait for the username availability check to finish.');
    if (isProfessional && (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || latitude === '' || longitude === '')) return setError('Add your workshop latitude and longitude to set up a professional account.');
    setSaving(true);

    const userId = session.user.id;
    if (!userId) {
      setSaving(false);
      setError('Could not verify your sign-in session. Please try again.');
      return;
    }

    try {
      const avatar = await cropAvatar();
      const avatarUrl = avatar ? await uploadImage(avatar, 'avatars') : null;
      const data = await createMyProfile({ username: normalized, full_name: fullName.trim(), bio: bio.trim(), avatar_url: avatarUrl, is_professional: isProfessional, location: location.trim() || null, latitude: isProfessional ? Number(latitude) : null, longitude: isProfessional ? Number(longitude) : null });
      onComplete({ ...data, email: session.user.email || '', latitude: isProfessional ? Number(latitude) : null, longitude: isProfessional ? Number(longitude) : null });
    } catch (profileError) {
      setError(profileError.message || 'Could not save your profile.');
    } finally { setSaving(false); }
  };

  const availabilityTone = availability === 'Username is available.' ? 'is-ok' : /taken|Use 3-24|unavailable/.test(availability) ? 'is-bad' : '';

  return (
    <AuthStage>
      <main className="auth-center">
        <form onSubmit={saveProfile} className="onboard-card glass" aria-labelledby="onboard-title">
          <span className="kicker live">One last step</span>
          <h1 id="onboard-title" className="auth-title" style={{ marginTop: 14 }}>Build your DORI profile</h1>
          <p className="auth-subtitle">Pick the name people will find you by. You can change everything except your @username later.</p>
          <div className="onboard-grid">
            <div className="onboard-photo">
              <div className="onboard-photo-ring">
                {image ? <img src={image.src} alt="Profile preview" style={{ transform: `scale(${zoom})` }} /> : <Avatar size={168} name={fullName} />}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={chooseImage} hidden />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}><ImagePlus /> {image ? 'Change photo' : 'Upload photo'}</button>
              {image && <label className="field" style={{ width: '100%' }}><span className="field-label">Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(event.target.value)} style={{ accentColor: '#fff' }} /></label>}
              {!image && <p className="onboard-hint" style={{ textAlign: 'center' }}>No photo? We’ll show the DORI mark.</p>}
            </div>
            <div className="onboard-fields">
              <label className="field">
                <span className="field-label">Username</span>
                <span className="onboard-handle"><span>@</span><input id="username" className="input" required maxLength="24" value={username} onChange={(event) => { setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()); setAvailability(''); }} placeholder="yourname" autoFocus /></span>
                <p className={`onboard-hint ${availabilityTone}`}>{availability || 'Your public page will be /profile/yourname'}</p>
              </label>
              <label className="field"><span className="field-label">Name</span><input id="full-name" className="input" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label className="field"><span className="field-label">Bio</span><textarea id="bio" className="input" rows="3" maxLength="160" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell people what you make or wear…" /></label>
              <label className="onboard-toggle">
                <span><strong>Professional account</strong><small>For tailors and designers — get an order inbox and a shop.</small></span>
                <span className="switch"><input type="checkbox" checked={isProfessional} onChange={(event) => setIsProfessional(event.target.checked)} /><i /></span>
              </label>
              {isProfessional && <>
                <label className="field"><span className="field-label">Workshop location</span><input id="location" className="input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, country" /></label>
                <div className="onboard-row">
                  <label className="field"><span className="field-label">Latitude</span><input className="input" type="number" min="-90" max="90" step="any" required value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="19.0760" /></label>
                  <label className="field"><span className="field-label">Longitude</span><input className="input" type="number" min="-180" max="180" step="any" required value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="72.8777" /></label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <p className="onboard-hint">Coordinates let nearby customers match with your workshop.</p>
                  <button type="button" onClick={handleLocateMe} className="btn btn-sm btn-ghost"><MapPin /> Locate me</button>
                </div>
              </>}
            </div>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-solid btn-lg btn-block" style={{ marginTop: 26, borderRadius: 12 }}>{saving ? <><LoaderCircle className="animate-spin" /> Saving profile…</> : <><Check /> Continue to DORI</>}</button>
        </form>
      </main>
    </AuthStage>
  );
}
