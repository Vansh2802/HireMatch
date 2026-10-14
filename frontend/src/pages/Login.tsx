import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      navigate('/');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">HireMatch</p>
      <h1 className="mt-2 text-2xl font-semibold">{isRegistering ? 'Create your account' : 'Sign in to HireMatch'}</h1>
      <p className="mt-2 text-sm text-slate-500">Candidate data is private to your account.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
          <input id="password" type="password" required minLength={8} autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {isSubmitting ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button type="button" onClick={() => { setIsRegistering((current) => !current); setError(null); }} className="mt-4 text-sm font-medium text-brand-700 hover:text-brand-800">
        {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
      </button>
    </div>
  );
}
