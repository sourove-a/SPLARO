'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import OtpInput from '../../../components/auth/OtpInput';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

type Step = 'request' | 'verify';
type ToastTone = 'success' | 'error' | 'info';

type ToastState = {
  tone: ToastTone;
  message: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveApiError(json: any, fallback: string) {
  const message = String(json?.error?.message || json?.message || json?.error?.code || '').trim();
  if (message) return message;
  return fallback;
}

function passwordStrengthLabel(value: string): { label: string; width: number; color: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;
  if (score <= 2) return { label: 'Weak', width: 24, color: 'bg-rose-400' };
  if (score === 3) return { label: 'Fair', width: 48, color: 'bg-amber-400' };
  if (score === 4) return { label: 'Good', width: 72, color: 'bg-yellow-300' };
  return { label: 'Strong', width: 100, color: 'bg-emerald-400' };
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const strength = useMemo(() => passwordStrengthLabel(newPassword), [newPassword]);

  const setToastMessage = (tone: ToastTone, message: string) => {
    setToast({ tone, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const requestResetCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setInlineError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setInlineError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(resolveApiError(json, 'Could not send reset code right now.'));
      }

      setStep('verify');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setResendIn(30);
      setToastMessage('success', 'Verification code sent. Check your email inbox.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset code.';
      setInlineError(message);
      setToastMessage('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return;
    await requestResetCode();
  };

  const handleResetAndLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setInlineError('Please enter a valid email address.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setInlineError('Enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 6) {
      setInlineError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setInlineError('New password and confirm password do not match.');
      return;
    }

    setSubmitting(true);
    setInlineError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          otp,
          password: newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(resolveApiError(json, 'Invalid or expired code.'));
      }

      const payload = json?.data || json;
      if (payload?.token) {
        localStorage.setItem('splaro-auth-token', String(payload.token));
      }
      if (payload?.user) {
        localStorage.setItem('splaro-user', JSON.stringify(payload.user));
      }

      setToastMessage('success', 'Password reset successful. Logging you in...');
      const role = String(payload?.user?.role || 'user').toLowerCase();
      const redirectTo = role === 'admin' || role === 'staff' ? '/admin_dashboard' : '/user_dashboard';
      window.setTimeout(() => {
        router.replace(redirectTo);
      }, 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid or expired code.';
      setInlineError(message);
      setToastMessage('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-10 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <AnimatePresence mode="wait">
          {step === 'request' ? (
            <motion.div
              key="request-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full"
            >
              <Card className="rounded-3xl border-[#4f4328] bg-[#0a0a0a] shadow-2xl shadow-black/60">
                <CardHeader className="space-y-3">
                  <CardTitle className="text-center text-3xl font-bold tracking-tight text-[#f8e8be]">
                    Reset Your Password
                  </CardTitle>
                  <CardDescription className="text-center text-[#cdb57d]">
                    Enter your account email to receive a 6-digit verification code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  {inlineError ? (
                    <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                      {inlineError}
                    </p>
                  ) : null}

                  <Button
                    className="h-12 w-full rounded-2xl border border-[#e8c670] bg-[#e8c670] text-[#111111] hover:bg-[#f2d992] focus-visible:ring-[#e8c670]/50"
                    onClick={requestResetCode}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Reset Code
                  </Button>

                  <Link
                    href="/auth/login"
                    className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-[#d8bd7f] transition-colors hover:text-[#f5d58b]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="verify-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full"
            >
              <Card className="rounded-3xl border border-[#f0dfb5]/45 bg-[#0a0a0a] shadow-2xl shadow-black/70">
                <CardHeader className="space-y-3">
                  <CardTitle className="text-center text-2xl font-semibold text-[#f9e9bf]">Enter Verification Code</CardTitle>
                  <CardDescription className="text-center text-[#cab17a]">
                    We sent a 6-digit code to <span className="text-[#f5d58b]">{email.trim().toLowerCase()}</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="otp-input">Verification Code</Label>
                    <OtpInput value={otp} onChange={setOtp} disabled={submitting} className="justify-center" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        disabled={submitting}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#bfa36c] transition-colors hover:text-[#f4d58d]"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label="Toggle new password visibility"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        disabled={submitting}
                        className="pr-11"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#bfa36c] transition-colors hover:text-[#f4d58d]"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-[#ceb980]">
                      <span>Password strength</span>
                      <span>{strength.label}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#1b1b1b]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.width}%` }}
                      />
                    </div>
                  </div>

                  {inlineError ? (
                    <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                      {inlineError === 'INVALID_OR_EXPIRED_CODE' ? 'Invalid or expired code.' : inlineError}
                    </p>
                  ) : null}

                  <Button
                    className="h-12 w-full rounded-2xl border border-[#e8c670] bg-[#e8c670] text-[#111111] hover:bg-[#f2d992] focus-visible:ring-[#e8c670]/50"
                    onClick={handleResetAndLogin}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Reset Password &amp; Login
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendIn > 0 || submitting}
                      className="font-medium text-[#d7bc7d] transition-colors hover:text-[#f4d58d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend Code {resendIn > 0 ? `(${resendIn}s)` : ''}
                    </button>

                    <Link href="/auth/login" className="font-medium text-[#d7bc7d] transition-colors hover:text-[#f4d58d]">
                      Back to Login
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
              toast.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                : toast.tone === 'error'
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
                  : 'border-[#e8c670]/40 bg-[#e8c670]/15 text-[#f3dfaf]'
            }`}
          >
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
