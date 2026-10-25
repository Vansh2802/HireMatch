import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, FileText, Gauge, History, LayoutDashboard, LogOut, Menu, Settings, X } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/auth';
import { Brand } from './Brand';
import { useToast } from './ui/Toast';

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze a resume', icon: Gauge },
  { to: '/resumes', label: 'My resumes', icon: FileText },
  { to: '/jobs', label: 'Jobs & applications', icon: BriefcaseBusiness },
  { to: '/analyses', label: 'Analysis history', icon: History },
  { to: '/settings', label: 'Settings & privacy', icon: Settings },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      // The session is cleared locally either way.
    }
    queryClient.clear();
    queryClient.setQueryData(['me'], null);
    notify('Signed out.', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-obsidian text-ink-inverse">
      <div className="flex h-16 items-center px-5">
        <Brand to="/dashboard" inverse onClick={onNavigate} />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded px-3 py-2 text-[0.95rem] transition-colors ${
                    isActive ? 'bg-obsidian-soft text-ink-inverse shadow-[inset_3px_0_0_rgb(var(--accent))]' : 'text-ink-inverse-soft hover:bg-obsidian-soft/60 hover:text-ink-inverse'
                  }`
                }
              >
                <Icon size={17} aria-hidden="true" className="shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-obsidian-line px-3 py-3">
        <p className="truncate px-3 pb-2 text-sm text-ink-inverse-soft" title={user?.email}>
          {user?.email}
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded px-3 py-2 text-[0.95rem] text-ink-inverse-soft transition-colors hover:bg-obsidian-soft/60 hover:text-ink-inverse disabled:opacity-60"
        >
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
    // Move focus to the page for screen-reader and keyboard users on navigation.
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-paper focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <aside className="no-print sticky top-0 hidden h-screen lg:block">
        <Navigation />
      </aside>

      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-obsidian-line bg-obsidian px-4 lg:hidden">
        <Brand to="/dashboard" inverse />
        <button type="button" onClick={() => setOpen(true)} className="rounded p-2 text-ink-inverse hover:bg-obsidian-soft" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-nav">
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation" id="mobile-nav">
          <div className="absolute inset-0 bg-obsidian/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-enter shadow-pop">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 rounded p-1.5 text-ink-inverse-soft hover:text-ink-inverse" aria-label="Close navigation">
              <X size={18} />
            </button>
            <Navigation onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
