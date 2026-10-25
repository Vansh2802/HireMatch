import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/auth';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { InlineError } from '../components/ui/States';

export default function Login({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const [params] = useSearchParams();
  const next = params.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : isRegister ? '/analyze' : '/dashboard';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `${isRegister ? 'Create account' : 'Sign in'} · HireMatch`;
    setErrors({});
  }, [isRegister]);

  if (session.data) return <Navigate to={destination} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const result = isRegister ? await api.register(email.trim(), password) : await api.login(email.trim(), password);
      queryClient.setQueryData(['me'], result.user);
      navigate(destination, { replace: true });
    } catch (error) {
      setErrors({ form: errorMessage(error) });
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-obsidian p-10 text-ink-inverse lg:flex">
        <Brand inverse />
        <div className="max-w-md">
          <p className="type-condensed text-4xl font-semibold leading-tight">Know which requirements your resume proves — before you apply.</p>
          <p className="mt-4 text-ink-inverse-soft">Upload a resume, paste a job description, and review the evidence for each requirement.</p>
        </div>
        <p className="text-sm text-ink-inverse-soft">Your original file isn’t stored. You can delete your data at any time.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="page-title">{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="mt-2 text-ink-soft">
            {isRegister ? 'Already have an account? ' : 'New to HireMatch? '}
            <Link to={isRegister ? `/login${next ? `?next=${encodeURIComponent(next)}` : ''}` : `/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="link">
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <InlineError message={errors.form} />
            <Field label="Email" error={errors.email}>
              <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
            </Field>
            <Field label="Password" error={errors.password} hint={isRegister ? 'At least 8 characters.' : undefined}>
              {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-faint hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              )}
            </Field>
            <Button type="submit" className="w-full" loading={submitting}>
              {isRegister ? 'Create account' : 'Sign in'}
            </Button>
            {isRegister && (
              <p className="text-sm text-ink-faint">
                By creating an account you agree to the <Link to="/terms" className="link">terms</Link> and <Link to="/privacy" className="link">privacy notice</Link>.
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
