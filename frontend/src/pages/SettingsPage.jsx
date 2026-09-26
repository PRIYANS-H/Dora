import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Check, ImagePlus, KeyRound, LoaderCircle, Save, X, MapPin, ShieldCheck } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { supabase } from '../api/supabase';
import { customRequestReset, customConfirmReset } from '../api/auth';
import { uploadImage } from '../api/client';
import { updateMyProfile, fetchRazorpaySettings, saveRazorpaySettings, disableRazorpaySettings } from '../api/client';
import getCroppedImg from '../utils/cropImage';

export default function SettingsPage({ session, profile, onSaved }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({ username: profile.username, full_name: profile.full_name, email: profile.email, bio: profile.bio || '', is_professional: profile.is_professional, skills: (profile.skills || []).join(', '), location: profile.location || '', latitude: profile.latitude ?? '', longitude: profile.longitude ?? '', phone_number: profile.phone_number || '', phone_visible_to_order_partners: !!profile.phone_visible_to_order_partners });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [payment, setPayment] = useState({ key_id: '', key_secret: '' });
  const [paymentState, setPaymentState] = useState({ configured: false, enabled: false, has_key_secret: false });
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!profile.is_professional) return;
    fetchRazorpaySettings().then((settings) => { setPaymentState(settings); setPayment((old) => ({ ...old, key_id: settings.key_id || '' })); }).catch((e) => setPaymentError(e.message));
  }, [profile.is_professional]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith('image/')) return setError('Choose an image file.');
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar({ src: reader.result, file });
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  
  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          update('latitude', position.coords.latitude.toFixed(4));
          update('longitude', position.coords.longitude.toFixed(4));
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

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setMessage(''); setError('');
    if (newPassword && newPassword !== confirmPassword) { setSaving(false); setError('Passwords do not match.'); return; }
    if (newPassword && newPassword.length < 6) { setSaving(false); setError('Password must be at least 6 characters.'); return; }
    let avatarUrl = profile.avatar_url;
    if (avatar && croppedAreaPixels) {
      try {
        const blob = await getCroppedImg(avatar.src, croppedAreaPixels);
        avatarUrl = await uploadImage(blob, 'avatars');
      } catch (e) {
        setSaving(false); setError('Failed to upload avatar: ' + e.message); return;
      }
    }
    let data;
    try {
      data = await updateMyProfile({ username: form.username, full_name: form.full_name, bio: form.bio, is_professional: form.is_professional, avatar_url: avatarUrl, skills: form.skills.split(',').map((value) => value.trim()).filter(Boolean), location: form.location, latitude: form.latitude === '' ? null : Number(form.latitude), longitude: form.longitude === '' ? null : Number(form.longitude), phone_number: form.phone_number, phone_visible_to_order_partners: form.phone_visible_to_order_partners });
      const { error: emailError } = await supabase.from('profiles').update({ email: form.email.trim() }).eq('id', profile.id);
      if (emailError) throw new Error(emailError.message);
      data = { ...data, email: form.email.trim() };
    } catch (profileError) { setSaving(false); setError(profileError.message); return; }
    
    if (newPassword) {
      if (!resetOtp) { setSaving(false); setError('You must enter the verification code to change your password.'); return; }
      try {
        await customConfirmReset(form.email, resetOtp, newPassword);
        setNewPassword(''); setConfirmPassword(''); setResetOtp(''); setResetRequested(false);
      setMessage('Profile and password updated successfully!');
      } catch (e) {
        setSaving(false); setError(e.message); return;
      }
    } else {
      setMessage('Profile saved.');
    }
    
    setSaving(false); onSaved(data);
  };

  const requestPasswordReset = async () => {
    setMessage(''); setError('');
    try {
      await customRequestReset(form.email);
      setResetRequested(true);
      setMessage('Password verification code sent to your email. Enter it below to confirm your new password.');
    } catch (e) {
      setError(e.message);
    }
  };

  const savePayments = async () => {
    setPaymentBusy(true); setPaymentError(''); setPaymentNotice('');
    try {
      const saved = await saveRazorpaySettings(payment);
      setPaymentState(saved); setPayment((old) => ({ ...old, key_secret: '' }));
      setPaymentNotice('Razorpay is enabled. Secret values were saved securely and cleared from this form.');
    } catch (e) { setPaymentError(e.message); }
    finally { setPaymentBusy(false); }
  };
  const disablePayments = async () => {
    setPaymentBusy(true); setPaymentError(''); setPaymentNotice('');
    try { const saved = await disableRazorpaySettings(); setPaymentState(saved); setPaymentNotice('Razorpay checkout is disabled for new orders.'); }
    catch (e) { setPaymentError(e.message); }
    finally { setPaymentBusy(false); }
  };

  return <form onSubmit={save} className="settings-layout">
    <section className="settings-main lp-glass-panel">
      <div className="settings-heading"><div><span className="dori-kicker">Identity / Edit</span><h2>Make this space yours</h2><p>Update your public identity and how people find you.</p></div><button type="submit" disabled={saving} className="dori-primary-button">{saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes</button></div>
      <div className="settings-avatar-row"><div className="settings-avatar">{avatar?.src || profile.avatar_url ? <img src={avatar?.src || profile.avatar_url} alt="Avatar preview" style={{objectFit: 'cover', width: '100%', height: '100%'}} /> : <ImagePlus className="w-7 h-7" />}</div><div><input ref={fileRef} type="file" accept="image/*" onChange={chooseAvatar} className="hidden" /><button type="button" onClick={() => fileRef.current?.click()} className="dori-secondary-button">Change profile photo</button><p>Adjustable grid cropper is enabled.</p></div></div>
      
      {isCropping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h3 className="font-semibold">Crop Avatar</h3>
              <button type="button" onClick={() => { setIsCropping(false); setAvatar(null); }} className="text-white/50 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="relative w-full h-[400px] bg-black">
              <Cropper
                image={avatar?.src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 flex flex-col gap-4">
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} className="w-full accent-emerald-500" />
              <button type="button" onClick={() => setIsCropping(false)} className="dori-primary-button w-full">Apply Crop</button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-fields"><label>Name<input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} required /></label><label>Username<input value={form.username} maxLength="24" onChange={(event) => update('username', event.target.value)} required /></label><label className="settings-wide">Account email<input type="email" value={form.email || ''} readOnly aria-describedby="account-email-note" required /><small id="account-email-note">Email changes are managed through account verification.</small></label><label className="settings-wide">Bio<textarea value={form.bio} maxLength="160" rows="4" onChange={(event) => update('bio', event.target.value)} /></label><label className="settings-wide">Skills / specialties <small>Separate items with commas</small><textarea value={form.skills} maxLength="1500" rows="3" onChange={(event) => update('skills', event.target.value)} placeholder="Embroidery, silk tailoring, alterations" /></label><label>Location<input value={form.location} maxLength="120" onChange={(event) => update('location', event.target.value)} placeholder="City, country" /></label>{form.is_professional && <><label>Workshop latitude<input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="e.g. 19.0760" required /></label><label>Workshop longitude<input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="e.g. 72.8777" required /></label><div className="settings-wide"><button type="button" onClick={handleLocateMe} className="dori-secondary-button"><MapPin className="w-4 h-4" /> Locate Me</button></div></>}<label>Phone number<input type="tel" value={form.phone_number} maxLength="32" onChange={(event) => update('phone_number', event.target.value)} placeholder="Optional" /></label></div>
      <label className="professional-toggle"><span><strong>Share my phone number on order requests</strong><small>Customers and their assigned tailor can see it for an active order.</small></span><input type="checkbox" checked={form.phone_visible_to_order_partners} onChange={(event) => update('phone_visible_to_order_partners', event.target.checked)} /></label>
      <label className="professional-toggle"><span><strong>Professional account</strong><small>Unlock New post and make your work discoverable.</small></span><input type="checkbox" checked={form.is_professional} onChange={(event) => update('is_professional', event.target.checked)} /></label>
      {message && <p className="settings-success"><Check className="w-4 h-4" />{message}</p>}{error && <p className="settings-error">{error}</p>}
    </section>
    <section className="settings-security lp-glass-panel">
      <span className="dori-kicker">Security</span><h2>Password</h2>
      <p>Password changes require email verification. Send a secure one-time code first, then enter it here to choose a new password.</p>
      <button type="button" onClick={requestPasswordReset} className="dori-secondary-button"><KeyRound className="w-4 h-4" /> Send verification code</button>
      <div className="settings-password-fields">
        {resetRequested && <label>Verification Code<input value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} placeholder="6-digit code" required /></label>}
        <label>New password<input type="password" minLength="6" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" /></label>
        <label>Confirm password<input type="password" minLength="6" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" /></label>
        <small>After receiving the verification email, enter the code and your new password, then save changes.</small>
      </div>
    </section>
    {profile.is_professional && <section className="mt-8 bg-gray-900/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 space-y-6 shadow-2xl">
      <div>
        <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest block mb-1">Advanced / Payments</span>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-emerald-500" /> Razorpay Checkout</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">Connect your Razorpay account so customers can pay after accepting your final order price. Credentials are encrypted by the DORI server and secret values are never shown again.</p>
      
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 rounded-full text-xs font-mono text-gray-300">
        <span className={`w-2 h-2 rounded-full ${paymentState.enabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
        {paymentState.enabled ? 'Payments Enabled' : paymentState.configured ? 'Configured · Disabled' : 'Not Configured'}
      </div>
      
      <div className="grid gap-4 max-w-xl">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Razorpay Key ID</span>
          <input 
            className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/50 focus:bg-black/80 transition-all font-mono text-sm"
            value={payment.key_id} 
            onChange={(e) => setPayment((old) => ({ ...old, key_id: e.target.value }))} 
            placeholder="rzp_test_… or rzp_live_…" 
            autoComplete="off" 
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Key Secret</span>
          <input 
            type="password" 
            className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/50 focus:bg-black/80 transition-all font-mono text-sm"
            value={payment.key_secret} 
            onChange={(e) => setPayment((old) => ({ ...old, key_secret: e.target.value }))} 
            placeholder={paymentState.has_key_secret ? 'Saved securely · enter only to replace' : 'Razorpay Key Secret'} 
            autoComplete="new-password" 
          />
        </label>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
        <button 
          type="button" 
          className="flex items-center gap-2 px-6 py-3 bg-white text-black font-extrabold text-sm rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500"
          disabled={paymentBusy || !payment.key_id.trim()} 
          onClick={savePayments}
        >
          {paymentBusy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
          Save payment settings
        </button>
        {paymentState.enabled && (
          <button 
            type="button" 
            className="px-6 py-3 bg-red-500/10 text-red-400 font-bold text-sm rounded-xl hover:bg-red-500/20 transition-colors"
            disabled={paymentBusy} 
            onClick={disablePayments}
          >
            Disable checkout
          </button>
        )}
      </div>
      
      {paymentNotice && <p className="text-emerald-400 text-sm flex items-center gap-2 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20"><Check className="w-4 h-4" />{paymentNotice}</p>}
      {paymentError && <p className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{paymentError}</p>}
    </section>}
  </form>;
}
