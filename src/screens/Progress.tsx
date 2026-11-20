import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../ctx';
import { addDays, fromDisplayWeight, isoDate, toDisplayWeight, trend, weekStart } from '../lib/calc';
import { logWeight } from '../lib/profile';
import { Empty, fmtDate, fmtNum, haptic, Icon, NumberField, Sheet, toast } from '../components/ui';
import { BarChart, LineChart } from '../components/Charts';
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
        toast('⚖️ Peso guardado');
        onClose();
      }}>Guardar</button>
      <p className="note">Pésate a la misma hora (idealmente en ayunas). La tendencia suaviza las subidas y bajadas del agua.</p>
    </Sheet>
  );
}

type Range = 30 | 90 | 365 | 0;

export default function Progress() {
  const { profile, openWeight, openSettings } = useApp();
  const u = profile.unit;
  const [range, setRange] = useState<Range>(90);
  const [seg, setSeg] = useState<'peso' | 'cuerpo' | 'fotos' | 'stats'>('peso');
  const all = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], []);
  const today = isoDate();
  const since = range ? addDays(today, -range) : '0000';

  // La tendencia se calcula con todo el historial y luego se recorta al rango.
  const tr = trend(all.map((w) => w.kg));
  const idx = all.map((w, i) => ({ w, t: tr[i] })).filter((x) => x.w.date >= since);
  const points = idx.map((x) => ({ label: fmtDate(x.w.date, { day: 'numeric', month: 'short' }), v: toDisplayWeight(x.w.kg, u) }));
  const trendVals = idx.map((x) => toDisplayWeight(x.t, u));

  const last = all[all.length - 1];
  const first = all[0];
  const currentTrend = tr[tr.length - 1];
  // Cambio de la tendencia frente al último pesaje de hace 7 días o más.
  let prevIdx = -1;
  all.forEach((w, i) => { if (w.date <= addDays(today, -7)) prevIdx = i; });
  const weekChange = prevIdx >= 0 ? currentTrend - tr[prevIdx] : 0;
  const toGo = last ? last.kg - profile.targetKg : 0;

  // Estadísticas de comida: promedio diario de las últimas 4 semanas
  const ws = weekStart(today);
  const weeks = Array.from({ length: 4 }, (_, i) => addDays(ws, -7 * (3 - i)));
  const stats = useLiveQuery(async () => {
    const entries = await db.entries.where('date').aboveOrEqual(weeks[0]).toArray();
    return weeks.map((w) => {
      const end = addDays(w, 7);
      const es = entries.filter((e) => e.date >= w && e.date < end);
      const days = new Set(es.map((e) => e.date)).size;
      const sum = (k: 'kcal' | 'p') => es.reduce((a, e) => a + e[k], 0);
      return { days, kcal: days ? Math.round(sum('kcal') / days) : 0, p: days ? Math.round(sum('p') / days) : 0 };
    });
  }, [weeks[0]], []);

  const workouts = useLiveQuery(() => db.workouts.where('date').aboveOrEqual(weeks[0]).toArray(), [weeks[0]], []);
  const runs = useLiveQuery(() => db.runs.where('date').aboveOrEqual(weeks[0]).toArray(), [weeks[0]], []);
  const wLabels = weeks.map((w) => fmtDate(w, { day: 'numeric', month: 'short' }));

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Progreso</h1>
        <button className="icon-btn" aria-label="Perfil" onClick={openSettings}><Icon.user /></button>
      </div>

      <div className="seg">
        {([['peso', 'Peso'], ['cuerpo', 'Cuerpo'], ['fotos', 'Fotos'], ['stats', 'Estadísticas']] as const).map(([k, l]) => (
          <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)} style={{ fontSize: 13 }}>{l}</button>
        ))}
      </div>
      {seg === 'peso' && (
        <>
      <div className="card">
        <div className="row between">
          <div>
            <div className="muted small">Peso actual</div>
            <div className="big num">{last ? fmtNum(toDisplayWeight(last.kg, u), 1) : '–'} <span className="small muted">{u}</span></div>
          </div>
          <button className="btn sm" onClick={openWeight}>+ Peso</button>
        </div>
        <div className="row" style={{ justifyContent: 'space-around', margin: '12px 0' }}>
          <div className="kpi"><b className="num">{currentTrend ? fmtNum(toDisplayWeight(currentTrend, u), 1) : '–'}</b><span>Tendencia</span></div>
          <div className="kpi"><b className="num" style={{ color: weekChange < 0 ? 'var(--ok)' : weekChange > 0 ? 'var(--carb)' : undefined }}>{weekChange > 0 ? '+' : ''}{fmtNum(toDisplayWeight(weekChange, u), 2)}</b><span>Últimos 7 días</span></div>
          <div className="kpi"><b className="num">{first && last ? (last.kg - first.kg > 0 ? '+' : '') + fmtNum(toDisplayWeight(last.kg - first.kg, u), 1) : '–'}</b><span>Desde el inicio</span></div>
        </div>
        <div className="seg">
          {([[30, '1 mes'], [90, '3 meses'], [365, '1 año'], [0, 'Todo']] as [Range, string][]).map(([r, l]) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{l}</button>
          ))}
        </div>
        {points.length >= 2 ? (
          <>
            <LineChart points={points} trend={trendVals} goal={toDisplayWeight(profile.targetKg, u)} unit={' ' + u} />
            <div className="row tiny muted" style={{ justifyContent: 'center', gap: 14, marginTop: 6 }}>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />Tendencia</span>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--muted)', display: 'inline-block' }} />Pesajes</span>
              <span className="row" style={{ gap: 5 }}><i style={{ width: 14, height: 0, borderTop: '2px dashed var(--ok)', display: 'inline-block' }} />Meta</span>
            </div>
          </>
        ) : (
          <Empty icon="⚖️" title={points.length ? 'Tu gráfica empieza aquí' : 'Sin pesos en este rango'} text="Pésate 2 o 3 veces por semana a la misma hora y verás tu tendencia real, sin los altibajos del agua." />
        )}
        <div className="center small" style={{ marginTop: 10, color: 'var(--text)' }}>
          {toGo > 0.05 ? `Te faltan ${fmtNum(toDisplayWeight(toGo, u), 1)} ${u} para tu meta de ${fmtNum(toDisplayWeight(profile.targetKg, u), 1)} ${u}` : toGo < -0.05 ? `${fmtNum(toDisplayWeight(-toGo, u), 1)} ${u} sobre tu meta` : '¡Estás en tu meta!'}
        </div>
      </div>

      {all.length > 0 && (
        <>
          <div className="section-title">Historial de peso</div>
          <div className="list">
            {[...all].reverse().slice(0, 30).map((w) => (
              <div className="item" key={w.id}>
                <div className="grow">{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <b className="num">{fmtNum(toDisplayWeight(w.kg, u), 1)} {u}</b>
                <button className="icon-btn" aria-label="Borrar" style={{ width: 32, height: 32 }} onClick={async () => { if (confirm('¿Borrar este peso?')) await db.weights.delete(w.id!); }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
        </>
      )}
      {seg === 'cuerpo' && <BodyTab />}
      {seg === 'fotos' && <PhotosTab />}
      {seg === 'stats' && (
        <>
          <NutritionStats />
      <div className="section-title">Promedio diario por semana</div>
      <div className="card">
        <h3>Calorías</h3>
        <BarChart values={stats.map((s) => s.kcal)} labels={wLabels} color="var(--accent)" goal={profile.kcal} />
        <h3 style={{ marginTop: 12 }}>Proteína (g)</h3>
        <BarChart values={stats.map((s) => s.p)} labels={wLabels} color="var(--prot)" goal={profile.protein} />
        <div className="muted small center">Línea punteada = tu meta. Solo cuenta días con registros.</div>
      </div>

      <div className="section-title">Actividad (4 semanas)</div>
      <div className="card row" style={{ justifyContent: 'space-around' }}>
        <div className="kpi"><b className="num">{workouts.length}</b><span>entrenos de fuerza</span></div>
        <div className="kpi"><b className="num">{fmtNum(runs.reduce((a, r) => a + r.km, 0), 1)}</b><span>km trotados</span></div>
        <div className="kpi"><b className="num">{fmtNum(workouts.reduce((a, w) => a + w.kcal, 0) + runs.reduce((a, r) => a + r.kcal, 0))}</b><span>kcal quemadas</span></div>
      </div>

        </>
      )}
    </div>
  );
}
