import React, { useEffect, useState } from 'react';
import { ArrowRight, Mail, Sparkles, Eye, EyeOff, KeyRound } from 'lucide-react';
import { customSignUp, customSignIn, customVerify, setCustomSession } from '../api/auth';

export default function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => {
    try {
      const p = sessionStorage.getItem('prefill_email');
      if (p) {
        sessionStorage.removeItem('prefill_email');
        return p;
      }
    } catch {}
    return '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (cooldown) {
      setError(`Please wait ${cooldown} seconds before trying again.`);
      return;
    }
    setLoading(true);
    
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        const result = await customSignUp(email, password);
        setMessage(result.message);
        setMode('verify');
      } else if (mode === 'verify') {
        const result = await customVerify(email, otp);
        setCustomSession(result.access_token, result.user);
        if (onLoginSuccess) onLoginSuccess(result.user);
        else window.location.href = '/app/';
      } else {
        const result = await customSignIn(email, password);
        setCustomSession(result.access_token, result.user);
        if (onLoginSuccess) onLoginSuccess(result.user);
        else window.location.href = '/app/';
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-transparent text-gray-100 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md lp-glass-panel rounded-2xl border border-white/20 p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl lp-glass-button flex items-center justify-center">
            <Sparkles className="w-5 h-5 " />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wider m-0">DORI</h1>
            <p className="text-[10px] tracking-widest uppercase text-gray-400 font-mono">See it. Remix it. Wear it.</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold m-0">{mode === 'signup' ? 'Create your studio profile' : mode === 'verify' ? 'Verify your email' : 'Welcome back'}</h2>
        <p className="text-sm text-gray-400 mt-2 mb-6">{mode === 'signup' ? 'Start with an account, then choose your public @username.' : mode === 'verify' ? 'Enter the OTP sent to your email.' : 'Sign in to continue to your fashion feed.'}</p>

        <form onSubmit={submit} className="space-y-3">
          {mode !== 'verify' && (
            <>
              <label htmlFor="email" className="text-xs font-semibold text-gray-300">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full lp-glass-input border border-white/20 rounded-xl pl-9 pr-3 py-3 text-sm text-gray-100 focus:border-white focus:outline-none" />
              </div>
              <label htmlFor="password" className="text-xs font-semibold text-gray-300 block pt-1">Password</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-3 pr-10 text-sm text-gray-100 focus:border-white focus:outline-none" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <label htmlFor="confirmPassword" className="text-xs font-semibold text-gray-300 block pt-1">Confirm Password</label>
              <div className="relative">
                <input id="confirmPassword" type={showPassword ? "text" : "password"} minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="At least 6 characters" className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-3 pr-10 text-sm text-gray-100 focus:border-white focus:outline-none" />
              </div>
            </>
          )}

          {mode === 'verify' && (
            <>
              <label htmlFor="otp" className="text-xs font-semibold text-gray-300">Verification Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input id="otp" type="text" required value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" className="w-full lp-glass-input border border-white/20 rounded-xl pl-9 pr-3 py-3 text-sm text-gray-100 focus:border-white focus:outline-none" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || Boolean(cooldown)} className="w-full py-3 rounded-xl lp-glass-button  font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50 transition-colors">
            {loading ? 'Working...' : cooldown ? `Try again in ${cooldown}s` : mode === 'signup' ? 'Create account' : mode === 'verify' ? 'Verify OTP' : 'Sign in'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }} className="w-full mt-3 text-xs text-gray-300 hover:text-white">{mode === 'signup' || mode === 'verify' ? 'Back to sign in' : 'New here? Create an account'}</button>

        {message && <p className="mt-4 text-sm text-green-300" role="status">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p>}
      </section>
    </main>
  );
}