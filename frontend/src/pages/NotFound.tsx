import { PublicPage } from '../components/PublicLayout';
import { LinkButton } from '../components/ui/Button';
import { useSession } from '../lib/auth';

export default function NotFound() {
  const { data: user } = useSession();
  return (
    <PublicPage title="Page not found">
      <div className="mx-auto max-w-prose px-4 py-24 sm:px-6">
        <p className="type-condensed tabular text-6xl font-semibold text-accent">404</p>
        <h1 className="mt-3 text-2xl font-semibold">This page doesn’t exist</h1>
        <p className="mt-2 text-ink-soft">The link may be mistyped, or the item was deleted.</p>
        <LinkButton to={user ? '/dashboard' : '/'} className="mt-6">
          {user ? 'Go to overview' : 'Go to home page'}
        </LinkButton>
      </div>
    </PublicPage>
  );
}
