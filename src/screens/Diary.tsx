import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Entry } from '../db';
import { useApp } from '../ctx';
import { addDays, isoDate, MEALS, remaining, sumNutr, weekStart, type MealKey } from '../lib/calc';
import { fmtDate, fmtNum, FoodBubble, haptic, Ico, IconBubble, MacroRings, Ring, Sheet, toast } from '../components/ui';
import { foodEmoji } from '../data/emoji';
import { foodFromEntry, getFood, PortionSheet, servingText } from '../components/Portion';
import type { Food } from '../data/foods';
import { AdaptiveCard, AlertsList, ScoreCard } from '../components/Insights';
import { FastMini } from './Fasting';
import { allRecipes, foodMap, logRecipe } from '../lib/recipeLog';
import { fmtFactor, mealShares, recipeNutr } from '../lib/planner';

const MEAL_HUE: Record<MealKey, string> = { desayuno: '#ffb547', almuerzo: '#ff7a59', cena: '#7a6bff', snacks: '#3dd6a4' };

export default function Diary() {
  const { profile, date, setDate, openAddFood, openSettings, setTab, openFasting } = useApp();
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date], []);
  const water = useLiveQuery(() => db.water.get(date), [date]);
  const workouts = useLiveQuery(() => db.workouts.where('date').equals(date).toArray(), [date], []);
  const runs = useLiveQuery(() => db.runs.where('date').equals(date).toArray(), [date], []);
  const steps = useLiveQuery(() => db.steps.get(date), [date]);
  const loggedDays = useLiveQuery(async () => new Set((await db.entries.where('date').between(weekStart(date), addDays(weekStart(date), 6), true, true).toArray()).map((e) => e.date)), [date], new Set<string>());
  const plan = useLiveQuery(async () => {
    const d = await db.plans.get(date);
    if (!d) return null;
    const [rs, fm] = await Promise.all([allRecipes(), foodMap()]);
    const rmap = new Map(rs.map((r) => [r.id, r]));
    const out: Partial<Record<MealKey, { label: string; kcal: number; run: () => Promise<void> }[]>> = {};
    for (const [meal, items] of Object.entries(d.meals) as [MealKey, typeof d.meals.desayuno][]) {
      out[meal] = (items ?? []).flatMap((it) => {
        const r = rmap.get(it.recipeId);
        if (!r) return [];
        return [{ label: `${r.emoji} ${r.name} · ${fmtFactor(it.factor)}`, kcal: recipeNutr(r, fm, it.factor).kcal, run: () => logRecipe(r, it.factor, date, meal, fm) }];
      });
    }
    return out;
  }, [date], null);

  const [editing, setEditing] = useState<{ entry: Entry; food: Food } | null>(null);
  const [menu, setMenu] = useState<MealKey | null>(null);

  const tot = sumNutr(entries);
  const burned = workouts.reduce((a, w) => a + w.kcal, 0) + runs.reduce((a, r) => a + r.kcal, 0);
  const left = remaining(profile.kcal, tot.kcal, burned);
  const today = isoDate();

  const ws = weekStart(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const openEntry = async (e: Entry) => {
    const food = (await getFood(e.foodId)) ?? foodFromEntry(e);
    setEditing({ entry: e, food });
  };

  const glasses = water?.glasses ?? 0;
  const setGlasses = async (n: number) => {
    haptic();
    await db.water.put({ date, glasses: Math.max(0, n) });
  };

  const title = date === today ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' });

  const shares = mealShares(profile.mealsPerDay ?? 4);
  const eaten = Math.round(tot.kcal);

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="muted">{fmtDate(date)}</div>
          <h1>{title}</h1>
        </div>
        <div className="row">
          {date !== today && <button className="btn sm secondary" onClick={() => setDate(today)}>Ir a hoy</button>}
          <button className="icon-btn" aria-label="Perfil y ajustes" onClick={openSettings}><Ico name="user" size={20} /></button>
        </div>
      </div>

      {/* Selector de semana */}
      <div className="row" style={{ marginBottom: 14, gap: 2 }}>
        <button className="icon-btn" style={{ width: 28, height: 40, background: 'none', boxShadow: 'none', color: 'var(--muted)' }} onClick={() => setDate(addDays(date, -7))} aria-label="Semana anterior"><Ico name="back" size={18} /></button>
        <div className="grow days">
          {week.map((d) => (
            <button key={d} className={'day' + (d === date ? ' on' : '') + (d === today ? ' today' : '') + (loggedDays.has(d) ? ' has' : '')} onClick={() => { haptic(); setDate(d); }} disabled={d > today}>
              <div className="dw">{fmtDate(d, { weekday: 'short' }).slice(0, 2)}</div>
              <div className="dn">{Number(d.slice(8))}</div>
              <div className="dot" />
            </button>
          ))}
        </div>
        <button className="icon-btn" style={{ width: 28, height: 40, background: 'none', boxShadow: 'none', color: 'var(--muted)' }} onClick={() => setDate(addDays(date, 7) > today ? today : addDays(date, 7))} aria-label="Semana siguiente"><Ico name="chevron" size={18} /></button>
      </div>

      {/* Calorías */}
      <div className="card hero">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="stat-pill">
            <b>{fmtNum(eaten)}</b>
            <span><Ico name="plan" size={14} /> Comidas</span>
          </div>
          <Ring value={eaten} max={profile.kcal + burned} size={168} stroke={15} gradient>
            <div>
              <div className="big num" style={{ fontSize: 40, color: left < 0 ? 'var(--danger)' : undefined }}>{fmtNum(Math.abs(left))}</div>
              <div className="muted small">{left < 0 ? 'kcal de más' : 'kcal restantes'}</div>
            </div>
          </Ring>
          <div className="stat-pill">
            <b>{fmtNum(burned)}</b>
            <span><Ico name="flame" size={14} /> Quemadas</span>
          </div>
        </div>
        <div className="center tiny" style={{ marginTop: 10, color: 'var(--faint)' }}>
          Meta {fmtNum(profile.kcal)} − comidas + quemadas
        </div>
        <MacroRings p={tot.p} c={tot.c} f={tot.f} tp={profile.protein} tc={profile.carbs} tf={profile.fat} />
      </div>

      <ScoreCard entries={entries} glasses={water?.glasses ?? 0} profile={profile} live={date === today && new Date().getHours() < 21} />
      {date === today && <AdaptiveCard profile={profile} />}
      {date === today && <AlertsList profile={profile} />}
      {date === today && <FastMini onOpen={openFasting} />}

      {/* Comidas */}
      <div className="section-title">Comidas</div>
      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key).sort((a, b) => a.createdAt - b.createdAt);
        const kcal = list.reduce((a, e) => a + e.kcal, 0);
        const target = Math.round(profile.kcal * (shares[m.key] ?? 0.1));
        return (
          <div className="meal-card" key={m.key}>
            <div className="meal-head">
              <FoodBubble emoji={m.icon} hue={MEAL_HUE[m.key]} size="lg" />
              <div className="grow">
                <div className="t">{m.label}</div>
                <div className="k">{fmtNum(kcal)} de {fmtNum(target)} kcal</div>
              </div>
              <button className="icon-btn" aria-label={`Opciones de ${m.label.toLowerCase()}`} style={{ width: 36, height: 36, background: 'transparent', boxShadow: 'none', color: 'var(--muted)' }} onClick={() => setMenu(m.key)}><Ico name="more" size={22} stroke={2.6} /></button>
              <button className="add-dot tap" aria-label={'Agregar a ' + m.label} onClick={() => { haptic(); openAddFood(m.key); }}><Ico name="plus" stroke={2.6} /></button>
            </div>
            {kcal > 0 && <div className="meal-bar"><i style={{ width: `${Math.min(100, (kcal / Math.max(1, target)) * 100)}%` }} /></div>}
            {list.length === 0 && plan?.[m.key]?.map((p) => (
              <button key={p.label} className="food-line" style={{ borderTop: '0.5px solid var(--hair)' }} onClick={async () => { await p.run(); haptic(); toast('Agregado desde tu menú'); }}>
                <span className="bubble" style={{ ['--hue' as string]: '#7a6bff', width: 34, height: 34, fontSize: 17 }}><Ico name="calendar" size={18} /></span>
                <div className="grow"><div className="tiny" style={{ color: 'var(--accent)' }}>Sugerido por tu menú</div><div className="small ellipsis">{p.label}</div></div>
                <span className="num muted small">{p.kcal}</span>
                <Ico name="plus" size={18} style={{ color: 'var(--accent)' }} />
              </button>
            ))}
            {list.length > 0 && <div style={{ height: 6 }} />}
            {list.map((e) => (
              <button key={e.id} className="food-line" onClick={() => openEntry(e)}>
                <span className="bubble" style={{ ['--hue' as string]: '#9195a1', width: 34, height: 34, fontSize: 18, background: 'var(--s2)', boxShadow: 'none' }}>{foodEmoji({ name: e.name, cat: 'Otros' })}</span>
                <div className="grow">
                  <div className="ellipsis" style={{ fontWeight: 550 }}>{e.name}</div>
                  <div className="muted tiny">{servingText(e.qty, e.servingLabel, e.grams)}</div>
                </div>
                <div className="small" style={{ textAlign: 'right' }}>
                  <div className="kc">{e.kcal} <span className="muted tiny" style={{ fontWeight: 500 }}>kcal</span></div>
                  <div className="tiny num" style={{ color: 'var(--faint)' }}><span style={{ color: 'var(--prot)' }}>{Math.round(e.p)}</span> / <span style={{ color: 'var(--carb)' }}>{Math.round(e.c)}</span> / <span style={{ color: 'var(--fat)' }}>{Math.round(e.f)}</span></div>
                </div>
              </button>
            ))}
            {list.length > 0 && <div style={{ height: 4 }} />}
          </div>
        );
      })}

      {/* Agua */}
      <div className="card">
        <div className="card-title">
          <IconBubble name="water" hue="#5ac8fa" />
          <h3>Agua</h3>
          <span className="muted small num">{fmtNum(glasses * 0.25, 2)} de {fmtNum(profile.waterGoal * 0.25, 2)} L</span>
        </div>
        <div className="glasses">
          {Array.from({ length: Math.max(profile.waterGoal, glasses) }, (_, i) => (
            <button key={i} className={'glass' + (i < glasses ? ' on' : '')} aria-label={`Vaso ${i + 1}`} onClick={() => setGlasses(i < glasses ? i : i + 1)} />
          ))}
          <button className="glass add" aria-label="Sumar vaso" onClick={() => setGlasses(glasses + 1)}>+</button>
        </div>
      </div>

      {/* Actividad del día */}
      <div className="card">
        <div className="card-title">
          <IconBubble name="flame" hue="#ff9f43" />
          <h3>Actividad</h3>
          <button className="btn ghost sm" style={{ paddingRight: 0 }} onClick={() => setTab('entreno')}>Entrenar</button>
        </div>
        {workouts.length === 0 && runs.length === 0 && !(steps && steps.steps > 0) && <div className="muted small">Sin entrenos registrados este día.</div>}
        {workouts.map((w) => (
          <div key={'w' + w.id} className="row small" style={{ padding: '6px 0' }}>
            <Ico name="dumbbell" size={18} style={{ color: 'var(--muted)' }} />
            <span className="grow">{w.name} · {w.minutes} min</span>
            <b className="num">{w.kcal} kcal</b>
          </div>
        ))}
        {runs.map((r) => (
          <div key={'r' + r.id} className="row small" style={{ padding: '6px 0' }}>
            <Ico name="run" size={18} style={{ color: 'var(--muted)' }} />
            <span className="grow">Trote · {fmtNum(r.km, 2)} km</span>
            <b className="num">{r.kcal} kcal</b>
          </div>
        ))}
        {steps && steps.steps > 0 && (
          <div className="row small" style={{ padding: '6px 0' }}>
            <Ico name="steps" size={18} style={{ color: 'var(--muted)' }} />
            <span className="grow">Pasos</span>
            <b className="num">{fmtNum(steps.steps)}</b>
          </div>
        )}
      </div>

      <p className="note">Las calorías y los nutrientes son estimaciones aproximadas.</p>

      {editing && (
        <PortionSheet
          food={editing.food}
          meal={editing.entry.meal}
          initial={{ qty: editing.entry.qty, servingLabel: editing.entry.servingLabel }}
          confirmLabel="Guardar cambios"
          onClose={() => setEditing(null)}
          onConfirm={async (r) => {
            await db.entries.update(editing.entry.id!, { qty: r.qty, servingLabel: r.servingLabel, grams: r.grams, meal: r.meal, ...r.nutr });
            setEditing(null);
            toast('Cambios guardados');
          }}
          onDelete={async () => {
            await db.entries.delete(editing.entry.id!);
            setEditing(null);
            toast('Eliminado');
          }}
        />
      )}
      {menu && <MealMenu meal={menu} date={date} entries={entries.filter((e) => e.meal === menu)} onClose={() => setMenu(null)} />}
    </div>
  );
}

function MealMenu({ meal, date, entries, onClose }: { meal: MealKey; date: string; entries: Entry[]; onClose: () => void }) {
  const label = MEALS.find((m) => m.key === meal)!.label;
  const [mode, setMode] = useState<'menu' | 'save' | 'copy'>('menu');
  const [name, setName] = useState(`${label} habitual`);
  const [from, setFrom] = useState(addDays(date, -1));
  const preview = useLiveQuery(() => db.entries.where('date').equals(from).filter((e) => e.meal === meal).toArray(), [from, meal], []);

  const save = async () => {
    await db.meals.add({
      name: name.trim() || label,
      uses: 0,
      items: entries.map(({ foodId, name, qty, servingLabel, grams, kcal, p, c, f, fiber }) => ({ foodId, name, qty, servingLabel, grams, kcal, p, c, f, fiber })),
    });
    toast('Comida frecuente guardada');
    onClose();
  };

  const copy = async () => {
    const now = Date.now();
    await db.entries.bulkAdd(preview.map(({ id: _id, ...e }, i) => ({ ...e, date, meal, createdAt: now + i })));
    toast(`${preview.length} alimentos copiados`);
    onClose();
  };

  const clear = async () => {
    if (!confirm(`¿Borrar todos los alimentos de ${label.toLowerCase()}?`)) return;
    await db.entries.bulkDelete(entries.map((e) => e.id!));
    onClose();
  };

  return (
    <Sheet title={label} onClose={onClose}>
      {mode === 'menu' && (
        <div className="list">
          <button className="item" disabled={!entries.length} style={{ opacity: entries.length ? 1 : 0.4 }} onClick={() => setMode('save')}>
            <span className="emoji">⭐</span><div className="grow">Guardar como comida frecuente</div>
          </button>
          <button className="item" onClick={() => setMode('copy')}>
            <span className="emoji">📋</span><div className="grow">Copiar de otro día</div>
          </button>
          <button className="item" disabled={!entries.length} style={{ opacity: entries.length ? 1 : 0.4 }} onClick={clear}>
            <span className="emoji">🗑️</span><div className="grow" style={{ color: 'var(--danger)' }}>Vaciar esta comida</div>
          </button>
        </div>
      )}
      {mode === 'save' && (
        <>
          <label className="small muted">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ margin: '6px 0 12px' }} />
          <div className="muted small" style={{ marginBottom: 14 }}>{entries.length} alimentos · {sumNutr(entries).kcal} kcal</div>
          <button className="btn" onClick={save}>Guardar</button>
        </>
      )}
      {mode === 'copy' && (
        <>
          <label className="small muted">Copiar {label.toLowerCase()} del día</label>
          <input type="date" value={from} max={isoDate()} onChange={(e) => setFrom(e.target.value)} style={{ margin: '6px 0 12px' }} />
          <div className="list">
            {preview.length === 0 && <div className="item muted small">Ese día no tiene alimentos en {label.toLowerCase()}.</div>}
            {preview.map((e) => (
              <div className="item" key={e.id}>
                <div className="grow ellipsis">{e.name}</div>
                <span className="small num">{e.kcal} kcal</span>
              </div>
            ))}
          </div>
          <button className="btn" disabled={!preview.length} onClick={copy}>Copiar {preview.length} alimentos</button>
        </>
      )}
    </Sheet>
  );
}
