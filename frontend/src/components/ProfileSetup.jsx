import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, Sparkles, MapPin } from 'lucide-react';
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

  return (
    <main className="min-h-screen bg-transparent text-gray-100 flex items-center justify-center px-4 py-10">
      <form onSubmit={saveProfile} className="w-full max-w-2xl lp-glass-panel rounded-2xl border border-white/20 p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl lp-glass-button flex items-center justify-center"><Sparkles className="w-5 h-5 " /></div><div><p className="text-xs text-gray-300 font-mono uppercase tracking-widest m-0">One last step</p><h1 className="text-2xl font-bold m-0">Build your DORI profile</h1></div></div>
        <div className="grid md:grid-cols-[180px_1fr] gap-8">
          <div className="space-y-3"><div className="w-44 h-44 rounded-full overflow-hidden border border-gray-700 lp-glass-input flex items-center justify-center">{image ? <img src={image.src} alt="Profile preview" className="w-full h-full object-cover" style={{ transform: `scale(${zoom})` }} /> : <ImagePlus className="w-8 h-8 text-gray-600" />}</div><input ref={fileRef} type="file" accept="image/*" onChange={chooseImage} className="hidden" /><button type="button" onClick={() => fileRef.current?.click()} className="w-full py-2 rounded-xl border border-gray-700 text-xs text-gray-300 hover:border-white">Upload profile photo</button>{image && <label className="block text-[11px] text-gray-400">Crop / zoom<input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(event.target.value)} className="w-full accent-white" /></label>}</div>
          <div className="space-y-4"><div><label htmlFor="username" className="text-xs text-gray-300">Username</label><div className="flex items-center"><span className="lp-glass-input border border-r-0 border-white/20 rounded-l-xl px-3 py-3 text-white">@</span><input id="username" required maxLength="24" value={username} onChange={(event) => { setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()); setAvailability(''); }} placeholder="yourname" className="w-full lp-glass-input border border-white/20 rounded-r-xl px-3 py-3 text-sm focus:border-white focus:outline-none" /></div><p className={`text-[11px] mt-1 ${availability === 'Username is available.' ? 'text-green-300' : availability.includes('taken') || availability.includes('Run') ? 'text-rose-300' : 'text-gray-500'}`}>{availability || 'Your public URL will be /profile/yourname'}</p></div><div><label htmlFor="full-name" className="text-xs text-gray-300">Name</label><input id="full-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full mt-1 lp-glass-input border border-white/20 rounded-xl px-3 py-3 text-sm focus:border-white focus:outline-none" /></div><div><label htmlFor="bio" className="text-xs text-gray-300">Bio</label><textarea id="bio" rows="3" maxLength="160" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell people what you make or wear..." className="w-full mt-1 lp-glass-input border border-white/20 rounded-xl px-3 py-3 text-sm resize-none focus:border-white focus:outline-none" /></div><label className="flex items-center justify-between gap-4 rounded-xl border border-white/20 lp-glass-input p-4 cursor-pointer"><span><span className="block text-sm font-semibold">Professional account</span><span className="block text-xs text-gray-500 mt-1">Show that you create, tailor, or work in fashion.</span></span><input type="checkbox" checked={isProfessional} onChange={(event) => setIsProfessional(event.target.checked)} className="h-5 w-5 accent-white" /></label>{isProfessional && <><div><label htmlFor="location" className="text-xs text-gray-300">Workshop location</label><input id="location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, country" className="w-full mt-1 lp-glass-input border border-white/20 rounded-xl px-3 py-3 text-sm" /></div><div className="grid grid-cols-2 gap-3"><label className="text-xs text-gray-300">Latitude<input type="number" min="-90" max="90" step="any" required value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="19.0760" className="w-full mt-1 lp-glass-input border border-white/20 rounded-xl px-3 py-3 text-sm" /></label><label className="text-xs text-gray-300">Longitude<input type="number" min="-180" max="180" step="any" required value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="72.8777" className="w-full mt-1 lp-glass-input border border-white/20 rounded-xl px-3 py-3 text-sm" /></label></div><div className="flex justify-between items-end"><p className="text-[11px] text-gray-500">Coordinates let nearby customers discover and match with your workshop.</p><button type="button" onClick={handleLocateMe} className="text-[11px] bg-white/10 hover:bg-white/20 text-white py-1 px-3 rounded-lg flex items-center gap-1 transition-colors"><MapPin className="w-3 h-3" /> Locate Me</button></div></>}</div>
        </div>
        {error && <p className="mt-5 text-sm text-rose-300" role="alert">{error}</p>}
        <button type="submit" disabled={saving} className="w-full mt-8 py-3 rounded-xl lp-glass-button  font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50">{saving ? <><LoaderCircle className="w-4 h-4 animate-spin" />Saving profile...</> : <><Check className="w-4 h-4" />Continue to DORI</>}</button>
      </form>
    </main>
  );
}
