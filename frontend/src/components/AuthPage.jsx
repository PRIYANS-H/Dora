import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { customConfirmReset, customRequestReset, customSignIn, customSignUp, customVerify, lookupEmail, setCustomSession } from '../api/auth';
import { DoriWordmark } from './DoriLogo';
import Spinner from './Spinner';

const HERO_VIDEO = 'https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/designs/video-1.mp4';
export const HANDOFF_KEY = 'dori:auth-email';
const RESEND_SECONDS = 30;

// The landing page's stage — same hero frame, header and glass — so signing in
// reads as the landing's "Join DORI" modal continuing rather than a new page.
export function AuthStage({ children }) {
  const [videoReady, setVideoReady] = useState(false);
  return (
    <div className="auth-stage">
      <div className="ambient" aria-hidden="true" />
      <video className={`auth-stage-media ${videoReady ? 'is-ready' : ''}`} src={HERO_VIDEO} muted playsInline preload="auto" aria-hidden="true" onLoadedData={() => setVideoReady(true)} />
      <div className="auth-stage-shade" aria-hidden="true" />
      <header className="auth-stage-header">
        <a href="/" className="auth-stage-logo" aria-label="DORI home"><DoriWordmark /></a>
        <div className="auth-stage-meta"><span className="kicker">Fashion OS v2</span><span className="auth-stage-sub">Discover. Remix. Wear.</span></div>
        <a href="/" className="btn auth-stage-home">Home</a>
      </header>
      {children}
    </div>
  );
}

function CodeInput({ value, onChange, disabled }) {
  return (
    <label className="otp">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        disabled={disabled}
        aria-label="6-digit verification code"
      />
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className={`otp-box ${value[index] ? 'is-filled' : ''} ${index === Math.min(value.length, 5) ? 'is-caret' : ''}`}>{value[index] || ''}</span>
      ))}
    </label>
  );
}

const COPY = {
  email: ['Join DORI', 'Discover. Remix. Wear.'],
  signin: ['Welcome back', 'Enter your password to continue.'],
  signup: ['Create your account', 'Choose a password — we’ll email you a code to confirm it’s you.'],
  verify: ['Check your inbox', 'Enter the 6-digit code we sent to'],
  forgot: ['Reset your password', 'Enter the code we emailed you and choose a new password.'],
};

export default function AuthPage({ onLoginSuccess }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(() => {
    try { return window.sessionStorage.getItem(HANDOFF_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountKnown, setAccountKnown] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoContinued = useRef(false);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const finish = (result) => {
    try { window.sessionStorage.removeItem(HANDOFF_KEY); } catch { /* storage unavailable */ }
    setCustomSession(result.access_token, result.user);
    onLoginSuccess?.(result.user);
  };

  const go = (next, message = '') => { setStep(next); setError(''); setInfo(message); };

  const startSignup = async (fromUnknown = false) => {
    await customSignUp(email.trim(), password);
    setCode(''); setCooldown(RESEND_SECONDS);
    go('verify', fromUnknown ? 'New to DORI — confirming this email creates your account.' : '');
  };

  const continueWithEmail = async (event) => {
    event?.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError('');
    const account = await lookupEmail(address);
    setBusy(false);
    setPassword('');
    if (!account) { setAccountKnown(false); go('signin'); return; }
    setAccountKnown(true);
    go(account.exists && account.verified ? 'signin' : 'signup');
  };

  // Arriving from the landing modal with an email already typed: skip straight past it.
  useEffect(() => {
    if (autoContinued.current || !email) return;
    autoContinued.current = true;
    continueWithEmail();
  }, []);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      finish(await customSignIn(email.trim(), password));
    } catch (cause) {
      const message = cause.message || '';
      try {
        if (/verify your email/i.test(message)) await startSignup();
        else if (/invalid credentials/i.test(message) && !accountKnown) {
          try { await startSignup(true); }
          catch (signupError) { setError(/already exists/i.test(signupError.message) ? 'That password doesn’t match this account.' : signupError.message); }
        } else setError(/invalid credentials/i.test(message) ? 'That password doesn’t match this account.' : message);
      } catch (followUp) { setError(followUp.message); }
    } finally { setBusy(false); }
  };

  const signUp = async (event) => {
    event.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true); setError('');
    try { await startSignup(); }
    catch (cause) {
      if (/already exists/i.test(cause.message)) go('signin', 'You already have an account — sign in instead.');
      else setError(cause.message);
    } finally { setBusy(false); }
  };

  const verify = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError('');
    try { finish(await customVerify(email.trim(), value)); }
    catch (cause) { setError(cause.message === 'Invalid OTP' ? 'That code isn’t right. Check the latest email and try again.' : cause.message); setCode(''); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    if (cooldown) return;
    setBusy(true); setError('');
    try {
      if (step === 'forgot') await customRequestReset(email.trim());
      else await customSignUp(email.trim(), password);
      setCooldown(RESEND_SECONDS); setInfo('A fresh code is on its way.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const startReset = async () => {
    setBusy(true); setError('');
    try { await customRequestReset(email.trim()); setCode(''); setNewPassword(''); setCooldown(RESEND_SECONDS); go('forgot'); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const confirmReset = async (event) => {
    event.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    if (newPassword.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true); setError('');
    try {
      await customConfirmReset(email.trim(), code, newPassword);
      finish(await customSignIn(email.trim(), newPassword));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const [title, subtitle] = step === 'signin' && !accountKnown
    ? ['Enter a password', 'Returning? Use your password. New here? Choose one and we’ll set you up.']
    : COPY[step];
  const emailChip = (
    <button type="button" className="auth-email-chip" onClick={() => go('email')}>
      <Mail /><span>{email.trim()}</span><em>Change</em>
    </button>
  );
  const passwordField = (value, setValue, { autoComplete, placeholder, label, autoFocus = true }) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="auth-password">
        <input className="input" type={showPassword ? 'text' : 'password'} value={value} onChange={(event) => setValue(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={72} required autoFocus={autoFocus} />
        <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
      </span>
    </label>
  );

  return (
    <AuthStage>
      <main className="auth-center">
        <section className="auth-card glass" aria-labelledby="auth-title">
          {step !== 'email' && <button type="button" className="auth-back" onClick={() => go(step === 'forgot' ? 'signin' : 'email')} aria-label="Back"><ArrowLeft /></button>}
          <div key={step} className="auth-step">
            <h1 id="auth-title" className="auth-title">{title}</h1>
            <p className="auth-subtitle">{subtitle}{step === 'verify' && <> <strong>{email.trim()}</strong></>}</p>

            {step === 'email' && (
              <form onSubmit={continueWithEmail} className="auth-form">
                <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" autoComplete="email" required autoFocus aria-label="Email address" />
                <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy}>{busy ? <Spinner size="sm" /> : <>Continue <ArrowRight /></>}</button>
                <p className="auth-footnote">New or returning, it’s the same door — we’ll sign you in or set you up.</p>
              </form>
            )}

            {step === 'signin' && (
              <form onSubmit={signIn} className="auth-form">
                {emailChip}
                {passwordField(password, setPassword, { autoComplete: 'current-password', placeholder: 'Your password', label: 'Password' })}
                <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy || !password}>{busy ? <Spinner size="sm" /> : <>{accountKnown ? 'Sign in' : 'Continue'} <ArrowRight /></>}</button>
                <button type="button" className="auth-link" onClick={startReset} disabled={busy}>Forgot password?</button>
              </form>
            )}

            {step === 'signup' && (
              <form onSubmit={signUp} className="auth-form">
                {emailChip}
                {passwordField(password, setPassword, { autoComplete: 'new-password', placeholder: 'At least 8 characters', label: 'Choose a password' })}
                <div className="auth-strength" aria-hidden="true"><i style={{ width: `${Math.min(100, (password.length / 12) * 100)}%` }} className={password.length >= 8 ? 'is-ok' : ''} /></div>
                <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy || password.length < 8}>{busy ? <Spinner size="sm" /> : <>Create account <ArrowRight /></>}</button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={(event) => { event.preventDefault(); verify(); }} className="auth-form">
                <CodeInput value={code} disabled={busy} onChange={(value) => { setCode(value); if (value.length === 6) verify(value); }} />
                <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy || code.length !== 6}>{busy ? <Spinner size="sm" /> : <>Verify and enter <ArrowRight /></>}</button>
                <button type="button" className="auth-link" onClick={resend} disabled={busy || cooldown > 0}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
              </form>
            )}

            {step === 'forgot' && (
              <form onSubmit={confirmReset} className="auth-form">
                {emailChip}
                <CodeInput value={code} disabled={busy} onChange={setCode} />
                {passwordField(newPassword, setNewPassword, { autoComplete: 'new-password', placeholder: 'At least 8 characters', label: 'New password', autoFocus: false })}
                <button type="submit" className="btn btn-solid btn-lg btn-block" disabled={busy}>{busy ? <Spinner size="sm" /> : <>Save and sign in <ArrowRight /></>}</button>
                <button type="button" className="auth-link" onClick={resend} disabled={busy || cooldown > 0}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
              </form>
            )}

            {info && !error && <p className="auth-info" role="status">{info}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
          </div>
        </section>
      </main>
    </AuthStage>
  );
}
