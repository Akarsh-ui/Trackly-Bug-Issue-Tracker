import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import {
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../utils/authValidation';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const STRENGTH_BAR_COLORS: Record<number, string> = {
  1: 'bg-[#B3473B]',
  2: 'bg-[#C47D2B]',
  3: 'bg-[#C56A45]',
  4: 'bg-[#557A59]',
};

const STRENGTH_TEXT_COLORS: Record<number, string> = {
  0: 'text-[#8C8983]',
  1: 'text-[#B3473B] dark:text-[#EB8B80]',
  2: 'text-[#C47D2B] dark:text-[#E5A958]',
  3: 'text-[#C56A45] dark:text-[#E08A66]',
  4: 'text-[#557A59] dark:text-[#7DA882]',
};

function getSafeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/';
}

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = useMemo(
    () => getSafeRedirect(searchParams.get('redirect')),
    [searchParams]
  );
  const prefilledEmail = searchParams.get('email') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: prefilledEmail,
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password') || '';
  const confirmPasswordValue = watch('confirmPassword') || '';
  const strength = evaluatePasswordStrength(passwordValue);
  const passwordsMatch =
    strength.isValid &&
    confirmPasswordValue.length > 0 &&
    passwordValue === confirmPasswordValue;

  const nameField = register('name', {
    validate: (val) => validateFullName(val) || true,
  });

  const emailField = register('email', {
    validate: (val) => validateEmail(val) || true,
  });

  const passwordField = register('password', {
    validate: (val) => validatePassword(val) || true,
  });

  const confirmPasswordField = register('confirmPassword', {
    required: 'Please confirm your password.',
    validate: (val) => val === passwordValue || 'Passwords do not match.',
  });

  const onSubmit = async (values: RegisterForm) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setServerError('');
      await registerAccount(
        normalizeFullName(values.name),
        values.email.trim(),
        values.password,
        values.confirmPassword
      );
      toast.success('Workspace account created');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to create account right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requirements = [
    {
      label: '8+ characters',
      met: strength.checks.minLength,
    },
    {
      label: '1 uppercase letter',
      met: strength.checks.hasUppercase,
    },
    {
      label: '1 lowercase letter',
      met: strength.checks.hasLowercase,
    },
    {
      label: '1 number',
      met: strength.checks.hasNumber,
    },
    {
      label: '1 special character',
      met: strength.checks.hasSpecialChar,
    },
    {
      label: 'Passwords match',
      met: passwordsMatch,
    },
  ];

  const loginHref =
    redirectPath !== '/'
      ? `/login?redirect=${encodeURIComponent(redirectPath)}`
      : '/login';

  return (
    <AuthShell mode="register">
      <div>
        <div className="mb-6">
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Create your account
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
            Set up your profile to create projects, track bugs, and collaborate with your team.
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
              htmlFor="reg-name"
              className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
            >
              Full name
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="Jordan Taylor"
              aria-invalid={errors.name ? 'true' : 'false'}
              {...nameField}
              onChange={(e) => {
                nameField.onChange(e);
                if (serverError) setServerError('');
              }}
              className={`w-full h-10 px-3 text-[13.5px] rounded-md border bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#A19D95] dark:placeholder:text-[#6B6964] transition-all duration-150 focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-[#B3473B] focus:border-[#B3473B] focus:ring-[#B3473B]/15'
                  : 'border-[#DCD9D0] dark:border-[#34322E] hover:border-[#C5C0B6] dark:hover:border-[#494640] focus:border-[#C56A45] focus:ring-[#C56A45]/15'
              }`}
            />
            {errors.name && (
              <p className="mt-1.5 text-[12px] text-[#B3473B] dark:text-[#EB8B80]">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
            >
              Work email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="jordan@company.com"
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="reg-password"
                className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6]"
              >
                Password
              </label>
              {passwordValue.length > 0 && (
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    STRENGTH_TEXT_COLORS[strength.score]
                  }`}
                >
                  {strength.label}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...passwordField}
                onChange={(e) => {
                  passwordField.onChange(e);
                  if (serverError) setServerError('');
                  if (confirmPasswordValue.length > 0) {
                    void trigger('confirmPassword');
                  }
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

            {/* Real-time Password Strength Meter */}
            <div className="mt-2.5" aria-live="polite">
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((segment) => {
                  const active = strength.score >= segment;
                  return (
                    <div
                      key={segment}
                      className="h-1 rounded-full bg-[#E4E2DC] dark:bg-[#2E2D2A] overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          active
                            ? STRENGTH_BAR_COLORS[strength.score]
                            : 'w-0 opacity-0'
                        }`}
                        style={{ width: active ? '100%' : '0%' }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {requirements.map((req) => (
                  <div
                    key={req.label}
                    className={`flex items-center gap-1.5 text-[11.5px] transition-colors duration-200 ${
                      req.met
                        ? 'text-[#557A59] dark:text-[#7DA882]'
                        : 'text-[#8C8983] dark:text-[#7B7770]'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center border transition-colors duration-200 shrink-0 ${
                        req.met
                          ? 'bg-[#557A59]/15 border-[#557A59] text-[#557A59] dark:text-[#7DA882]'
                          : 'border-[#D1CEC6] dark:border-[#3A3835]'
                      }`}
                    >
                      {req.met && <Check className="w-2.5 h-2.5" strokeWidth={2.5} />}
                    </span>
                    <span className="truncate">{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-confirm-password"
              className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                {...confirmPasswordField}
                onChange={(e) => {
                  confirmPasswordField.onChange(e);
                  if (serverError) setServerError('');
                }}
                className={`w-full h-10 pl-3 pr-10 text-[13.5px] rounded-md border bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#A19D95] dark:placeholder:text-[#6B6964] transition-all duration-150 focus:outline-none focus:ring-2 ${
                  errors.confirmPassword
                    ? 'border-[#B3473B] focus:border-[#B3473B] focus:ring-[#B3473B]/15'
                    : 'border-[#DCD9D0] dark:border-[#34322E] hover:border-[#C5C0B6] dark:hover:border-[#494640] focus:border-[#C56A45] focus:ring-[#C56A45]/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#8C8983] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] transition-colors focus:outline-none focus:text-[#C56A45]"
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-[12px] text-[#B3473B] dark:text-[#EB8B80]">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 mt-1 text-[13.5px] font-medium rounded-md bg-[#C56A45] hover:bg-[#B05B38] active:bg-[#9D4E2E] text-white transition-colors duration-150 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="relative my-6">
          <div className="border-t border-[#E4E2DC] dark:border-[#2E2D2A]" />
        </div>

        <p className="text-center text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
          Already have an account?{' '}
          <Link
            to={loginHref}
            className="font-medium text-[#C56A45] hover:text-[#B05B38] hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
