import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Run } from '../db';
import { useApp } from '../ctx';
import { addDays, isoDate, pace, runKcal, weekStart } from '../lib/calc';
import { Empty, fmtDate, fmtNum, haptic, Sheet, toast, Ico } from '../components/ui';
import { BarChart } from '../components/Charts';

const RPE = ['Muy suave', 'Suave', 'Suave', 'Moderado', 'Moderado', 'Exigente', 'Exigente', 'Duro', 'Muy duro', 'Máximo'];

export function RunSheet({ onClose, edit }: { onClose: () => void; edit?: Run }) {
  const { profile, date: diaryDate } = useApp();
  const [date, setDate] = useState(edit?.date ?? diaryDate);
  const [km, setKm] = useState(edit ? String(edit.km) : '5');
  const [h, setH] = useState(edit ? String(Math.floor(edit.minutes / 60)) : '0');
  const [m, setM] = useState(edit ? String(Math.floor(edit.minutes % 60)) : '30');
  const [s, setS] = useState(edit ? String(Math.round((edit.minutes * 60) % 60)) : '0');
  const [rpe, setRpe] = useState(edit?.rpe ?? 5);
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const n = (x: string) => Math.max(0, parseFloat(x.replace(',', '.')) || 0);
  const kmN = n(km);
  const minutes = n(h) * 60 + n(m) + n(s) / 60;
  const kcal = runKcal(kmN, minutes, profile.weightKg);

  const save = async () => {
    const run: Run = { date, km: kmN, minutes: Math.round(minutes * 100) / 100, rpe, kcal, notes: notes.trim() };
    if (edit?.id) await db.runs.update(edit.id, run);
    else await db.runs.add(run);
    haptic();
    toast(`🏃 Trote guardado · ${kcal} kcal`);
    onClose();
  };

  return (
    <Sheet title={edit ? 'Editar trote' : 'Registrar trote'} onClose={onClose}>
      <div className="col">
        <div><label className="small muted">Fecha</label><input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} style={{ marginTop: 4 }} /></div>
        <div><label className="small muted">Distancia (km)</label><input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} onFocus={(e) => e.target.select()} style={{ marginTop: 4, fontSize: 22 }} /></div>
        <label className="small muted">Duración (h : min : s)</label>
        <div className="row">
          <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} onFocus={(e) => e.target.select()} style={{ textAlign: 'center' }} />:
          <input inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} onFocus={(e) => e.target.select()} style={{ textAlign: 'center' }} />:
          <input inputMode="numeric" value={s} onChange={(e) => setS(e.target.value)} onFocus={(e) => e.target.select()} style={{ textAlign: 'center' }} />
        </div>
        <label className="small muted">Esfuerzo percibido: <b style={{ color: 'var(--text)' }}>{rpe}/10 · {RPE[rpe - 1]}</b></label>
        <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} style={{ padding: 0, background: 'none', border: 0, accentColor: 'var(--accent)' }} />
        <div><label className="small muted">Notas</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ruta, sensaciones…" style={{ marginTop: 4 }} /></div>
        <div className="card row" style={{ justifyContent: 'space-around', margin: '6px 0' }}>
          <div className="kpi"><b className="num">{pace(kmN, minutes)}</b><span>min/km</span></div>
          <div className="kpi"><b className="num">{minutes > 0 ? fmtNum(kmN / (minutes / 60), 1) : '–'}</b><span>km/h</span></div>
          <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{kcal}</b><span>kcal aprox.</span></div>
        </div>
        <button className="btn" disabled={kmN <= 0 || minutes <= 0} onClick={save}>Guardar trote</button>
        {edit?.id && (
          <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este trote?')) { await db.runs.delete(edit.id!); onClose(); } }}>Borrar</button>
        )}
      </div>
    </Sheet>
  );
}

export function RunsTab() {
  const { openRun } = useApp();
  const runs = useLiveQuery(() => db.runs.orderBy('date').reverse().toArray(), [], []);
  const [edit, setEdit] = useState<Run | null>(null);

  const thisWeek = weekStart(isoDate());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const kmByWeek = weeks.map((w) => runs.filter((r) => weekStart(r.date) === w).reduce((a, r) => a + r.km, 0));
  const weekRuns = runs.filter((r) => weekStart(r.date) === thisWeek);

  return (
    <>
      <div className="card">
        <div className="row between">
          <div>
            <div className="muted small">Esta semana</div>
            <div className="big num">{fmtNum(kmByWeek[7], 1)} <span className="small muted">km</span></div>
          </div>
          <div className="kpi"><b className="num">{weekRuns.length}</b><span>trotes</span></div>
          <div className="kpi"><b className="num">{weekRuns.reduce((a, r) => a + r.kcal, 0)}</b><span>kcal</span></div>
        </div>
        <div className="section-title" style={{ marginTop: 14 }}>Kilómetros por semana</div>
        <BarChart values={kmByWeek} labels={weeks.map((w) => fmtDate(w, { day: 'numeric', month: 'numeric' }))} color="var(--accent)" dec={1} />
      </div>
      <button className="btn" onClick={openRun} style={{ marginBottom: 14 }}><Ico name="run" />Registrar trote</button>
      {runs.length === 0 ? (
        <Empty icon="🏃" title="Sin trotes todavía" text="Registra distancia y duración; calculamos ritmo y calorías." />
      ) : (
        <div className="list">
          {runs.map((r) => (
            <button className="item" key={r.id} onClick={() => setEdit(r)}>
              <span className="emoji">🏃</span>
              <div className="grow">
                <div className="bold num">{fmtNum(r.km, 2)} km · {pace(r.km, r.minutes)} /km</div>
                <div className="muted small">{fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {Math.round(r.minutes)} min · esfuerzo {r.rpe}/10</div>
              </div>
              <b className="num small">{r.kcal} kcal</b>
            </button>
          ))}
        </div>
      )}
      {edit && <RunSheet edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
