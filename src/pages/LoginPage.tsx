import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";

// ─── Default Admin (fallback if no users exist) ───────────────────────────────
const DEFAULT_ADMIN = {
  username: 'chamathka',
  password: '123',
  name: 'System Administrator',
  role: 'Super Admin'
};

interface LoginPageProps {
  onLogin: (user: { name: string; role: string; username: string }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [shake,       setShake]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) return setError('Please enter your username.');
    if (!password)        return setError('Please enter your password.');

    setLoading(true);

    // Simulate auth delay for realism
    await new Promise(r => setTimeout(r, 900));

    // Get users from localStorage (created via User Management)
    const storedUsers = JSON.parse(localStorage.getItem('at_users') || '[]');
    
    // If no users exist in system, allow default admin login
    const users = storedUsers.length > 0 ? storedUsers : [DEFAULT_ADMIN];

    // Find matching user
    const user = users.find(
      (u: any) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );

    if (user) {
      // Update last login time
      if (storedUsers.length > 0) {
        const updatedUsers = storedUsers.map((u: any) => 
          u.username === user.username 
            ? { ...u, lastLogin: new Date().toISOString() }
            : u
        );
        localStorage.setItem('at_users', JSON.stringify(updatedUsers));
      }

      // Store session
      localStorage.setItem('at_user', JSON.stringify({ 
        name: user.name, 
        role: user.role, 
        username: user.username 
      }));
      
      onLogin({ name: user.name, role: user.role, username: user.username });
    } else {
      setLoading(false);
      setError('Invalid username or password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-black flex selection:bg-[#FFD700] selection:text-black overflow-hidden">

      {/* ── Left Panel — Brand ── */}
<div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 overflow-hidden">

  {/* Background Image */}
  <div
    className="absolute inset-0 bg-cover bg-center"
    style={{
      backgroundImage: "url('/images/workshop-bg.png')"
    }}
  />

  {/* Dark overlay for readability */}
  <div className="absolute inset-0 bg-black/70" />

  {/* Gradient overlay (optional – keep if you like the gold tone effect) */}
  <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/80 via-black/80 to-neutral-900/80" />

  {/* Geometric tyre tread pattern */}
  <div
    className="absolute inset-0 opacity-[0.04]"
    style={{
      backgroundImage: `repeating-linear-gradient(
        45deg,
        #FFD700 0px,
        #FFD700 2px,
        transparent 2px,
        transparent 24px
      ), repeating-linear-gradient(
        -45deg,
        #FFD700 0px,
        #FFD700 2px,
        transparent 2px,
        transparent 24px
      )`,
    }}
  />

  {/* Glowing orb */}
  <div
    className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-10"
    style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }}
  />

  {/* Content */}
  <div className="relative z-10">
    {/* Logo */}
<Link to="/" className="flex items-center gap-3">
  <img
    src={logo}
    alt="Anura Tyres Logo"
    className="h-12 w-auto object-contain"
  />


  <div className="flex flex-col leading-none">
    <span className="text-white font-bold text-lg">
      ANURA TYRES
    </span>
    <span className="text-neutral-400 text-xs tracking-wider">
      (Pvt) Ltd
    </span>
  </div>
</Link>
  </div>

  {/* Centre statement */}
  <div className="relative z-10 space-y-6">
    <div className="w-48 h-48 rounded-full border-[12px] border-[#FFD700]/20 flex items-center justify-center mb-8">
      <div className="w-32 h-32 rounded-full border-[8px] border-[#FFD700]/40 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 border-[4px] border-[#FFD700]/60" />
      </div>
    </div>

    <h1
      className="text-5xl font-black text-white leading-[1.05] tracking-tighter"
      style={{
        fontFamily: '"Bebas Neue", "Impact", "Arial Black", sans-serif',
        letterSpacing: '-1px'
      }}
    >
      MANAGE YOUR<br />
      <span className="text-[#FFD700]">WORKSHOP</span><br />
      WITH PRECISION.
    </h1>

    <p className="text-neutral-300 text-base leading-relaxed max-w-xs">
      Bookings, inventory, staff, and analytics — all in one powerful dashboard built for Anura Tyres.
    </p>
  </div>

  {/* Bottom tagline */}
  <div className="relative z-10">
    <p className="text-neutral-500 text-xs tracking-widest uppercase">
      Anura Tyres Pvt Ltd — Management System
    </p>
  </div>
</div>

      {/* ── Right Panel — Login Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">

        {/* Subtle background */}
        <div className="absolute inset-0 bg-neutral-950" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #FFD700 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Form card */}
        <div
          className={`relative z-10 w-full max-w-md transition-all duration-150 ${shake ? 'translate-x-2' : ''}`}
          style={{
            animation: shake
              ? 'shake 0.4s ease-in-out'
              : undefined,
          }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            {/* Logo */}
<Link to="/" className="flex items-center gap-3">
  <img
    src={logo}
    alt="Anura Tyres Logo"
    className="h-12 w-auto object-contain"
  />

  <div className="flex flex-col leading-none">
    <span className="text-white font-bold text-lg">
      ANURA TYRES
    </span>
    <span className="text-neutral-400 text-xs tracking-wider">
      (Pvt) Ltd
    </span>
  </div>
</Link>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tight">
              Sign In
            </h2>
            <p className="text-neutral-500 text-sm">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
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
                className="w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 pr-12 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all"
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

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#FFD700] hover:bg-[#FFD700]/90 active:bg-[#FFD700]/80 text-black font-black text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Helper text for first-time setup */}
          {JSON.parse(localStorage.getItem('at_users') || '[]').length === 0 && (
            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs text-center">
                <strong>First time?</strong> Use default credentials:<br />
                Username: <span className="font-mono">admin</span> | Password: <span className="font-mono">admin123</span>
              </p>
            </div>
          )}

          <p className="text-center text-neutral-700 text-xs mt-6">
            © {new Date().getFullYear()} Anura Tyres Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}