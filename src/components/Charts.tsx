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

const DAY = 86400000;
/** Historial de peso + curva proyectada hasta la meta, en una escala de tiempo real. */
export function ProjectionChart({ history, projection, goal, today, unit, endLabel }: {
  history: { date: string; kg: number; trend: number }[];
  projection: { date: string; kg: number }[];
  goal: number;
  today: string;
  unit: string;
  endLabel?: string;
}) {
  const W2 = 340, H = 210;
  const pad = { l: 34, r: 12, t: 18, b: 24 };
  const all = [...history.map((h) => h.date), ...projection.map((p) => p.date), today];
  const t0 = Math.min(...all.map((d) => Date.parse(d)));
  const t1 = Math.max(...all.map((d) => Date.parse(d)), t0 + 14 * DAY);
  const vals = [...history.flatMap((h) => [h.kg, h.trend]), ...projection.map((p) => p.kg), goal];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const sp = hi - lo; lo -= sp * 0.08; hi += sp * 0.1;
  const x = (d: string) => pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W2 - pad.l - pad.r);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const path = (pts: { d: string; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.55, lo + (hi - lo) * 0.9];
  const fmt = (d: string) => new Date(Date.parse(d)).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  const end = projection[projection.length - 1];
  const histPath = path(history.map((h) => ({ d: h.date, v: h.trend })));
  const projPath = projection.length > 1 ? path(projection.map((p) => ({ d: p.date, v: p.kg }))) : '';
  const area = projection.length > 1 ? `${projPath} L${x(end.date).toFixed(1)},${(H - pad.b).toFixed(1)} L${x(projection[0].date).toFixed(1)},${(H - pad.b).toFixed(1)} Z` : '';
  return (
    <svg className="chart" viewBox={`0 0 ${W2} ${H}`} role="img" aria-label="Proyección de peso">
      <defs>
        <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a6bff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7a6bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="histLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4d8dff" />
          <stop offset="100%" stopColor="#7a6bff" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W2 - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end">{fmtNum(t, 1)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={W2 - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--ok)" strokeDasharray="4 5" strokeWidth={1.3} />
      <text x={pad.l + 4} y={y(goal) - 5} style={{ fill: 'var(--ok)', fontWeight: 700 }}>Meta {fmtNum(goal, 1)} {unit}</text>
      {area && <path d={area} fill="url(#projFill)" />}
      {projPath && <path d={projPath} fill="none" stroke="#9c8cff" strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" />}
      {history.map((h, i) => <circle key={i} cx={x(h.date)} cy={y(h.kg)} r={history.length > 40 ? 1.6 : 2.6} fill="rgba(255,255,255,0.35)" />)}
      {history.length > 1 && <path d={histPath} fill="none" stroke="url(#histLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
      <line x1={x(today)} x2={x(today)} y1={pad.t - 6} y2={H - pad.b} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
      <text x={x(today)} y={pad.t - 8} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 700 }}>Hoy</text>
      {end && projection.length > 1 && (
        <g>
          <circle cx={x(end.date)} cy={y(end.kg)} r={6} fill="#0c0d10" stroke="var(--ok)" strokeWidth={3} />
          {endLabel && <text x={Math.min(x(end.date), W2 - pad.r)} y={y(end.kg) + 18} textAnchor="end" style={{ fill: 'var(--ok)', fontWeight: 700 }}>{endLabel}</text>}
        </g>
      )}
      <text x={pad.l} y={H - 6} textAnchor="start">{fmt(new Date(t0).toISOString().slice(0, 10))}</text>
      {!(end && projection.length > 1 && endLabel) && <text x={W2 - pad.r} y={H - 6} textAnchor="end">{fmt(new Date(t1).toISOString().slice(0, 10))}</text>}
    </svg>
  );
}
