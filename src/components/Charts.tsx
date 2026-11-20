import { fmtNum } from './ui';

const W = 340;

export function BarChart({ values, labels, color, dec = 0, goal, height = 140 }: { values: number[]; labels: string[]; color: string; dec?: number; goal?: number; height?: number }) {
  const H = height;
  const pad = { t: 16, b: 20 };
  const max = Math.max(1, goal ?? 0, ...values) * 1.1;
  const bw = W / values.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {goal ? <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1} /> : null}
      {values.map((v, i) => {
        const x = i * bw + bw * 0.2;
        const top = y(v);
        return (
          <g key={i}>
            <rect x={x} y={top} width={bw * 0.6} height={Math.max(0, H - pad.b - top)} rx={4} fill={color} opacity={i === values.length - 1 ? 1 : 0.55} />
            {v > 0 && <text x={x + bw * 0.3} y={top - 4} textAnchor="middle" style={{ fill: 'var(--text)' }}>{fmtNum(v, dec)}</text>}
            <text x={x + bw * 0.3} y={H - 5} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, trend, goal, height = 180, unit = '' }: { points: { label: string; v: number }[]; trend?: number[]; goal?: number; height?: number; unit?: string }) {
  const H = height;
  const pad = { l: 34, r: 8, t: 12, b: 20 };
  if (points.length === 0) return null;
  const vals = [...points.map((p) => p.v), ...(trend ?? []), ...(goal ? [goal] : [])];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const span = hi - lo;
  lo -= span * 0.08;
  hi += span * 0.08;
  const n = points.length;
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const labelIdx = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 4} y={y(t) + 3} textAnchor="end">{fmtNum(t, 1)}</text>
        </g>
      ))}
      {goal ? (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--ok)" strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={W - pad.r} y={y(goal) - 4} textAnchor="end" style={{ fill: 'var(--ok)' }}>Meta {fmtNum(goal, 1)}{unit}</text>
        </>
      ) : null}
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={n > 40 ? 1.8 : 3} fill="var(--muted)" />)}
      {trend && trend.length > 1 && <path d={path(trend)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {[...new Set(labelIdx)].map((i) => (
        <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{points[i].label}</text>
      ))}
    </svg>
  );
}
