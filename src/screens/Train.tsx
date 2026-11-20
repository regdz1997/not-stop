import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Routine, type WExercise, type Workout } from '../db';
import { useApp } from '../ctx';
import { isoDate, kcalMET, MET_FUERZA, oneRM } from '../lib/calc';
import { GROUPS, SEED_EXERCISES, type Exercise } from '../data/exercises';
import { normalize } from '../data/foods';
import { Empty, fmtDate, fmtNum, haptic, Icon, Sheet, toast, Ico } from '../components/ui';
import { LineChart } from '../components/Charts';
import { RunsTab } from './Run';

interface Active {
  name: string;
  startedAt: number;
  date: string;
  notes: string;
  exercises: WExercise[];
}

function useExercises(): Exercise[] {
  const custom = useLiveQuery(() => db.exercises.toArray(), [], []);
  return useMemo(() => [...SEED_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'es')), [custom]);
}

async function lastSetsFor(exId: string) {
  const ws = await db.workouts.orderBy('date').reverse().toArray();
  for (const w of ws) {
    const x = w.exercises.find((e) => e.exId === exId);
    if (x) return x.sets.filter((s) => s.done);
  }
  return [];
}

async function buildExercise(ex: Exercise): Promise<WExercise> {
  const prev = await lastSetsFor(ex.id);
  const sets = prev.length ? prev.map((s) => ({ kg: s.kg, reps: s.reps, done: false })) : [1, 2, 3].map(() => ({ kg: 0, reps: 10, done: false }));
  return { exId: ex.id, name: ex.name, sets };
}

async function startWorkout(name: string, exs: Exercise[]) {
  const exercises = await Promise.all(exs.map(buildExercise));
  const a: Active = { name, startedAt: Date.now(), date: isoDate(), notes: '', exercises };
  await db.kv.put({ key: 'active', value: a });
}

export default function Train() {
  const { openSettings } = useApp();
  const [seg, setSeg] = useState<'fuerza' | 'trote'>('fuerza');
  return (
    <div className="screen">
      <div className="topbar">
        <h1>Entreno</h1>
        <button className="icon-btn" aria-label="Perfil" onClick={openSettings}><Icon.user /></button>
      </div>
      <div className="seg">
        <button className={seg === 'fuerza' ? 'on' : ''} onClick={() => setSeg('fuerza')}>Fuerza</button>
        <button className={seg === 'trote' ? 'on' : ''} onClick={() => setSeg('trote')}>Trote</button>
      </div>
      {seg === 'fuerza' ? <Strength /> : <RunsTab />}
    </div>
  );
}

function Strength() {
  const active = useLiveQuery(() => db.kv.get('active'), [])?.value as Active | undefined;
  const routines = useLiveQuery(() => db.routines.toArray(), [], []);
  const history = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().limit(30).toArray(), [], []);
  const exercises = useExercises();
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const [open, setOpen] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [library, setLibrary] = useState(false);
  const [detail, setDetail] = useState<Workout | null>(null);

  const start = async (name: string, ids: string[]) => {
    if (active && !confirm('Ya tienes un entreno en curso. ¿Descartarlo y empezar otro?')) return;
    haptic();
    await startWorkout(name, ids.map((id) => byId.get(id)).filter(Boolean) as Exercise[]);
    setOpen(true);
  };

  return (
    <>
      {active && (
        <button className="card live-banner row tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(true)}>
          <span className="emoji">⏱️</span>
          <div className="grow">
            <div className="bold">{active.name} en curso</div>
            <div className="small muted"><Elapsed since={active.startedAt} /> · toca para continuar</div>
          </div>
          <span style={{ color: 'var(--accent)' }}>›</span>
        </button>
      )}

      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn" onClick={() => start('Entreno libre', [])}>＋ Entreno vacío</button>
        <button className="btn secondary" onClick={() => setLibrary(true)}><Ico name="book" />Ejercicios</button>
      </div>

      <div className="row between">
        <div className="section-title">Mis rutinas</div>
        <button className="btn ghost sm" onClick={() => setEditRoutine({ name: '', exerciseIds: [] })}>＋ Nueva</button>
      </div>
      <div className="list">
        {routines.length === 0 && <div className="item muted small">Crea tu primera rutina.</div>}
        {routines.map((r) => (
          <div className="item" key={r.id}>
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEditRoutine(r)}>
              <div className="bold">{r.name}</div>
              <div className="muted small ellipsis">{r.exerciseIds.map((id) => byId.get(id)?.name).filter(Boolean).join(' · ') || 'Sin ejercicios'}</div>
            </button>
            <button className="btn sm" onClick={() => start(r.name, r.exerciseIds)}>Iniciar</button>
          </div>
        ))}
      </div>

      <div className="section-title">Historial</div>
      {history.length === 0 ? (
        <Empty icon="🏋️" title="Aún no hay entrenos" text="Inicia una rutina y registra tus series." />
      ) : (
        <div className="list">
          {history.map((w) => {
            const vol = w.exercises.reduce((a, x) => a + x.sets.filter((s) => s.done).reduce((b, s) => b + s.kg * s.reps, 0), 0);
            return (
              <button className="item" key={w.id} onClick={() => setDetail(w)}>
                <span className="emoji">💪</span>
                <div className="grow">
                  <div className="bold">{w.name}</div>
                  <div className="muted small">{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {w.minutes} min · {fmtNum(vol)} kg de volumen</div>
                </div>
                <b className="small num">{w.kcal} kcal</b>
              </button>
            );
          })}
        </div>
      )}

      {open && active && <ActiveWorkout active={active} onClose={() => setOpen(false)} />}
      {editRoutine && <RoutineEditor routine={editRoutine} onClose={() => setEditRoutine(null)} />}
      {library && <ExerciseLibrary onClose={() => setLibrary(false)} />}
      {detail && <WorkoutDetail w={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return <span className="num">{h ? `${h}:` : ''}{String(m).padStart(h ? 2 : 1, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* sin audio */
  }
}

function ActiveWorkout({ active, onClose }: { active: Active; onClose: () => void }) {
  const { profile } = useApp();
  const [a, setA] = useState<Active>(active);
  const [prev, setPrev] = useState<Record<string, { kg: number; reps: number }[]>>({});
  const [picker, setPicker] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const saveT = useRef<number>();

  // Guardado automático del entreno en curso.
  useEffect(() => {
    clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => db.kv.put({ key: 'active', value: a }), 300);
  }, [a]);

  useEffect(() => {
    (async () => {
      const out: Record<string, { kg: number; reps: number }[]> = {};
      for (const x of a.exercises) if (!(x.exId in prev)) out[x.exId] = await lastSetsFor(x.exId);
      if (Object.keys(out).length) setPrev((p) => ({ ...p, ...out }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.exercises.length]);

  useEffect(() => {
    if (!restEnd) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= restEnd) {
        setRestEnd(null);
        haptic();
        beep();
      }
    }, 250);
    return () => clearInterval(t);
  }, [restEnd]);

  const upd = (fn: (x: Active) => void) => setA((cur) => {
    const copy: Active = JSON.parse(JSON.stringify(cur));
    fn(copy);
    return copy;
  });

  const setVal = (ei: number, si: number, k: 'kg' | 'reps', v: string) => upd((x) => { x.exercises[ei].sets[si][k] = Math.max(0, parseFloat(v.replace(',', '.')) || 0); });
  const toggle = (ei: number, si: number) => {
    haptic();
    const done = !a.exercises[ei].sets[si].done;
    upd((x) => { x.exercises[ei].sets[si].done = done; });
    if (done) setRestEnd(Date.now() + profile.restSec * 1000);
  };

  const finish = async () => {
    const doneSets = a.exercises.flatMap((x) => x.sets.filter((s) => s.done));
    if (doneSets.length === 0 && !confirm('No marcaste ninguna serie como hecha. ¿Guardar igual?')) return;
    const endedAt = Date.now();
    const minutes = Math.max(1, Math.round((endedAt - a.startedAt) / 60000));
    const kcal = kcalMET(MET_FUERZA, profile.weightKg, minutes);
    // Récords: comparar contra el historial previo
    const prs: string[] = [];
    for (const x of a.exercises) {
      const done = x.sets.filter((s) => s.done && s.kg > 0);
      if (!done.length) continue;
      const hist = (await db.workouts.toArray()).flatMap((w) => w.exercises.filter((e) => e.exId === x.exId).flatMap((e) => e.sets.filter((s) => s.done)));
      const prevMax = Math.max(0, ...hist.map((s) => oneRM(s.kg, s.reps)));
      const nowMax = Math.max(...done.map((s) => oneRM(s.kg, s.reps)));
      if (hist.length && nowMax > prevMax) prs.push(x.name);
    }
    await db.workouts.add({ date: a.date, name: a.name, startedAt: a.startedAt, endedAt, minutes, kcal, notes: a.notes, exercises: a.exercises });
    await db.kv.delete('active');
    toast(prs.length ? `🏆 ¡Récord en ${prs.join(', ')}!` : `💪 Entreno guardado · ${kcal} kcal`);
    onClose();
  };

  const discard = async () => {
    if (!confirm('¿Descartar este entreno? Se perderán las series.')) return;
    await db.kv.delete('active');
    onClose();
  };

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;
  const volume = a.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).reduce((b, s) => b + s.kg * s.reps, 0), 0);

  return (
    <Sheet full title={<span>{a.name} · <Elapsed since={a.startedAt} /></span>} onClose={onClose} right={<button className="btn sm" onClick={finish}>Terminar</button>}>
      <input value={a.name} onChange={(e) => upd((x) => { x.name = e.target.value; })} style={{ fontWeight: 700, marginBottom: 6 }} />
      <div className="muted small" style={{ marginBottom: 12 }}>Volumen: <b className="num">{fmtNum(volume)} kg</b> · descanso {profile.restSec} s</div>

      {a.exercises.map((x, ei) => (
        <div className="card" key={ei}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{x.name}</h3>
            <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Quitar ejercicio" onClick={() => { if (confirm(`¿Quitar ${x.name}?`)) upd((c) => { c.exercises.splice(ei, 1); }); }}>×</button>
          </div>
          <div className="set-row tiny muted">
            <span className="center">Serie</span><span className="center">Anterior</span><span className="center">kg</span><span className="center">Reps</span><span />
          </div>
          {x.sets.map((s, si) => {
            const p = prev[x.exId]?.[si];
            return (
              <div className="set-row" key={si}>
                <span className="n">{si + 1}</span>
                <span className="prev num">{p ? `${fmtNum(p.kg, 1)}×${p.reps}` : '—'}</span>
                <input inputMode="decimal" className="num" value={s.kg || ''} placeholder={p ? String(p.kg) : '0'} onChange={(e) => setVal(ei, si, 'kg', e.target.value)} onFocus={(e) => e.target.select()} />
                <input inputMode="numeric" className="num" value={s.reps || ''} placeholder={p ? String(p.reps) : '0'} onChange={(e) => setVal(ei, si, 'reps', e.target.value)} onFocus={(e) => e.target.select()} />
                <button className={'check' + (s.done ? ' on' : '')} aria-label="Serie hecha" onClick={() => toggle(ei, si)}>✓</button>
              </div>
            );
          })}
          <div className="row">
            <button className="btn secondary sm grow" onClick={() => upd((c) => { const last = c.exercises[ei].sets.at(-1); c.exercises[ei].sets.push({ kg: last?.kg ?? 0, reps: last?.reps ?? 10, done: false }); })}>＋ Serie</button>
            {x.sets.length > 1 && <button className="btn secondary sm" onClick={() => upd((c) => { c.exercises[ei].sets.pop(); })}>− Serie</button>}
          </div>
        </div>
      ))}

      <button className="btn secondary" onClick={() => setPicker(true)}>＋ Agregar ejercicio</button>
      <label className="small muted" style={{ display: 'block', marginTop: 16 }}>Notas</label>
      <textarea rows={3} value={a.notes} onChange={(e) => upd((x) => { x.notes = e.target.value; })} placeholder="Sensaciones, ajustes, molestias…" style={{ marginTop: 6 }} />
      <button className="btn danger" style={{ marginTop: 16, marginBottom: 80 }} onClick={discard}>Descartar entreno</button>

      {restEnd && (
        <div className="rest-bar">
          <span style={{ fontSize: 22 }}>⏱️</span>
          <div className="grow">
            <div className="small">Descanso</div>
            <div className="bold num" style={{ fontSize: 22 }}>{Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}</div>
          </div>
          <button className="btn sm" style={{ background: 'rgba(255,255,255,.2)' }} onClick={() => setRestEnd((r) => (r ?? Date.now()) + 15000)}>+15 s</button>
          <button className="btn sm" style={{ background: 'rgba(255,255,255,.2)' }} onClick={() => setRestEnd(null)}>Saltar</button>
        </div>
      )}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={async (ex) => {
            const w = await buildExercise(ex);
            upd((c) => { c.exercises.push(w); });
            setPicker(false);
          }}
        />
      )}
    </Sheet>
  );
}

function ExercisePicker({ onPick, onClose, title = 'Agregar ejercicio' }: { onPick: (e: Exercise) => void; onClose: () => void; title?: string }) {
  const all = useExercises();
  const [q, setQ] = useState('');
  const [g, setG] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState(GROUPS[0]);
  const list = all.filter((e) => (!g || e.group === g) && normalize(e.name).includes(normalize(q)));

  return (
    <Sheet title={title} onClose={onClose}>
      <input type="search" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={'chip' + (!g ? ' on' : '')} onClick={() => setG(null)}>Todos</button>
        {GROUPS.map((x) => <button key={x} className={'chip' + (g === x ? ' on' : '')} onClick={() => setG(x)}>{x}</button>)}
      </div>
      {creating ? (
        <div className="card col">
          <input placeholder="Nombre del ejercicio" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>{GROUPS.map((x) => <option key={x}>{x}</option>)}</select>
          <button className="btn" disabled={!newName.trim()} onClick={async () => {
            const ex: Exercise = { id: 'c-' + Date.now().toString(36), name: newName.trim(), group: newGroup, custom: true };
            await db.exercises.put(ex);
            onPick(ex);
          }}>Crear y agregar</button>
        </div>
      ) : (
        <button className="btn secondary" style={{ marginBottom: 10 }} onClick={() => { setCreating(true); setNewName(q); }}><Ico name="edit" />Crear ejercicio propio</button>
      )}
      <div className="list">
        {list.map((e) => (
          <button className="item" key={e.id} onClick={() => onPick(e)}>
            <div className="grow"><div>{e.name}</div><div className="muted small">{e.group}{e.custom ? ' · propio' : ''}</div></div>
            <Ico name="plus" size={20} style={{ color: 'var(--accent)' }} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const all = useExercises();
  const byId = new Map(all.map((e) => [e.id, e]));
  const [name, setName] = useState(routine.name);
  const [ids, setIds] = useState(routine.exerciseIds);
  const [picker, setPicker] = useState(false);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const c = [...ids];
    [c[i], c[j]] = [c[j], c[i]];
    setIds(c);
  };
  return (
    <Sheet title={routine.id ? 'Editar rutina' : 'Nueva rutina'} onClose={onClose}>
      <input placeholder="Nombre (p. ej., Pierna)" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="list">
        {ids.length === 0 && <div className="item muted small">Agrega ejercicios.</div>}
        {ids.map((id, i) => (
          <div className="item" key={id + i}>
            <div className="grow ellipsis">{i + 1}. {byId.get(id)?.name ?? id}</div>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setIds(ids.filter((_, k) => k !== i))} aria-label="Quitar">×</button>
          </div>
        ))}
      </div>
      <button className="btn secondary" onClick={() => setPicker(true)} style={{ marginBottom: 10 }}>＋ Agregar ejercicio</button>
      <button className="btn" disabled={!name.trim()} onClick={async () => {
        const r = { name: name.trim(), exerciseIds: ids };
        if (routine.id) await db.routines.update(routine.id, r);
        else await db.routines.add(r);
        toast('Rutina guardada');
        onClose();
      }}>Guardar rutina</button>
      {routine.id && (
        <button className="btn danger" style={{ marginTop: 10 }} onClick={async () => { if (confirm(`¿Borrar la rutina «${routine.name}»?`)) { await db.routines.delete(routine.id!); onClose(); } }}>Borrar rutina</button>
      )}
      {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={(e) => { setIds([...ids, e.id]); setPicker(false); }} />}
    </Sheet>
  );
}

function ExerciseLibrary({ onClose }: { onClose: () => void }) {
  const [ex, setEx] = useState<Exercise | null>(null);
  return (
    <>
      <ExercisePicker title="Ejercicios y récords" onClose={onClose} onPick={setEx} />
      {ex && <ExerciseDetail ex={ex} onClose={() => setEx(null)} />}
    </>
  );
}

function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const sessions = useLiveQuery(async () => {
    const ws = await db.workouts.orderBy('startedAt').toArray();
    return ws
      .map((w) => {
        const sets = w.exercises.filter((e) => e.exId === ex.id).flatMap((e) => e.sets.filter((s) => s.done && s.reps > 0));
        if (!sets.length) return null;
        return {
          date: w.date,
          sets,
          maxKg: Math.max(...sets.map((s) => s.kg)),
          best1RM: Math.max(...sets.map((s) => oneRM(s.kg, s.reps))),
          volume: sets.reduce((a, s) => a + s.kg * s.reps, 0),
        };
      })
      .filter(Boolean) as { date: string; sets: { kg: number; reps: number }[]; maxKg: number; best1RM: number; volume: number }[];
  }, [ex.id], []);
  const maxKg = Math.max(0, ...sessions.map((s) => s.maxKg));
  const best = Math.max(0, ...sessions.map((s) => s.best1RM));
  const maxVol = Math.max(0, ...sessions.map((s) => s.volume));
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className="muted small" style={{ marginBottom: 10 }}>{ex.group}</div>
      <div className="card row" style={{ justifyContent: 'space-around' }}>
        <div className="kpi"><b className="num">{fmtNum(maxKg, 1)}</b><span>Peso máx. (kg)</span></div>
        <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{fmtNum(best, 1)}</b><span>1RM estimado</span></div>
        <div className="kpi"><b className="num">{fmtNum(maxVol)}</b><span>Mejor volumen</span></div>
      </div>
      {sessions.length > 1 && (
        <div className="card">
          <h3>1RM estimado</h3>
          <LineChart points={sessions.map((s) => ({ label: fmtDate(s.date, { day: 'numeric', month: 'short' }), v: s.best1RM }))} trend={sessions.map((s) => s.best1RM)} unit=" kg" />
        </div>
      )}
      {sessions.length === 0 ? (
        <Empty icon="📈" title="Sin historial" text="Cuando registres este ejercicio verás aquí tus récords." />
      ) : (
        <div className="list">
          {[...sessions].reverse().map((s, i) => (
            <div className="item" key={i}>
              <div className="grow">
                <div className="small bold">{fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div className="muted small num">{s.sets.map((x) => `${fmtNum(x.kg, 1)}×${x.reps}`).join('  ')}</div>
              </div>
              <div className="small num" style={{ textAlign: 'right' }}>{fmtNum(s.volume)} kg<div className="tiny muted">1RM {fmtNum(s.best1RM, 1)}</div></div>
            </div>
          ))}
        </div>
      )}
      <p className="note">1RM estimado con la fórmula de Epley.</p>
    </Sheet>
  );
}

function WorkoutDetail({ w, onClose }: { w: Workout; onClose: () => void }) {
  return (
    <Sheet title={w.name} onClose={onClose}>
      <div className="muted small" style={{ marginBottom: 10 }}>{fmtDate(w.date)} · {w.minutes} min · {w.kcal} kcal aprox.</div>
      {w.exercises.map((x, i) => (
        <div className="card" key={i}>
          <h3>{x.name}</h3>
          {x.sets.filter((s) => s.done).map((s, j) => (
            <div className="row between small num" key={j}><span className="muted">Serie {j + 1}</span><span>{fmtNum(s.kg, 1)} kg × {s.reps}</span></div>
          ))}
          {!x.sets.some((s) => s.done) && <div className="muted small">Sin series hechas</div>}
        </div>
      ))}
      {w.notes && <div className="card small"><b>Notas:</b> {w.notes}</div>}
      <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este entreno?')) { await db.workouts.delete(w.id!); onClose(); } }}>Borrar entreno</button>
    </Sheet>
  );
}
