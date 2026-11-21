import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { validateEmail } from '../utils/authValidation';

interface LoginForm {
  email: string;
  password: string;
}

function getSafeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = useMemo(
    () => getSafeRedirect(searchParams.get('redirect')),
    [searchParams]
  );
  const prefilledEmail = searchParams.get('email') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: prefilledEmail,
      password: '',
    },
  });

  const emailField = register('email', {
    validate: (val) => validateEmail(val) || true,
  });

  const passwordField = register('password', {
    required: 'Password is required.',
  });

  const onSubmit = async (values: LoginForm) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setServerError('');
      await login(values.email.trim(), values.password, rememberMe);
      toast.success('Signed in to Trackly');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to sign in right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registerHref =
    redirectPath !== '/'
      ? `/register?redirect=${encodeURIComponent(redirectPath)}`
      : '/register';

  return (
    <AuthShell mode="login">
      <div>
        <div className="mb-7">
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Sign in
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
            Welcome back. Enter your email and password to open your workspace.
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 px-3.5 py-2.5 rounded-md border border-[#B3473B]/35 bg-[#FBEAE8] dark:bg-[#361E1C] text-[12.5px] text-[#B3473B] dark:text-[#EB8B80]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus={!prefilledEmail}
              placeholder="name@company.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...emailField}
              onChange={(e) => {
                emailField.onChange(e);
                if (serverError) setServerError('');
              }}
              className={`w-full h-10 px-3 text-[13.5px] rounded-md border bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#A19D95] dark:placeholder:text-[#6B6964] transition-all duration-150 focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-[#B3473B] focus:border-[#B3473B] focus:ring-[#B3473B]/15'
                  : 'border-[#DCD9D0] dark:border-[#34322E] hover:border-[#C5C0B6] dark:hover:border-[#494640] focus:border-[#C56A45] focus:ring-[#C56A45]/15'
              }`}
            />
            {errors.email && (
              <p className="mt-1.5 text-[12px] text-[#B3473B] dark:text-[#EB8B80]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus={Boolean(prefilledEmail)}
                placeholder="Enter your password"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...passwordField}
                onChange={(e) => {
                  passwordField.onChange(e);
                  if (serverError) setServerError('');
                }}
                className={`w-full h-10 pl-3 pr-10 text-[13.5px] rounded-md border bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#A19D95] dark:placeholder:text-[#6B6964] transition-all duration-150 focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-[#B3473B] focus:border-[#B3473B] focus:ring-[#B3473B]/15'
                    : 'border-[#DCD9D0] dark:border-[#34322E] hover:border-[#C5C0B6] dark:hover:border-[#494640] focus:border-[#C56A45] focus:ring-[#C56A45]/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#8C8983] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] transition-colors focus:outline-none focus:text-[#C56A45]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-[12px] text-[#B3473B] dark:text-[#EB8B80]">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="pt-0.5 flex items-center justify-between">
            <label
              htmlFor="login-remember"
              className="inline-flex items-center gap-2 cursor-pointer select-none group"
            >
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border border-[#DCD9D0] dark:border-[#3A3835] accent-[#C56A45] cursor-pointer"
              />
              <span className="text-[12.5px] text-[#6B6964] dark:text-[#A8A49B] group-hover:text-[#1F1F1E] dark:group-hover:text-[#F3F0EE] transition-colors">
                Remember me on this browser
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 mt-1 text-[13.5px] font-medium rounded-md bg-[#C56A45] hover:bg-[#B05B38] active:bg-[#9D4E2E] text-white transition-colors duration-150 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="relative my-6">
          <div className="border-t border-[#E4E2DC] dark:border-[#2E2D2A]" />
        </div>

        <p className="text-center text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
          New to Trackly?{' '}
          <Link
            to={registerHref}
            className="font-medium text-[#C56A45] hover:text-[#B05B38] hover:underline transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
