import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { Brand } from './Brand';
import { LinkButton } from './ui/Button';

export function PublicHeader({ dark = false }: { dark?: boolean }) {
  const { data: user } = useSession();
  const linkClass = dark ? 'text-ink-inverse-soft hover:text-ink-inverse' : 'text-ink-soft hover:text-ink';
  return (
    <header className={dark ? 'bg-obsidian' : 'border-b border-line bg-canvas'}>
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <Brand inverse={dark} />
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-5">
          <Link to="/how-it-works" className={`hidden text-sm font-medium sm:inline ${linkClass}`}>
            How scoring works
          </Link>
          {user ? (
            <LinkButton to="/dashboard" size="sm" variant={dark ? 'inverse' : 'primary'}>
              Open workspace
            </LinkButton>
          ) : (
            <>
              <Link to="/login" className={`px-2 text-sm font-medium ${linkClass}`}>
                Sign in
              </Link>
              <LinkButton to="/register" size="sm" variant={dark ? 'inverse' : 'primary'}>
                Create account
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>HireMatch shows how a resume evidences a job’s requirements. It does not predict hiring decisions.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/how-it-works" className="hover:text-ink">How scoring works</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/terms" className="hover:text-ink">Terms</Link>
          <Link to="/login" className="hover:text-ink">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · HireMatch`;
  }, [title]);
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
