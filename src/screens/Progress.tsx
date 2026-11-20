import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../ctx';
import { addDays, ageFromBirth, fromDisplayWeight, isoDate, round1, toDisplayWeight, weekStart } from '../lib/calc';
import { rateAdvice, scenarios, simulate, smoothWeights, type Scenario } from '../lib/projection';
import { logWeight } from '../lib/profile';
import { Empty, fmtDate, fmtNum, haptic, Ico, IconBubble, NumberField, Sheet, toast } from '../components/ui';
import { BarChart, ProjectionChart } from '../components/Charts';
import { BodyTab, PhotosTab } from './Body';
import NutritionStats from './Stats';

export function WeightSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const u = profile.unit;
  const [date, setDate] = useState(isoDate());
  const [v, setV] = useState(toDisplayWeight(profile.weightKg, u));
  return (
    <Sheet title="Registrar peso" onClose={onClose}>
      <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} />
      <NumberField value={v} onChange={setV} step={0.1} min={20} max={700} suffix={u} />
      <button className="btn" style={{ marginTop: 20 }} onClick={async () => {
        await logWeight(date, fromDisplayWeight(v, u));
        haptic();
        toast('Peso guardado');
        onClose();
      }}>Guardar</button>
      <p className="note">Pésate a la misma hora (idealmente en ayunas). La tendencia suaviza las subidas y bajadas del agua.</p>
    </Sheet>
  );
}

type Range = 30 | 90 | 365 | 0;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
function humanSpan(days: number) {
  if (days < 14) return plural(days, 'día', 'días');
  const w = Math.round(days / 7);
  if (days < 120) return plural(w, 'semana', 'semanas');
  const m = Math.round(days / 30.4);
  return `${plural(m, 'mes', 'meses')} (${w} semanas)`;
}

export default function Progress() {
  const { profile, openSettings } = useApp();
  const [seg, setSeg] = useState<'peso' | 'cuerpo' | 'fotos' | 'stats'>('peso');
  return (
    <div className="screen">
      <div className="topbar">
        <h1>Progreso</h1>
        <button className="icon-btn" aria-label="Perfil y ajustes" onClick={openSettings}><Ico name="user" size={20} /></button>
      </div>
      <div className="seg">
        {([['peso', 'Peso'], ['cuerpo', 'Cuerpo'], ['fotos', 'Fotos'], ['stats', 'Estadísticas']] as const).map(([k, l]) => (
          <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)} style={{ fontSize: 13.5 }}>{l}</button>
        ))}
      </div>
      {seg === 'peso' && <WeightTab key={profile.targetKg + profile.kcal} />}
      {seg === 'cuerpo' && <BodyTab />}
      {seg === 'fotos' && <PhotosTab />}
      {seg === 'stats' && <StatsTab />}
    </div>
  );
}

function WeightTab() {
  const { profile, openWeight } = useApp();
  const u = profile.unit;
  const d = (kg: number) => toDisplayWeight(kg, u);
  const today = isoDate();
  const [range, setRange] = useState<Range>(90);
  const [which, setWhich] = useState<Scenario['key']>('plan');
  const [whatIf, setWhatIf] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const all = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], []);
  const intake = useLiveQuery(async () => {
    const es = await db.entries.where('date').between(addDays(today, -14), addDays(today, -1), true, true).toArray();
    const byDay: Record<string, number> = {};
    for (const e of es) byDay[e.date] = (byDay[e.date] ?? 0) + e.kcal;
    const full = Object.values(byDay).filter((k) => k >= 800);
    return { avg: full.length ? full.reduce((a, b) => a + b, 0) / full.length : null, days: full.length };
  }, [today], { avg: null, days: 0 });

  const tr = smoothWeights(all);
  const current = tr.length ? tr[tr.length - 1] : profile.weightKg;
  const last = all[all.length - 1];
  const start = all[0]?.kg ?? profile.weightKg;
  const goal = profile.targetKg;
  const losing = goal < start;
  const totalNeeded = Math.abs(start - goal);
  const done = losing ? start - current : current - start;
  const pct = totalNeeded > 0 ? Math.max(0, Math.min(100, (done / totalNeeded) * 100)) : 100;
  const toGo = Math.abs(current - goal);
  let prevIdx = -1;
  all.forEach((w, i) => { if (w.date <= addDays(today, -7)) prevIdx = i; });
  const weekChange = prevIdx >= 0 ? current - tr[prevIdx] : null;

  const person = { sex: profile.sex, age: ageFromBirth(profile.birth), heightCm: profile.heightCm, activity: profile.activity };
  const sc = scenarios({ ...person, currentKg: round1(current), targetKg: goal, planKcal: profile.kcal, avgIntake: intake.avg, loggedDays: intake.days, weights: all, today });
  const chosen = sc.find((s) => s.key === which) ?? sc[0];
  const wi = whatIf !== null ? simulate({ ...person, startKg: round1(current), targetKg: goal, dailyKcal: whatIf }, today) : null;
  const view = wi
    ? { days: wi.days, date: wi.date, rate: wi.initialRate, weekly: wi.weekly, reason: wi.reason, label: 'Simulación', detail: `${whatIf} kcal al día · déficit de ${Math.abs(wi.initialDeficit)} kcal` }
    : chosen;
  const advice = rateAdvice(view.rate, current, losing);

  const since = range ? addDays(today, -range) : '0000';
  const history = all.map((w, i) => ({ date: w.date, kg: d(w.kg), trend: d(tr[i]) })).filter((h) => h.date >= since);
  const projection = view.weekly.map((kg, i) => ({ date: i === view.weekly.length - 1 && view.date ? view.date : addDays(today, i * 7), kg: d(kg) }));
  const reached = toGo < 0.1;

  return (
    <>
      {/* Meta y avance */}
      <div className="card hero">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="muted small">Peso actual (tendencia)</div>
            <div className="big num" style={{ fontSize: 44 }}>{fmtNum(d(current), 1)}<span className="muted" style={{ fontSize: 18, fontWeight: 600 }}> {u}</span></div>
            {last && <div className="tiny muted">Último pesaje: {fmtNum(d(last.kg), 1)} {u} · {fmtDate(last.date, { day: 'numeric', month: 'short' })}</div>}
          </div>
          <button className="btn sm primary-glow" onClick={openWeight}><Ico name="plus" size={16} stroke={2.6} /> Peso</button>
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="row between tiny muted" style={{ marginBottom: 6 }}>
            <span className="num">Inicio {fmtNum(d(start), 1)}</span>
            <span className="num" style={{ color: 'var(--ok)' }}>Meta {fmtNum(d(goal), 1)}</span>
          </div>
          <div className="bar" style={{ height: 10, borderRadius: 5 }}>
            <i style={{ width: `${pct}%`, background: 'var(--glow)', borderRadius: 5 }} />
          </div>
          <div className="row between small" style={{ marginTop: 8 }}>
            <span><b className="num">{fmtNum(d(Math.max(0, done)), 1)} {u}</b> <span className="muted">{losing ? 'perdidos' : 'ganados'}</span></span>
            <span><b className="num">{Math.round(pct)} %</b> <span className="muted">del camino</span></span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <div className="mini-tile"><span>Últimos 7 días</span><b className="num" style={{ color: weekChange === null ? undefined : (losing ? weekChange < 0 : weekChange > 0) ? 'var(--ok)' : 'var(--warn)' }}>{weekChange === null ? '—' : `${weekChange > 0 ? '+' : '−'}${fmtNum(Math.abs(d(weekChange)), 1)} ${u}`}</b></div>
          <div className="mini-tile"><span>Te faltan</span><b className="num">{reached ? '¡Meta!' : `${fmtNum(d(toGo), 1)} ${u}`}</b></div>
          <div className="mini-tile"><span>Pesajes</span><b className="num">{all.length}</b></div>
        </div>
      </div>

      {/* Proyección */}
      <div className="section-title">¿Cuándo llegarás a tu meta?</div>
      <div className="card">
        {reached ? (
          <Empty icon="🏆" title="¡Llegaste a tu meta!" text="Cambia tu objetivo a «Mantener» en tu perfil o ponte una meta nueva." />
        ) : (
          <>
            {!whatIf && sc.length > 1 && (
              <div className="chips" style={{ marginBottom: 12 }}>
                {sc.map((s) => <button key={s.key} className={'chip' + (which === s.key ? ' on' : '')} onClick={() => setWhich(s.key)}>{s.key === 'plan' ? 'Tu meta' : s.key === 'comida' ? 'Lo que comes' : 'Tu báscula'}</button>)}
              </div>
            )}
            <div className="tiny muted">{view.label}</div>
            {view.date ? (
              <>
                <div className="num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: 2 }}>
                  {fmtDate(view.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="small" style={{ marginTop: 2 }}>en <b>{humanSpan(view.days!)}</b> · {view.rate > 0 ? '+' : '−'}{fmtNum(Math.abs(d(view.rate)), 2)} {u}/semana al principio</div>
              </>
            ) : (
              <div className="bold" style={{ fontSize: 19, marginTop: 4, color: 'var(--warn)' }}>{view.reason}</div>
            )}
            <div className="tiny muted" style={{ marginTop: 4 }}>{view.detail}</div>
            {view.date && (
              <div className="row tiny" style={{ marginTop: 10, gap: 6, color: advice.tone === 'warn' ? 'var(--warn)' : advice.tone === 'ok' ? 'var(--ok)' : 'var(--muted)' }}>
                <Ico name={advice.tone === 'warn' ? 'bell' : 'check'} size={15} /> {advice.text}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <ProjectionChart history={history} projection={view.date ? projection : []} goal={d(goal)} today={today} unit={u} endLabel={view.date ? fmtDate(view.date, { day: 'numeric', month: 'short' }) : undefined} />
            </div>
            <div className="row tiny muted" style={{ justifyContent: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--glow)', display: 'inline-block' }} />Tendencia</span>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 0, borderTop: '2.5px dotted #9c8cff', display: 'inline-block' }} />Proyección</span>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 0, borderTop: '2px dashed var(--ok)', display: 'inline-block' }} />Meta</span>
            </div>
            <div className="seg" style={{ marginTop: 12, marginBottom: 0 }}>
              {([[30, '1 mes'], [90, '3 meses'], [365, '1 año'], [0, 'Todo']] as [Range, string][]).map(([r, l]) => (
                <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{l}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {!reached && (
        <div className="card">
          <div className="card-title">
            <IconBubble name="sparkle" hue="#9c8cff" />
            <h3>Prueba otro déficit</h3>
            {whatIf !== null && <button className="btn ghost sm" style={{ paddingRight: 0 }} onClick={() => setWhatIf(null)}>Volver</button>}
          </div>
          <div className="row between small">
            <span className="muted">Calorías al día</span>
            <b className="num" style={{ fontSize: 18 }}>{whatIf ?? profile.kcal} kcal</b>
          </div>
          <input type="range" min={Math.max(1200, profile.kcal - 700)} max={profile.kcal + 500} step={10} value={whatIf ?? profile.kcal}
            onChange={(e) => setWhatIf(Number(e.target.value))} style={{ padding: 0, background: 'none', border: 0, marginTop: 8 }} aria-label="Calorías al día" />
          <div className="row between tiny muted"><span>Más rápido</span><span>Más lento</span></div>
          {wi && (
            <div className="small" style={{ marginTop: 10 }}>
              {wi.date ? <>Llegarías el <b>{fmtDate(wi.date, { day: 'numeric', month: 'long' })}</b> ({humanSpan(wi.days!)}), {sc[0].days && wi.days ? (wi.days < sc[0].days ? <span style={{ color: 'var(--ok)' }}>{humanSpan(sc[0].days - wi.days)} antes que con tu meta actual</span> : wi.days > sc[0].days ? <span style={{ color: 'var(--warn)' }}>{humanSpan(wi.days - sc[0].days)} después que con tu meta actual</span> : 'igual que con tu meta actual') : ''}.</> : wi.reason}
            </div>
          )}
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>Es solo una simulación: tu meta no cambia. Para cambiarla ve a Perfil → Calorías y macros.</p>
        </div>
      )}

      <p className="note">La proyección usa tu gasto estimado (Mifflin-St Jeor × actividad), que baja a medida que bajas de peso. Es orientativa: el agua, la sal y el ciclo hormonal mueven la báscula día a día.</p>

      {all.length > 0 && (
        <>
          <div className="section-title">Historial de peso</div>
          <div className="list">
            {[...all].reverse().slice(0, showAll ? 120 : 6).map((w, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? w.kg - prev.kg : 0;
              return (
                <div className="item" key={w.id}>
                  <div className="grow">{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  {prev && <span className="tiny num" style={{ color: Math.abs(diff) < 0.05 ? 'var(--muted)' : (losing ? diff < 0 : diff > 0) ? 'var(--ok)' : 'var(--warn)' }}>{Math.abs(diff) < 0.05 ? '=' : `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(d(diff)), 1)}`}</span>}
                  <b className="num" style={{ width: 70, textAlign: 'right' }}>{fmtNum(d(w.kg), 1)} {u}</b>
                  <button className="icon-btn" aria-label="Borrar pesaje" style={{ width: 30, height: 30, background: 'transparent', boxShadow: 'none', color: 'var(--faint)' }} onClick={async () => { if (confirm('¿Borrar este peso?')) await db.weights.delete(w.id!); }}><Ico name="close" size={14} /></button>
                </div>
              );
            })}
          </div>
          {all.length > 6 && <button className="btn ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Ver menos' : `Ver los ${all.length} pesajes`}</button>}
        </>
      )}
    </>
  );
}

function StatsTab() {
  const { profile } = useApp();
  const today = isoDate();
  const ws = weekStart(today);
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(ws, -7 * (5 - i)));
  const data = useLiveQuery(async () => {
    const entries = await db.entries.where('date').aboveOrEqual(weeks[0]).toArray();
    const workouts = await db.workouts.where('date').aboveOrEqual(weeks[0]).toArray();
    const runs = await db.runs.where('date').aboveOrEqual(weeks[0]).toArray();
    const perWeek = weeks.map((w) => {
      const end = addDays(w, 7);
      const es = entries.filter((e) => e.date >= w && e.date < end);
      const days = new Set(es.map((e) => e.date)).size;
      const sum = (k: 'kcal' | 'p') => es.reduce((a, e) => a + e[k], 0);
      return {
        days,
        kcal: days ? Math.round(sum('kcal') / days) : 0,
        p: days ? Math.round(sum('p') / days) : 0,
        km: round1(runs.filter((r) => r.date >= w && r.date < end).reduce((a, r) => a + r.km, 0)),
        gym: workouts.filter((x) => x.date >= w && x.date < end).length,
      };
    });
    const last4 = perWeek.slice(-4).filter((x) => x.days);
    const avgKcal = last4.length ? Math.round(last4.reduce((a, x) => a + x.kcal, 0) / last4.length) : 0;
    const avgP = last4.length ? Math.round(last4.reduce((a, x) => a + x.p, 0) / last4.length) : 0;
    return { perWeek, avgKcal, avgP, gym: workouts.filter((x) => x.date >= weeks[2]).length, km: round1(runs.filter((r) => r.date >= weeks[2]).reduce((a, r) => a + r.km, 0)), burned: workouts.filter((x) => x.date >= weeks[2]).reduce((a, x) => a + x.kcal, 0) + runs.filter((r) => r.date >= weeks[2]).reduce((a, r) => a + r.kcal, 0) };
  }, [weeks[0]], null);
  if (!data) return null;
  const labels = weeks.map((w) => fmtDate(w, { day: 'numeric', month: 'short' }));
  const deficit = data.avgKcal ? profile.kcal - data.avgKcal : null;
  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>Últimas 4 semanas</div>
      <div className="tiles">
        <div className="tile"><IconBubble name="flame" hue="#4d8dff" /><b className="num">{data.avgKcal ? fmtNum(data.avgKcal) : '—'}</b><span>kcal al día de media</span>{deficit !== null && <em style={{ color: Math.abs(deficit) <= profile.kcal * 0.1 ? 'var(--ok)' : 'var(--warn)' }}>{deficit >= 0 ? `${fmtNum(deficit)} bajo tu meta` : `${fmtNum(-deficit)} sobre tu meta`}</em>}</div>
        <div className="tile"><IconBubble name="heart" hue="#ff5c7a" /><b className="num">{data.avgP ? `${data.avgP} g` : '—'}</b><span>proteína al día</span>{data.avgP > 0 && <em style={{ color: data.avgP >= profile.protein * 0.9 ? 'var(--ok)' : 'var(--warn)' }}>{Math.round((data.avgP / profile.protein) * 100)} % de tu meta</em>}</div>
        <div className="tile"><IconBubble name="dumbbell" hue="#7a6bff" /><b className="num">{data.gym}</b><span>entrenos de fuerza</span></div>
        <div className="tile"><IconBubble name="run" hue="#3dd6a4" /><b className="num">{fmtNum(data.km, 1)} km</b><span>trotados · {fmtNum(data.burned)} kcal</span></div>
      </div>
      <div className="card">
        <div className="card-title"><h3>Calorías medias por semana</h3></div>
        <BarChart values={data.perWeek.map((x) => x.kcal)} labels={labels} color="var(--accent)" goal={profile.kcal} />
        <div className="card-title" style={{ marginTop: 14 }}><h3>Proteína media por semana</h3></div>
        <BarChart values={data.perWeek.map((x) => x.p)} labels={labels} color="var(--prot)" goal={profile.protein} height={120} />
        <div className="tiny muted center">Línea punteada: tu meta. Solo cuentan los días con registros.</div>
      </div>
      <NutritionStats />
    </>
  );
}
