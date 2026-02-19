
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Mail, Eye, EyeOff,
  Sparkles, AlertCircle, KeyRound,
  Smartphone, Globe
} from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { LuxuryFloatingInput, PrimaryButton, GlassCard, SocialButton } from './LiquidGlass';
import { SplaroLogo } from './Navbar';
import { useEffect } from 'react';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export const LoginForm: React.FC = () => {
  const { setUser, setView } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignupPath = location.pathname.includes('signup');

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>(isSignupPath ? 'signup' : 'login');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', identifier: '', password: '', confirmPassword: '' });

  useEffect(() => {
    if (isSignupPath && authMode !== 'signup') setAuthMode('signup');
    if (!isSignupPath && location.pathname.includes('login') && authMode !== 'login') setAuthMode('login');

    // Hidden Admin Entry Protocol
    if (location.pathname === '/sourove-admin') {
      setAuthMode('login');
      setFormData(prev => ({ ...prev, identifier: 'admin@splaro.co' }));
    }
  }, [location.pathname, isSignupPath]);


  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isBDPhone = (val: string) => /^(01)[3-9]\d{8}$/.test(val);

  const validateIdentifier = (val: string) => isEmail(val) || isBDPhone(val);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (authMode === 'signup') {
      if (!formData.name.trim()) newErrors.name = "Full Name Mandatory *";
      if (!isEmail(formData.email)) newErrors.email = "Email Identity Mandatory *";
      if (!isBDPhone(formData.phone)) newErrors.phone = "Phone Coordinate Mandatory *";
    } else {

      if (!isEmail(formData.identifier)) newErrors.identifier = "Scientific Email ID Required";
    }


    if (authMode !== 'forgot') {
      if (formData.password.length < 6) newErrors.password = "Minimum 6 Characters";
      if (authMode === 'signup' && formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Mismatch";
    }


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setStatus('loading');
    await new Promise(r => setTimeout(r, 1500));

    const savedUsers = JSON.parse(localStorage.getItem('splaro-registered-users') || '[]');

    if (authMode === 'forgot') {
      const existingUser = savedUsers.find((u: any) => u.identifier === formData.identifier);
      if (existingUser || formData.identifier === 'admin@splaro.co') {
        alert(`ARCHIVE PROTOCOL: Recovery instructions sent to ${formData.identifier} via Hostinger SMTP.`);
        setAuthMode('login');
        setStatus('idle');
      } else {
        setErrors({ identifier: 'Identity not found in archive registry' });
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
      return;
    }

    if (authMode === 'login') {
      const existingUser = savedUsers.find((u: any) => u.identifier === formData.identifier && u.password === formData.password);
      // Admin Authentication Manifest
      const isAdmin = (formData.identifier === 'admin@splaro.co' && (formData.password === 'ADMIN_SPLARO_2026' || formData.password === 'Sourove017@'));

      if (existingUser || isAdmin) {

        const userToSet = existingUser || {
          id: 'admin',
          name: 'Chief Admin',
          email: 'admin@splaro.co',
          phone: '01700000000',
          role: 'ADMIN',
          createdAt: new Date().toISOString()
        };
        setUser(userToSet);
        setStatus('success');

        setTimeout(() => navigate(userToSet.role === 'ADMIN' ? '/admin_dashboard' : '/'), 1000);
      } else {
        setErrors({ identifier: 'Invalid Credentials', password: 'Check identity or access code' });
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } else {
      // Signup Logic
      const updatedIdentifier = formData.email || formData.phone;
      const userExists = savedUsers.some((u: any) => u.identifier === updatedIdentifier);
      if (userExists) {
        setErrors({ identifier: 'Identity already archived' });
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        const newUser = {
          id: Math.random().toString(36).substr(2, 9),
          name: formData.name,
          identifier: updatedIdentifier,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'USER',
          createdAt: new Date().toISOString()
        };
        const updatedUsers = [...savedUsers, newUser];
        localStorage.setItem('splaro-registered-users', JSON.stringify(updatedUsers));
        setUser(newUser);
        setStatus('success');
        setTimeout(() => navigate('/'), 1000);
      }
    }
  };




  const getIdentityIcon = () => {
    return <Mail className="w-5 h-5 text-cyan-400" />;
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden bg-[#050505]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-blue-900/10 via-transparent to-cyan-500/10 opacity-30" />

        {/* Floating Peripheral Assets */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
              rotate: [0, 180, 360],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute w-[200px] h-[200px] border border-cyan-500/10 rounded-full blur-sm"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}

        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[180px]"
        />
        <div className="ribbed-texture absolute inset-0 opacity-[0.02]" />
      </div>

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[480px] z-10"
      >
        <GlassCard className="p-8 md:p-12 !border-white/10 !bg-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] !rounded-[48px] backdrop-blur-[120px] relative overflow-hidden group">
          {/* Subtle cyan glow around the card */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 opacity-50 pointer-events-none" />

          <header className="flex flex-col items-center text-center mb-12 relative z-10 pt-4">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-8"
            >
              <SplaroLogo className="h-14 md:h-18" />
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-3 italic">
              {authMode === 'login' ? 'IDENTITY' : authMode === 'signup' ? 'ARCHIVING' : 'RECOVERY'}
            </h2>
            <div className="h-1 w-16 bg-cyan-500 mb-6 shadow-[0_0_20px_#00D4FF]" />
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-500 opacity-60">
              {authMode === 'login' ? 'SECURE INITIALIZATION' : authMode === 'signup' ? 'ESTABLISH ARCHIVE' : 'PROTOCOL RESTORATION'}
            </p>
          </header>




          <form onSubmit={handleAuth} className="space-y-6">
            <AnimatePresence mode="popLayout">
              {authMode === 'signup' && (

                <motion.div
                  key="name"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <LuxuryFloatingInput
                    label="Full Name *"
                    value={formData.name}
                    onChange={v => setFormData({ ...formData, name: v })}
                    icon={<User className="w-5 h-5" />}
                    error={errors.name}
                    placeholder="Enter your name"
                  />
                </motion.div>

              )}
            </AnimatePresence>

            {authMode === 'signup' ? (
              <>
                <LuxuryFloatingInput
                  label="Email Address *"
                  value={formData.email}
                  onChange={v => setFormData({ ...formData, email: v })}
                  icon={<Mail className="w-5 h-5" />}
                  error={errors.email}
                  placeholder="name@email.com"
                />
                <LuxuryFloatingInput
                  label="Phone Number *"
                  value={formData.phone}
                  onChange={v => setFormData({ ...formData, phone: v })}
                  icon={<Smartphone className="w-5 h-5" />}
                  error={errors.phone}
                  placeholder="01XXXXXXXXX"
                />

              </>
            ) : (
              <LuxuryFloatingInput
                label="Scientific Email ID"
                value={formData.identifier}
                onChange={v => setFormData({ ...formData, identifier: v })}
                icon={getIdentityIcon()}
                error={errors.identifier}
                isValid={isEmail(formData.identifier)}
                placeholder="name@email.com"
              />
            )}


            {authMode !== 'forgot' && (
              <div className="relative">
                <LuxuryFloatingInput
                  label={authMode === 'signup' ? "Password *" : "Password"}
                  type={showPass ? 'text' : 'password'}
                  value={formData.password}
                  onChange={v => setFormData({ ...formData, password: v })}
                  icon={<Lock className="w-5 h-5" />}
                  error={errors.password}
                  placeholder="••••••••"
                  suffix={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="text-zinc-600 hover:text-white p-2">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                {authMode === 'login' && (
                  <div className="flex justify-end mt-[-1rem]">
                    <button type="button" onClick={() => setAuthMode('forgot')} className="text-[9px] font-black uppercase text-cyan-500/60 hover:text-cyan-400 tracking-widest transition-colors">
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}


            {authMode === 'signup' && (
              <LuxuryFloatingInput
                label="Confirm Password *"
                type="password"
                value={formData.confirmPassword}
                onChange={v => setFormData({ ...formData, confirmPassword: v })}
                icon={<Lock className="w-5 h-5" />}
                error={errors.confirmPassword}
                placeholder="••••••••"
              />
            )}



            <div className="pt-4">
              <PrimaryButton
                type="submit"
                isLoading={status === 'loading'}
                className="w-full h-16 text-[11px] uppercase tracking-[0.4em]"
              >
                {authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                {!status.includes('loading') && <Sparkles className="w-4 h-4 ml-3" />}
              </PrimaryButton>

            </div>
          </form>

          <div className="mt-8 flex items-center gap-4 text-zinc-800">
            <div className="h-[1px] flex-1 bg-white/5" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">OR</span>
            <div className="h-[1px] flex-1 bg-white/5" />
          </div>

          <div className="mt-8">
            <SocialButton
              icon={<GoogleIcon />}
              label="Continue with Google"
              onClick={() => { }}
            />
          </div>

          <footer className="mt-10 text-center">
            <p className="text-xs text-zinc-500 font-medium">
              {authMode === 'login' ? "Don't have an account?" : "Ready to sign in?"}{' '}
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setErrors({}); }}
                className="text-cyan-500 font-black uppercase tracking-widest text-[10px] ml-2 hover:underline"
              >
                {authMode === 'login' ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </footer>

        </GlassCard>

        <AnimatePresence>
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-4"
            >
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <p className="text-[9px] font-black uppercase text-rose-500 tracking-widest">Please correct the errors above</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export const SignupForm: React.FC = () => <LoginForm />;
