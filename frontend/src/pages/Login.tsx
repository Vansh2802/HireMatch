import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/dashboard');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory-100 px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="mb-6 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <BriefcaseBusiness size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-ink-primary">HireMatch</span>
          </Link>
          <h1 className="page-heading">
            {isRegistering ? 'Create your account' : 'Sign in to HireMatch'}
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {isRegistering
              ? 'Start evaluating candidates in minutes.'
              : 'Candidate data is private to your account.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                disabled={isSubmitting}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder={isRegistering ? 'At least 8 characters' : '••••••••'}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition hover:text-ink-secondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {isRegistering && (
                <p className="mt-1 text-xs text-ink-secondary">Minimum 8 characters required.</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="alert-error" role="alert">{error}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-2.5"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Please wait…
                </>
              ) : (
                isRegistering ? 'Create account' : 'Sign in'
              )}
            </button>
          </form>

          <div className="divider mt-6" />

          <p className="mt-5 text-center text-sm text-ink-secondary">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsRegistering((v) => !v); setError(null); }}
              className="font-semibold text-brand-600 transition hover:text-brand-700"
            >
              {isRegistering ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>

        {/* Back to landing */}
        <p className="mt-6 text-center text-xs text-ink-muted">
          <Link to="/" className="transition hover:text-ink-secondary">← Back to homepage</Link>
        </p>
      </div>
    </div>
  );
}
