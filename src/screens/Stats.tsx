import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../ctx';
import { addDays, isoDate, oneRM, round1 } from '../lib/calc';
import { scoreFrom } from '../components/Insights';
import { BarChart } from '../components/Charts';
import { Empty, fmtDate, fmtNum } from '../components/ui';

export default function NutritionStats() {
  const { profile } = useApp();
  const today = isoDate();
  const data = useLiveQuery(async () => {
    const since = addDays(today, -183);
    const entries = await db.entries.where('date').aboveOrEqual(since).toArray();
    const water = await db.water.where('date').aboveOrEqual(since).toArray();
    const runs = await db.runs.where('date').aboveOrEqual(since).toArray();
    const workouts = await db.workouts.orderBy('date').toArray();
    const byDay = new Map<string, typeof entries>();
    for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    const waterBy = new Map(water.map((w) => [w.date, w.glasses]));

    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const days = last7.map((d) => {
      const es = byDay.get(d) ?? [];
      const sum = (k: 'kcal' | 'p' | 'c' | 'f' | 'fiber') => es.reduce((a, e) => a + e[k], 0);
      return { d, kcal: Math.round(sum('kcal')), p: Math.round(sum('p')), c: Math.round(sum('c')), f: Math.round(sum('f')), fiber: round1(sum('fiber')), score: es.length ? scoreFrom(es, waterBy.get(d) ?? 0, profile).total : 0 };
    });

    // Cumplimiento (últimos 28 días con registro)
    const recent = [...byDay.keys()].filter((d) => d > addDays(today, -28) && d < today);
    const kcalOk = recent.filter((d) => Math.abs((byDay.get(d) ?? []).reduce((a, e) => a + e.kcal, 0) - profile.kcal) <= profile.kcal * 0.1).length;
    const protOk = recent.filter((d) => (byDay.get(d) ?? []).reduce((a, e) => a + e.p, 0) >= profile.protein * 0.9).length;

    // Promedios mensuales
    const months = Array.from({ length: 6 }, (_, i) => {
      const dt = new Date();
      dt.setDate(1);
      dt.setMonth(dt.getMonth() - (5 - i));
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    });
    const monthAvg = months.map((m) => {
      const ds = [...byDay.keys()].filter((d) => d.startsWith(m));
      return ds.length ? Math.round(ds.reduce((a, d) => a + byDay.get(d)!.reduce((b, e) => b + e.kcal, 0), 0) / ds.length) : 0;
    });
    const kmMonth = months.map((m) => round1(runs.filter((r) => r.date.startsWith(m)).reduce((a, r) => a + r.km, 0)));

    // Progreso de fuerza: primer vs mejor 1RM de los ejercicios más hechos
    const ex = new Map<string, { name: string; first: number; best: number; sessions: number }>();
    for (const w of workouts) {
      for (const x of w.exercises) {
        const best = Math.max(0, ...x.sets.filter((s) => s.done).map((s) => oneRM(s.kg, s.reps)));
        if (!best) continue;
        const cur = ex.get(x.exId);
        if (!cur) ex.set(x.exId, { name: x.name, first: best, best, sessions: 1 });
        else ex.set(x.exId, { ...cur, best: Math.max(cur.best, best), sessions: cur.sessions + 1 });
      }
    }
    const strength = [...ex.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
    return { days, recent: recent.length, kcalOk, protOk, months, monthAvg, kmMonth, strength };
  }, [profile.kcal, profile.protein, profile.fat, profile.carbs, profile.waterGoal], null);

  if (!data) return null;
  const lbl = data.days.map((d) => fmtDate(d.d, { weekday: 'short' }).slice(0, 2));
  const mLbl = data.months.map((m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString('es', { month: 'short' }));

  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>Últimos 7 días</div>
      <div className="card">
        <h3>Calorías por día</h3>
        <BarChart values={data.days.map((d) => d.kcal)} labels={lbl} color="var(--accent)" goal={profile.kcal} />
        <h3 style={{ marginTop: 12 }}>Puntuación diaria</h3>
        <BarChart values={data.days.map((d) => d.score)} labels={lbl} color="var(--ok)" goal={85} height={110} />
        <div className="section-title">Macros por día (g)</div>
        <div className="list" style={{ background: 'var(--card2)' }}>
          <div className="item tiny muted"><span style={{ width: 34 }} /><span className="grow center" style={{ color: 'var(--prot)' }}>Proteína</span><span className="grow center" style={{ color: 'var(--carb)' }}>Carbos</span><span className="grow center" style={{ color: 'var(--fat)' }}>Grasa</span><span className="grow center">Fibra</span></div>
          {data.days.map((d, i) => (
            <div className="item small num" key={d.d} style={{ padding: '8px 12px' }}>
              <span style={{ width: 34 }} className="muted">{lbl[i]}</span>
              <span className="grow center" style={{ fontWeight: d.p >= profile.protein * 0.9 ? 800 : 400 }}>{d.p || '–'}</span>
              <span className="grow center">{d.c || '–'}</span>
              <span className="grow center">{d.f || '–'}</span>
              <span className="grow center">{d.fiber ? fmtNum(d.fiber, 1) : '–'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">Cumplimiento (28 días)</div>
      {data.recent === 0 ? (
        <div className="card"><Empty icon="📊" title="Aún sin datos suficientes" /></div>
      ) : (
        <div className="card row" style={{ justifyContent: 'space-around' }}>
          <div className="kpi"><b className="num">{data.recent}</b><span>días registrados</span></div>
          <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{Math.round((data.kcalOk / data.recent) * 100)} %</b><span>calorías en meta ±10 %</span></div>
          <div className="kpi"><b className="num" style={{ color: 'var(--prot)' }}>{Math.round((data.protOk / data.recent) * 100)} %</b><span>proteína ≥ 90 %</span></div>
        </div>
      )}

      <div className="section-title">Por mes</div>
      <div className="card">
        <h3>Calorías promedio diarias</h3>
        <BarChart values={data.monthAvg} labels={mLbl} color="var(--accent)" goal={profile.kcal} />
        <h3 style={{ marginTop: 12 }}>Kilómetros trotados</h3>
        <BarChart values={data.kmMonth} labels={mLbl} color="var(--fat)" dec={1} height={110} />
      </div>

      <div className="section-title">Progreso de fuerza (1RM estimado)</div>
      {data.strength.length === 0 ? (
        <div className="card"><Empty icon="🏋️" title="Registra entrenos para ver tu progreso" /></div>
      ) : (
        <div className="list">
          {data.strength.map((s) => {
            const pct = s.first ? ((s.best - s.first) / s.first) * 100 : 0;
            return (
              <div className="item small" key={s.name}>
                <div className="grow"><div className="ellipsis">{s.name}</div><div className="tiny muted">{s.sessions} {s.sessions === 1 ? 'sesión' : 'sesiones'}</div></div>
                <span className="num muted">{fmtNum(s.first, 1)} →</span>
                <b className="num">{fmtNum(s.best, 1)} kg</b>
                <span className="num" style={{ width: 54, textAlign: 'right', color: pct > 0 ? 'var(--ok)' : 'var(--muted)' }}>{pct > 0 ? `+${Math.round(pct)} %` : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
