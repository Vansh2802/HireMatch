import { scoreTone } from '../../lib/format';

const STROKES = { met: 'rgb(var(--met))', partial: 'rgb(var(--partial))', missing: 'rgb(var(--missing))', unknown: 'rgb(var(--unknown))' };

/** Half-ring gauge with a condensed numeral. Renders an explicit "no score" state instead of a fake number. */
export function ScoreDial({ score, size = 168 }: { score: number | null; size?: number }) {
  const radius = 64;
  const circumference = Math.PI * radius;
  const value = score ?? 0;
  const tone = scoreTone(score);
  return (
    <figure className="relative inline-flex flex-col items-center" style={{ width: size }} aria-label={score === null ? 'No score: not enough evidence' : `Match score ${score} out of 100`}>
      <svg viewBox="0 0 160 92" width={size} height={size * 0.575} aria-hidden="true">
        <path d="M16 84 A64 64 0 0 1 144 84" fill="none" stroke="rgb(var(--sunk))" strokeWidth="12" strokeLinecap="round" />
        {score !== null && (
          <path
            d="M16 84 A64 64 0 0 1 144 84"
            fill="none"
            stroke={STROKES[tone]}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.7,.2,1)' }}
          />
        )}
      </svg>
      <figcaption className="absolute bottom-0 flex flex-col items-center leading-none">
        <span className="type-condensed tabular text-6xl font-semibold text-ink">{score ?? '—'}</span>
        <span className="mt-1 text-xs text-ink-faint">{score === null ? 'no score' : 'out of 100'}</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bar for a 0–1 component score, with an unscored state. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  const tone = value === null ? 'unknown' : scoreTone(Math.round(value * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sunk" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      {value !== null && <div className="h-full rounded-full" style={{ width: `${Math.max(2, value * 100)}%`, background: STROKES[tone] }} />}
    </div>
  );
}
