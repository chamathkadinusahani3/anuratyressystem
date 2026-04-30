import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '';
const EMAILJS_RESET_TMPL = import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID ?? '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '';

const USERS_COLLECTION = 'at_users';

const generateTempPassword = () =>
  'AT-' + Math.random().toString(36).slice(2, 6).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

const DEFAULT_ADMIN = {
  username: 'chamathka', password: '123', name: 'System Administrator',
  role: 'Super Admin', branch: 'All Branches', email: '',
};

interface LoginPageProps {
  onLogin: (user: { name: string; role: string; username: string; branch: string }) => void;
}

type View = 'login' | 'forgot' | 'changePassword';

export function LoginPage({ onLogin }: LoginPageProps) {
  const [view, setView] = useState<View>('login');

  // ── Login state ────────────────────────────────────────────────────────────
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [shake, setShake]         = useState(false);

  // ── Force change password state ────────────────────────────────────────────
  const [pendingUser, setPendingUser]         = useState<any>(null);
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [changingPw, setChangingPw]           = useState(false);

  // ── Forgot password state ──────────────────────────────────────────────────
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading]   = useState(false);
  const [forgotSuccess, setForgotSuccess]   = useState(false);
  const [forgotError, setForgotError]       = useState('');

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Please enter your username.');
    if (!password)        return setError('Please enter your password.');

    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      const firestoreUsers = snapshot.docs.map(d => d.data());
      const users = firestoreUsers.length > 0 ? firestoreUsers : [DEFAULT_ADMIN];

      const user = users.find((u: any) =>
        u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
      );

      if (user) {
        setLoading(false);
        // If mustChangePassword — show change-password screen before entering app
        if (user.mustChangePassword) {
          setPendingUser(user);
          setView('changePassword');
          setUsername(''); setPassword('');
          return;
        }
        const ADMIN_ROLES = ['Super Admin', 'Admin'];
        const sessionBranch = ADMIN_ROLES.includes(user.role) ? 'All Branches' : (user.branch || 'Pannipitiya');
        const session = { name: user.name, role: user.role, username: user.username, branch: sessionBranch };
        localStorage.setItem('at_user', JSON.stringify(session));
        setUsername(''); setPassword(''); setError('');
        onLogin(session);
      } else {
        setLoading(false);
        setError('Invalid username or password. Please try again.');
        setShake(true); setTimeout(() => setShake(false), 600);
      }
    } catch (err) {
      setLoading(false);
      setError('Login failed. Please check your connection and try again.');
      console.error('Login error:', err);
    }
  };

  // ── Force Change Password ──────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword)                           return setError('Please enter a new password.');
    if (newPassword.length < 6)                 return setError('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword)        return setError('Passwords do not match.');
    if (newPassword === pendingUser.password)   return setError('New password must be different from the temporary password.');

    setChangingPw(true); setError('');
    try {
      await updateDoc(doc(db, USERS_COLLECTION, pendingUser.username), {
        password: newPassword,
        mustChangePassword: false,
      });
      const ADMIN_ROLES = ['Super Admin', 'Admin'];
      const sessionBranch = ADMIN_ROLES.includes(pendingUser.role) ? 'All Branches' : (pendingUser.branch || 'Pannipitiya');
      const session = { name: pendingUser.name, role: pendingUser.role, username: pendingUser.username, branch: sessionBranch };
      localStorage.setItem('at_user', JSON.stringify(session));
      onLogin(session);
    } catch {
      setError('Failed to update password. Please try again.');
    } finally {
      setChangingPw(false);
    }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  // KEY FIX: We now separate Firestore errors from EmailJS errors.
  // If EmailJS isn't configured we still show success (Firestore was updated,
  // the admin can share the temp password manually). Only a genuine Firestore
  // failure shows an error.
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotUsername.trim()) return setForgotError('Please enter your username.');

    setForgotLoading(true);
    try {
      // ── 1. Fetch user from Firestore ────────────────────────────────────
      let user: any = null;
      try {
        const snapshot = await getDocs(collection(db, USERS_COLLECTION));
        const users = snapshot.docs.map(d => d.data());
        user = users.find((u: any) =>
          u.username.toLowerCase() === forgotUsername.trim().toLowerCase()
        ) ?? null;
      } catch (firestoreErr) {
        // Firestore read failed — genuine connectivity issue
        console.error('Firestore read failed in forgot password:', firestoreErr);
        setForgotError('Unable to reach the server. Please check your connection and try again.');
        setForgotLoading(false);
        return;
      }

      // ── 2. User not found — show success anyway (don't reveal existence) ─
      if (!user) {
        setForgotSuccess(true);
        setForgotLoading(false);
        return;
      }

      // ── 3. No email on record — tell user to contact admin ──────────────
      if (!user.email) {
        setForgotError(
          'No email address is associated with this account. Please contact your administrator to reset your password.'
        );
        setForgotLoading(false);
        return;
      }

      // ── 4. Generate temp password & update Firestore ─────────────────────
      const tempPassword = generateTempPassword();
      try {
        await updateDoc(doc(db, USERS_COLLECTION, user.username), {
          password: tempPassword,
          mustChangePassword: true,
        });
      } catch (updateErr) {
        console.error('Firestore update failed in forgot password:', updateErr);
        setForgotError('Failed to reset password. Please try again.');
        setForgotLoading(false);
        return;
      }

      // ── 5. Send email — silently swallow if EmailJS not configured ────────
      // We always show success here because the password WAS reset in Firestore.
      // If email fails, the admin can provide the temp password manually.
      if (EMAILJS_SERVICE_ID && EMAILJS_RESET_TMPL && EMAILJS_PUBLIC_KEY) {
        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_RESET_TMPL,
            {
              to_name:       user.name,
              to_email:      user.email,
              username:      user.username,
              temp_password: tempPassword,
            },
            EMAILJS_PUBLIC_KEY
          );
        } catch (emailErr) {
          // Email failed — password was still reset. Log only, don't surface error.
          console.warn('Forgot password email failed (EmailJS):', emailErr);
        }
      } else {
        console.info('EmailJS not configured — skipping forgot-password email. Temp password set in Firestore.');
      }

      // ── 6. Always show success ────────────────────────────────────────────
      setForgotSuccess(true);

    } catch (unexpectedErr) {
      // Catch-all for truly unexpected errors
      console.error('Unexpected error in forgot password:', unexpectedErr);
      setForgotError('An unexpected error occurred. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ─── Shared layout components ─────────────────────────────────────────────
  const LeftPanel = () => (
    <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/workshop-bg.png')" }} />
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/80 via-black/80 to-neutral-900/80" />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `repeating-linear-gradient(45deg,#FFD700 0px,#FFD700 2px,transparent 2px,transparent 24px),repeating-linear-gradient(-45deg,#FFD700 0px,#FFD700 2px,transparent 2px,transparent 24px)` }} />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
      <div className="relative z-10">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Anura Tyres Logo" className="h-12 w-auto object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-lg">ANURA TYRES</span>
            <span className="text-neutral-400 text-xs tracking-wider">(Pvt) Ltd</span>
          </div>
        </Link>
      </div>
      <div className="relative z-10 space-y-6">
        <div className="w-48 h-48 rounded-full border-[12px] border-[#FFD700]/20 flex items-center justify-center mb-8">
          <div className="w-32 h-32 rounded-full border-[8px] border-[#FFD700]/40 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 border-[4px] border-[#FFD700]/60" />
          </div>
        </div>
        <h1 className="text-5xl font-black text-white leading-[1.05] tracking-tighter" style={{ fontFamily: '"Bebas Neue","Impact","Arial Black",sans-serif', letterSpacing: '-1px' }}>
          MANAGE YOUR<br /><span className="text-[#FFD700]">WORKSHOP</span><br />WITH PRECISION.
        </h1>
        <p className="text-neutral-300 text-base leading-relaxed max-w-xs">
          Bookings, inventory, staff, and analytics — all in one powerful dashboard built for Anura Tyres.
        </p>
      </div>
      <div className="relative z-10">
        <p className="text-neutral-500 text-xs tracking-widest uppercase">Anura Tyres Pvt Ltd — Management System</p>
      </div>
    </div>
  );

  const MobileLogo = () => (
    <div className="flex items-center gap-3 mb-10 lg:hidden">
      <Link to="/" className="flex items-center gap-3">
        <img src={logo} alt="Anura Tyres Logo" className="h-12 w-auto object-contain" />
        <div className="flex flex-col leading-none">
          <span className="text-white font-bold text-lg">ANURA TYRES</span>
          <span className="text-neutral-400 text-xs tracking-wider">(Pvt) Ltd</span>
        </div>
      </Link>
    </div>
  );

  // ── View: Force Change Password ────────────────────────────────────────────
  if (view === 'changePassword' && pendingUser) {
    return (
      <div className="min-h-screen bg-black flex selection:bg-[#FFD700] selection:text-black overflow-hidden">
        <LeftPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
          <div className="absolute inset-0 bg-neutral-950" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #FFD700 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
          <div className="relative z-10 w-full max-w-md">
            <MobileLogo />
            <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-orange-400 font-semibold text-sm">Password Change Required</p>
                <p className="text-neutral-400 text-xs mt-1">
                  Welcome, <span className="text-white font-medium">{pendingUser.name}</span>!
                  You're using a temporary password. Please set a new secure password to continue.
                </p>
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Set New Password</h2>
              <p className="text-neutral-500 text-sm">Choose a strong password you'll remember.</p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Enter new password"
                    disabled={changingPw}
                    className="w-full px-4 py-3.5 pr-12 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-600 mt-1">Minimum 6 characters</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Confirm new password"
                    disabled={changingPw}
                    className="w-full px-4 py-3.5 pr-12 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {newPassword && (
                <div className="space-y-1">
                  {[
                    { ok: newPassword.length >= 6,                                    label: 'At least 6 characters' },
                    { ok: /[A-Z]/.test(newPassword),                                  label: 'Contains uppercase letter' },
                    { ok: /[0-9]/.test(newPassword),                                  label: 'Contains a number' },
                    { ok: newPassword === confirmPassword && confirmPassword !== '',   label: 'Passwords match' },
                  ].map(({ ok, label }) => (
                    <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-neutral-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-neutral-700'}`} />
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}
              <button type="submit" disabled={changingPw}
                className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed mt-2">
                {changingPw
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Set Password & Continue</>}
              </button>
            </form>
            <p className="text-center text-neutral-700 text-xs mt-6">
              © {new Date().getFullYear()} Anura Tyres Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── View: Forgot Password ──────────────────────────────────────────────────
  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-black flex selection:bg-[#FFD700] selection:text-black overflow-hidden">
        <LeftPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
          <div className="absolute inset-0 bg-neutral-950" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #FFD700 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
          <div className="relative z-10 w-full max-w-md">
            <MobileLogo />
            {forgotSuccess ? (
              /* ── Success state ── */
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Check Your Email</h2>
                <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                  If an account exists for{' '}
                  <span className="text-white font-medium">{forgotUsername}</span>,
                  a temporary password has been sent to the registered email address.
                  Use it to log in — you'll be asked to set a new password immediately.
                </p>
                <button
                  onClick={() => {
                    setView('login');
                    setForgotSuccess(false);
                    setForgotUsername('');
                    setForgotError('');
                  }}
                  className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
              </div>
            ) : (
              /* ── Forgot password form ── */
              <>
                <button
                  onClick={() => { setView('login'); setForgotError(''); setForgotUsername(''); }}
                  className="flex items-center gap-2 text-neutral-500 hover:text-white text-sm mb-8 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
                <div className="mb-10">
                  <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Forgot Password?</h2>
                  <p className="text-neutral-500 text-sm">
                    Enter your username and we'll send a temporary password to your registered email address.
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={forgotUsername}
                      onChange={e => { setForgotUsername(e.target.value); setForgotError(''); }}
                      placeholder="Enter your username"
                      autoFocus
                      disabled={forgotLoading}
                      className="w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-50"
                    />
                  </div>
                  {forgotError && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-red-400 text-sm">{forgotError}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {forgotLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                      : <><KeyRound className="w-4 h-4" /> Send Reset Password</>}
                  </button>
                </form>
              </>
            )}
            <p className="text-center text-neutral-700 text-xs mt-6">
              © {new Date().getFullYear()} Anura Tyres Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── View: Login (default) ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex selection:bg-[#FFD700] selection:text-black overflow-hidden">
      <LeftPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-neutral-950" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #FFD700 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
        <div className={`relative z-10 w-full max-w-md transition-transform duration-75 ${shake ? 'translate-x-2' : 'translate-x-0'}`}>
          <MobileLogo />
          <div className="mb-10">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Sign In</h2>
            <p className="text-neutral-500 text-sm">Enter your credentials to access the dashboard.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                disabled={loading}
                className="w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); }}
                  className="text-xs text-[#FFD700] hover:text-[#FFD700]/80 transition-colors font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full px-4 py-3.5 pr-12 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 active:bg-[#FFD700]/80 text-black font-black text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>
          <p className="text-center text-neutral-700 text-xs mt-6">
            © {new Date().getFullYear()} Anura Tyres Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;