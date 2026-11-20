import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Entry, type Profile } from '../db';
import { addDays, isoDate, sumNutr } from '../lib/calc';
import { adaptiveTarget, applyAdaptive, dailyScore, fiberTarget, proactiveAlerts, type Score } from '../lib/insights';
import { saveProfile } from '../lib/profile';
import { fmtNum, haptic, Ring, Sheet, toast } from './ui';

export async function scoreForDate(date: string, p: Profile): Promise<Score | null> {
  const entries = await db.entries.where('date').equals(date).toArray();
  if (!entries.length) return null;
  const w = await db.water.get(date);
  return scoreFrom(entries, w?.glasses ?? 0, p);
}

export function scoreFrom(entries: Entry[], glasses: number, p: Profile): Score {
  const t = sumNutr(entries);
  return dailyScore(
    { kcal: t.kcal, p: t.p, c: t.c, f: t.f, fiber: t.fiber, glasses, distinctFoods: new Set(entries.map((e) => e.foodId)).size },
    { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, waterGoal: p.waterGoal },
  );
}

const scoreColor = (n: number) => (n >= 85 ? 'var(--ok)' : n >= 70 ? 'var(--accent)' : n >= 50 ? 'var(--carb)' : 'var(--danger)');

export function ScoreCard({ entries, glasses, profile, live }: { entries: Entry[]; glasses: number; profile: Profile; live?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const s = scoreFrom(entries, glasses, profile);
  const tot = sumNutr(entries);
  return (
    <>
      <button className="card row tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(true)}>
        <Ring value={s.total} max={100} size={64} stroke={7} color={scoreColor(s.total)}>
          <b className="num" style={{ fontSize: 20 }}>{s.total}</b>
        </Ring>
        <div className="grow">
          <div className="bold">{live ? 'Puntuación parcial' : `Puntuación del día · ${s.grade}`}</div>
          <div className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{live ? 'Sube a medida que completas el día. ' : ''}{s.tips[0]}</div>
        </div>
        <span style={{ color: 'var(--accent)' }}>›</span>
      </button>
      {open && (
        <Sheet title="Puntuación nutricional" onClose={() => setOpen(false)}>
          <div className="center" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Ring value={s.total} max={100} size={150} stroke={14} color={scoreColor(s.total)}>
              <div><div className="big num">{s.total}</div><div className="muted small">{s.grade}</div></div>
            </Ring>
          </div>
          <div className="list">
            {s.parts.map((p) => (
              <div className="item small" key={p.key}>
                <div className="grow">{p.label}</div>
                <div style={{ width: 110 }} className="bar"><i style={{ width: `${(p.pts / p.max) * 100}%`, background: scoreColor((p.pts / p.max) * 100) }} /></div>
                <b className="num" style={{ width: 54, textAlign: 'right' }}>{fmtNum(p.pts, 1)}/{p.max}</b>
              </div>
            ))}
          </div>
          <div className="section-title">Consejos</div>
          <div className="list">
            {s.tips.map((t) => <div className="item small" key={t}>💡 {t}</div>)}
          </div>
          <div className="card small muted">
            Fibra: {fmtNum(tot.fiber, 1)} de {fiberTarget(profile.kcal)} g · Agua: {glasses} de {profile.waterGoal} vasos · Alimentos distintos: {new Set(entries.map((e) => e.foodId)).size}
          </div>
          <p className="note">Calorías 30 · Proteína 25 · Carbos y grasa 15 · Fibra 12 · Agua 10 · Variedad 8.</p>
        </Sheet>
      )}
    </>
  );
}

/** Alertas proactivas (se pueden ocultar por hoy). */
export function AlertsList({ profile }: { profile: Profile }) {
  const today = isoDate();
  const data = useLiveQuery(async () => {
    const since = addDays(today, -40);
    const entries = await db.entries.where('date').aboveOrEqual(since).toArray();
    const weights = await db.weights.orderBy('date').toArray();
    const dismissed = ((await db.kv.get('alerts-dismissed'))?.value ?? {}) as Record<string, string>;
    const proteinByDay: Record<string, number> = {};
    for (const e of entries) proteinByDay[e.date] = (proteinByDay[e.date] ?? 0) + e.p;
    const all = proactiveAlerts({ today, loggedDates: [...new Set(entries.map((e) => e.date))], proteinByDay, proteinTarget: profile.protein, weights, goal: profile.goal });
    // La alerta de "pocos registros" solo tiene sentido si la app lleva más de una semana en uso.
    const old = profile.createdAt <= addDays(today, -7);
    return all.filter((a) => dismissed[a.id] !== today && (a.id !== 'nolog' || old));
  }, [profile.protein, profile.goal, profile.createdAt], []);

  if (!data.length) return null;
  const dismiss = async (id: string) => {
    const cur = ((await db.kv.get('alerts-dismissed'))?.value ?? {}) as Record<string, string>;
    await db.kv.put({ key: 'alerts-dismissed', value: { ...cur, [id]: today } });
  };
  return (
    <>
      {data.map((a) => (
        <div className="card" key={a.id} style={{ borderLeft: '4px solid var(--carb)' }}>
          <div className="row between">
            <b>{a.icon} {a.title}</b>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Ocultar" onClick={() => dismiss(a.id)}>×</button>
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>{a.text}</div>
        </div>
      ))}
    </>
  );
}

/** Propuesta semanal de ajuste de calorías. */
export function AdaptiveCard({ profile }: { profile: Profile }) {
  const today = isoDate();
  const res = useLiveQuery(async () => {
    if (profile.adaptive === false) return null;
    const last = (await db.kv.get('adaptive-last'))?.value as string | undefined;
    if (last && last > addDays(today, -7)) return null;
    const entries = await db.entries.where('date').aboveOrEqual(addDays(today, -22)).toArray();
    const intakeByDay: Record<string, number> = {};
    for (const e of entries) intakeByDay[e.date] = (intakeByDay[e.date] ?? 0) + e.kcal;
    const weights = await db.weights.orderBy('date').toArray();
    const r = adaptiveTarget({ today, intakeByDay, weights, currentKcal: profile.kcal, goal: profile.goal, weightKg: profile.weightKg, minKcal: profile.sex === 'h' ? 1500 : 1200 });
    return r.ok && Math.abs(r.proposedKcal! - profile.kcal) >= 30 ? r : null;
  }, [profile.kcal, profile.goal, profile.adaptive], null);

  if (!res) return null;
  const decide = async (accept: boolean) => {
    await db.kv.put({ key: 'adaptive-last', value: today });
    if (accept) {
      const m = applyAdaptive(res.proposedKcal!, profile.weightKg, profile.goal);
      await saveProfile({ ...profile, ...m, customMacros: true });
      toast(`Nueva meta: ${m.kcal} kcal`);
    } else toast('Mantengo tu meta actual');
    haptic();
  };
  return (
    <div className="card live-banner">
      <b>📊 Ajuste semanal de calorías</b>
      <div className="small" style={{ margin: '6px 0 10px' }}>{res.explanation}</div>
      <div className="row">
        <button className="btn sm" style={{ flex: 1 }} onClick={() => decide(true)}>Aceptar {res.proposedKcal} kcal</button>
        <button className="btn secondary sm" style={{ flex: 1 }} onClick={() => decide(false)}>Mantener {profile.kcal}</button>
      </div>
    </div>
  );
}
