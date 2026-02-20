
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Mail, Eye, EyeOff,
  Sparkles, AlertCircle, KeyRound
} from 'lucide-react';
import { useApp } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { LuxuryFloatingInput, PrimaryButton, GlassCard } from './LiquidGlass';
import { useEffect } from 'react';
import { shouldUsePhpApi } from '../lib/runtime';

type AuthMode = 'login' | 'signup' | 'forgot';

type AuthFormProps = {
  forcedMode?: 'login' | 'signup';
};

export const LoginForm: React.FC<AuthFormProps> = ({ forcedMode }) => {
  const { setUser, registerUser, syncRegistry, users } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignupPath = location.pathname.includes('signup');
  const isLoginPath = location.pathname.includes('login') || location.pathname === '/sourove-admin';
  const initialMode: AuthMode = forcedMode ?? (isSignupPath ? 'signup' : 'login');

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'reset'>('email');
  const [formData, setFormData] = useState({
    email: '',
    identifier: '',
    password: '',
    confirmPassword: '',
    otp: '',
    signupName: '',
    signupPhone: ''
  });
  const buildDisplayNameFromEmail = (email: string) => {
    const base = email.split('@')[0] || '';
    const cleaned = base
      .replace(/[0-9]/g, ' ')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return 'SPLARO Customer';

    return cleaned
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    if (forcedMode && authMode !== forcedMode) {
      setErrors({});
      setAuthMode(forcedMode);
      return;
    }

    if (!forcedMode) {
      // Keep forgot-password flow stable; only auto-switch between login/signup.
      if (isSignupPath && authMode === 'login') setAuthMode('signup');
      if (isLoginPath && authMode === 'signup') setAuthMode('login');
    }

    // Hidden Admin Entry Protocol (do not force-exit forgot mode)
    if (location.pathname === '/sourove-admin' && authMode === 'signup') {
      setAuthMode('login');
    }
    if (location.pathname === '/sourove-admin') {
      setFormData(prev => ({
        ...prev,
        identifier: prev.identifier || 'info@splaro.co'
      }));
    }
  }, [forcedMode, location.pathname, isSignupPath, isLoginPath, authMode]);


  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const floatingAssets = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        top: `${Math.random() * 88 + 6}%`,
        left: `${Math.random() * 88 + 6}%`
      })),
    []
  );
  const persistAuthToken = (token?: string) => {
    if (!token) return;
    localStorage.setItem('splaro-auth-token', token);
  };

  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = (val: string) => /^(01)[3-9]\d{8}$/.test(val);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (authMode === 'signup') {
      if (!isEmail(formData.email)) newErrors.email = "Email Identity Mandatory *";
      if (!formData.signupName.trim()) newErrors.signupName = "Name Required *";
      if (!isPhone(formData.signupPhone.trim())) newErrors.signupPhone = "Valid Number Required (01XXXXXXXXX)";
      if (formData.password.length < 6) newErrors.password = "Minimum 6 Characters";
      if (formData.confirmPassword.length < 6) newErrors.confirmPassword = "Confirm your password";
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Password mismatch";
      }
    } else {

      if (!isEmail(formData.identifier)) newErrors.identifier = "Scientific Email ID Required";
    }

    if (authMode !== 'forgot' && authMode !== 'signup') {
      if (formData.password.length < 6) newErrors.password = "Minimum 6 Characters";
    }


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setStatus('loading');

    const IS_PROD = shouldUsePhpApi();
    const API_NODE = '/api/index.php';

    if (authMode === 'login') {
      try {
        if (IS_PROD) {
          const res = await fetch(`${API_NODE}?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: formData.identifier, password: formData.password })
          });
          const result = await res.json();
          if (result.status === 'success') {
            const normalizedUser = {
              ...result.user,
              profileImage: result.user?.profile_image || result.user?.profileImage || '',
              createdAt: result.user?.created_at || result.user?.createdAt || new Date().toISOString()
            };
            persistAuthToken(result.token);
            setUser(normalizedUser);
            setStatus('success');
            setTimeout(() => navigate(normalizedUser.role === 'ADMIN' ? '/admin_dashboard' : '/'), 1000);
            return;
          }
          if (result.message === 'DATABASE_ENV_NOT_CONFIGURED' || result.message === 'DATABASE_CONNECTION_FAILED') {
            const identifier = formData.identifier.trim().toLowerCase();
            const localUser = users.find((u: any) => String(u.email || '').toLowerCase() === identifier);
            if (localUser && String((localUser as any).password || '') === formData.password) {
              setUser(localUser);
              setStatus('success');
              setTimeout(() => navigate(localUser.role === 'ADMIN' ? '/admin_dashboard' : '/'), 1000);
              return;
            }
          }
          if (result.message === 'PASSWORD_RESET_REQUIRED') {
            setErrors({ identifier: 'Password hash upgrade required. Use Forgot Password.' });
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3500);
            return;
          }
        } else {
          const identifier = formData.identifier.trim().toLowerCase();
          const localUser = users.find((u: any) => String(u.email || '').toLowerCase() === identifier);
          if (localUser && String((localUser as any).password || '') === formData.password) {
            setUser(localUser);
            setStatus('success');
            setTimeout(() => navigate(localUser.role === 'ADMIN' ? '/admin_dashboard' : '/'), 1000);
            return;
          }
        }

        throw new Error('INVALID_CREDENTIALS');
      } catch (e) {
        setErrors({ identifier: 'Invalid Credentials', password: 'Check identity or access code' });
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } else if (authMode === 'signup') {
      try {
        const normalizedEmail = formData.email.trim().toLowerCase();
        const newUser: any = {
          id: `usr_${Math.random().toString(36).substr(2, 9)}`,
          name: formData.signupName.trim() || buildDisplayNameFromEmail(normalizedEmail),
          email: normalizedEmail,
          phone: formData.signupPhone.trim(),
          password: formData.password,
          role: 'USER',
          createdAt: new Date().toISOString()
        };
        let userToStore = newUser;

        if (IS_PROD) {
          const res = await fetch(`${API_NODE}?action=signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
          });
          const result = await res.json();
          if (result.status !== 'success') throw new Error(result.message || 'SIGNUP_FAILED');
          persistAuthToken(result.token);
          if (result.user) {
            userToStore = {
              ...result.user,
              profileImage: result.user.profile_image || result.user.profileImage || '',
              createdAt: result.user.created_at || result.user.createdAt || new Date().toISOString()
            };
          }
        }

        registerUser(userToStore);
        setUser(userToStore);
        if (IS_PROD) {
          await syncRegistry();
        }
        setStatus('success');
        setTimeout(() => navigate('/'), 1000);
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        const canFallbackToLocal =
          !IS_PROD ||
          message === 'DATABASE_ENV_NOT_CONFIGURED' ||
          message === 'DATABASE_CONNECTION_FAILED';

        if (canFallbackToLocal) {
          const fallbackUser = {
            id: `usr_${Math.random().toString(36).substr(2, 9)}`,
            name: formData.signupName.trim() || buildDisplayNameFromEmail(formData.email.trim().toLowerCase()),
            email: formData.email.trim().toLowerCase(),
            phone: formData.signupPhone.trim(),
            password: formData.password,
            role: 'USER',
            createdAt: new Date().toISOString()
          };
          registerUser(fallbackUser as any);
          setUser(fallbackUser as any);
          setStatus('success');
          setTimeout(() => navigate('/'), 1000);
          return;
        }

        if (message === 'EMAIL_ALREADY_REGISTERED') {
          setErrors({ email: 'Email already registered. Please log in.' });
        } else {
          setErrors({ email: 'Identity already archived or system error' });
        }
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } else if (authMode === 'forgot') {
      if (recoveryStep === 'email') {
        try {
          const res = await fetch(`${API_NODE}?action=forgot_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.identifier })
          });
          const result = await res.json();
          if (result.status === 'success') {
            setStatus('success');
            setRecoveryStep('reset');
            const otpPreview = String(result.otp_preview || '').trim();
            const msg =
              result.message === 'RECOVERY_CODE_SENT_TO_ADMIN_TELEGRAM'
                ? 'OTP sent to admin Telegram. Use that code to reset.'
                : result.message === 'RECOVERY_CODE_GENERATED_FALLBACK'
                  ? (otpPreview ? `SMTP down. Use OTP now: ${otpPreview}` : 'SMTP down. OTP generated, contact admin.')
                  : 'OTP sent. Check your email and enter the code.';
            if (otpPreview) {
              setFormData(prev => ({ ...prev, otp: otpPreview }));
            }
            window.dispatchEvent(new CustomEvent('splaro-toast', {
              detail: { message: msg, tone: 'success' }
            }));
            setTimeout(() => setStatus('idle'), 2000);
          } else {
            throw new Error(result.message);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : '';
          if (message === 'IDENTITY_NOT_FOUND') {
            setErrors({ identifier: 'No account found with this email' });
          } else if (message === 'RATE_LIMIT_EXCEEDED') {
            setErrors({ identifier: 'Too many attempts. Try again after 1 minute' });
          } else if (message === 'RECOVERY_DELIVERY_FAILED') {
            setErrors({ identifier: 'Could not send OTP now. Contact admin support' });
          } else {
            setErrors({ identifier: 'Reset request failed. Try again' });
          }
          setStatus('error');
          setTimeout(() => setStatus('idle'), 3000);
        }
      } else {
        try {
          const res = await fetch(`${API_NODE}?action=reset_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.identifier,
              otp: formData.otp,
              password: formData.password
            })
          });
          const result = await res.json();
          if (result.status === 'success') {
            setStatus('success');
            window.dispatchEvent(new CustomEvent('splaro-toast', {
              detail: { message: 'Password updated. Please sign in.', tone: 'success' }
            }));
            setAuthMode('login');
            setRecoveryStep('email');
            setFormData(prev => ({ ...prev, otp: '', password: '', confirmPassword: '' }));
          } else {
            throw new Error(result.message);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : '';
          if (message === 'INVALID_RESET_REQUEST') {
            setErrors({ otp: 'Enter valid email, OTP and new password (min 6 chars)' });
          } else {
            setErrors({ otp: 'Invalid or expired verification code' });
          }
          setStatus('error');
          setTimeout(() => setStatus('idle'), 3000);
        }
      }
    }
  };  // Google Identity Payload Decoder
  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    try {
      setStatus('loading');
      const payload = decodeJwt(response.credential);
      if (!payload?.email || !payload?.sub) {
        throw new Error('INVALID_GOOGLE_PAYLOAD');
      }

      const normalizedEmail = String(payload.email).trim().toLowerCase();
      const googleUser = {
        id: `google_${payload.sub}`,
        name: payload.name || buildDisplayNameFromEmail(normalizedEmail),
        email: normalizedEmail,
        phone: 'N/A',
        password: 'social_auth_sync',
        google_sub: String(payload.sub),
        role: 'USER',
        createdAt: new Date().toISOString()
      };
      let userToStore: any = googleUser;

      const IS_PROD = shouldUsePhpApi();
      if (IS_PROD) {
        const res = await fetch('/api/index.php?action=signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googleUser)
        });
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message || 'GOOGLE_SIGNUP_FAILED');
        persistAuthToken(result.token);
        if (result.user) {
          userToStore = {
            ...result.user,
            profileImage: result.user.profile_image || result.user.profileImage || '',
            createdAt: result.user.created_at || result.user.createdAt || new Date().toISOString()
          };
        }
      }

      registerUser(userToStore);
      setUser(userToStore);
      if (IS_PROD) {
        await syncRegistry();
      }
      setStatus('success');
      setTimeout(() => navigate('/'), 1000);
    } catch (e) {
      setStatus('error');
      setErrors({ identifier: 'Google sign-in failed. Please try again.' });
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    // @ts-ignore
    if (window.google && googleClientId) {
      // @ts-ignore
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleSuccess,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Render official button
      // @ts-ignore
      google.accounts.id.renderButton(
        document.getElementById("googleSignInBtn"),
        { theme: "outline", size: "large", width: "100%", text: "continue_with", shape: "pill" }
      );
    }
  }, [googleClientId]);

  const getIdentityIcon = () => {
    return <Mail className="w-5 h-5 text-cyan-400" />;
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden bg-[#050505]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-blue-900/10 via-transparent to-cyan-500/10 opacity-30" />

        {/* Floating Peripheral Assets */}
        {floatingAssets.map((asset, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -28, 0],
              x: [0, 14, 0],
              rotate: [0, 120, 240],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{
              duration: 12 + i * 1.8,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute w-[160px] h-[160px] border border-cyan-500/10 rounded-full blur-sm"
            style={{
              top: asset.top,
              left: asset.left,
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
            <div className="h-10 md:h-14" />

            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-3 italic">
              {authMode === 'login' ? 'IDENTITY' : authMode === 'signup' ? 'ARCHIVING' : 'RECOVERY'}
            </h2>
            <div className="h-1 w-16 bg-cyan-500 mb-6 shadow-[0_0_20px_#00D4FF]" />
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-500 opacity-60">
              {authMode === 'login' ? 'SECURE INITIALIZATION' : authMode === 'signup' ? 'ESTABLISH ARCHIVE' : 'PROTOCOL RESTORATION'}
            </p>

            {authMode !== 'forgot' && (
              <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-xs p-1 rounded-full border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => { setErrors({}); navigate('/login'); }}
                  className={`h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setErrors({}); navigate('/signup'); }}
                  className={`h-10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-cyan-500 text-black' : 'text-white/50 hover:text-white'}`}
                >
                  Sign Up
                </button>
              </div>
            )}
          </header>




          <form onSubmit={handleAuth} className="space-y-6">
            {authMode === 'signup' ? (
              <>
                <LuxuryFloatingInput
                  label="Full Name *"
                  value={formData.signupName}
                  onChange={v => setFormData({ ...formData, signupName: v })}
                  icon={<Sparkles className="w-5 h-5" />}
                  error={errors.signupName}
                  placeholder="Your name"
                />
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
                  value={formData.signupPhone}
                  onChange={v => setFormData({ ...formData, signupPhone: v.replace(/[^\d]/g, '').slice(0, 11) })}
                  icon={<KeyRound className="w-5 h-5" />}
                  error={errors.signupPhone}
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


            {authMode === 'forgot' && recoveryStep === 'reset' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <LuxuryFloatingInput
                  label="Verification Code (OTP)"
                  value={formData.otp}
                  onChange={v => setFormData({ ...formData, otp: v })}
                  icon={<KeyRound className="w-5 h-5" />}
                  error={errors.otp}
                  placeholder="123456"
                />
                <LuxuryFloatingInput
                  label="New Institutional Password"
                  type={showPass ? 'text' : 'password'}
                  value={formData.password}
                  onChange={v => setFormData({ ...formData, password: v })}
                  icon={<Lock className="w-5 h-5" />}
                  error={errors.password}
                  placeholder="••••••••"
                  suffix={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white p-2">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </motion.div>
            )}

            {authMode !== 'forgot' && (
              <div className="relative">
                {authMode === 'signup' ? (
                  <div className="space-y-4">
                    <LuxuryFloatingInput
                      label="Password *"
                      type={showPass ? 'text' : 'password'}
                      value={formData.password}
                      onChange={v => setFormData({ ...formData, password: v })}
                      icon={<Lock className="w-5 h-5" />}
                      error={errors.password}
                      placeholder="••••••••"
                      suffix={
                        <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white p-2">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                    <LuxuryFloatingInput
                      label="Confirm Password *"
                      type={showPass ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={v => setFormData({ ...formData, confirmPassword: v })}
                      icon={<Lock className="w-5 h-5" />}
                      error={errors.confirmPassword}
                      placeholder="••••••••"
                    />
                  </div>
                ) : (
                  <LuxuryFloatingInput
                    label="Password"
                    type={showPass ? 'text' : 'password'}
                    value={formData.password}
                    onChange={v => setFormData({ ...formData, password: v })}
                    icon={<Lock className="w-5 h-5" />}
                    error={errors.password}
                    placeholder="••••••••"
                    suffix={
                      <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white p-2">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                )}

                {authMode === 'login' && (
                  <div className="flex justify-end mt-[-1rem]">
                    <button
                      type="button"
                      onClick={() => {
                        setErrors({});
                        setStatus('idle');
                        setRecoveryStep('email');
                        setAuthMode('forgot');
                      }}
                      className="text-[9px] font-black uppercase text-cyan-500/60 hover:text-cyan-400 tracking-widest transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}



            <div className="pt-4">
              <PrimaryButton
                type="submit"
                isLoading={status === 'loading'}
                className="w-full h-16 text-[11px] uppercase tracking-[0.4em]"
              >
                {authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : recoveryStep === 'email' ? 'Send OTP Code' : 'Override Password'}
                {!status.includes('loading') && <Sparkles className="w-4 h-4 ml-3" />}
              </PrimaryButton>

            </div>
          </form>

          <div className="mt-8 flex items-center gap-4 text-white/5">
            <div className="h-[1px] flex-1 bg-white/5" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">OR</span>
            <div className="h-[1px] flex-1 bg-white/5" />
          </div>

          <div className="mt-8 flex justify-center">
            {googleClientId ? (
              <div id="googleSignInBtn" className="w-full max-w-sm"></div>
            ) : (
              <div className="w-full max-w-sm h-12 rounded-full border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center justify-center">
                Google login unavailable
              </div>
            )}
          </div>

          <footer className="mt-10 text-center">
            <p className="text-xs text-white/40 font-medium">
              {authMode === 'login' ? "Don't have an account?" : "Ready to sign in?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  navigate(authMode === 'login' ? '/signup' : '/login');
                }}
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

export const SignupForm: React.FC = () => <LoginForm forcedMode="signup" />;
