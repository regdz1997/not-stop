import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DietType, type PlanDay, type Recipe } from '../db';
import { useApp } from '../ctx';
import { addDays, isoDate, MEALS, round1, sumNutr, weekStart, type MealKey } from '../lib/calc';
import { SEED_FOODS, searchFoods, type Food } from '../data/foods';
import { SEED_RECIPES } from '../data/recipes';
import { allowed, dayTotals, fmtFactor, mealShares, planDay, recipeNutr, recipeTags, shoppingList, swapItem, type FoodMap, type PlanOptions } from '../lib/planner';
import { logRecipe } from '../lib/recipeLog';
import { coachReply, fileToImage, friendlyError } from '../lib/ai';
import { buildCoachContext, pantryMatches } from '../lib/coachContext';
import { AlertsList } from '../components/Insights';
import { Empty, fmtDate, fmtNum, haptic, Icon, Sheet, toast, Ico } from '../components/ui';

export const DIETS: { k: DietType; label: string }[] = [
  { k: 'normal', label: 'Normal' },
  { k: 'alta_proteina', label: 'Alta en proteína' },
  { k: 'vegetariana', label: 'Vegetariana' },
  { k: 'baja_carbos', label: 'Baja en carbos' },
];

function useData() {
  const custom = useLiveQuery(() => db.recipes.toArray(), [], []);
  const customFoods = useLiveQuery(() => db.foods.toArray(), [], []);
  return useMemo(() => {
    const recipes = [...SEED_RECIPES, ...custom];
    const foods: FoodMap = new Map([...SEED_FOODS, ...customFoods].map((f) => [f.id, f]));
    return { recipes, rmap: new Map(recipes.map((r) => [r.id, r])), foods };
  }, [custom, customFoods]);
}

export default function Plan() {
  const { openSettings } = useApp();
  const [seg, setSeg] = useState<'plan' | 'recetas' | 'compras' | 'coach'>('plan');
  return (
    <div className="screen">
      <div className="topbar">
        <h1>Plan</h1>
        <button className="icon-btn" aria-label="Perfil" onClick={openSettings}><Icon.user /></button>
      </div>
      <div className="seg">
        {([['plan', 'Menú'], ['recetas', 'Recetas'], ['compras', 'Compras'], ['coach', 'Coach']] as const).map(([k, l]) => (
          <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)} style={{ fontSize: 13 }}>{l}</button>
        ))}
      </div>
      {seg === 'plan' && <PlannerTab />}
      {seg === 'recetas' && <RecipesTab />}
      {seg === 'compras' && <ShoppingTab />}
      {seg === 'coach' && <CoachTab />}
    </div>
  );
}

// ======================= Menú (planificador) =======================
function PlannerTab() {
  const { profile, setTab, setDate } = useApp();
  const { recipes, rmap, foods } = useData();
  const today = isoDate();
  const [week, setWeek] = useState(0);
  const ws = addDays(weekStart(today), week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const plans = useLiveQuery(() => db.plans.where('date').between(ws, addDays(ws, 6), true, true).toArray(), [ws], []);
  const byDate = new Map(plans.map((p) => [p.date, p]));
  const [picker, setPicker] = useState<{ date: string; meal: MealKey } | null>(null);
  const [view, setView] = useState<{ r: Recipe; factor: number; meal?: MealKey } | null>(null);
  const [printing, setPrinting] = useState(false);

  const diet = profile.dietType ?? 'normal';
  const mpd = profile.mealsPerDay ?? 4;
  const opts = (avoid: Set<string>): PlanOptions => ({ targets: profile, diet, excluded: profile.excluded ?? [], mealsPerDay: mpd, recipes, foods, avoid, seed: String(Date.now()) });

  const generate = async (only?: string) => {
    const targets = only ? [only] : days.filter((d) => d >= today);
    if (!targets.length) return toast('Esa semana ya pasó');
    if (targets.some((d) => byDate.has(d)) && !confirm(only ? '¿Reemplazar el menú de este día?' : '¿Reemplazar el menú de los días que ya tienen plan?')) return;
    const avoid = new Set<string>();
    const out = targets.map((d) => planDay(d, opts(avoid)));
    await db.plans.bulkPut(out);
    haptic();
    toast(only ? 'Menú del día listo' : `Menú de ${out.length} días listo`);
  };

  const swap = async (day: PlanDay, meal: MealKey, i: number) => {
    await db.plans.put(swapItem(day, meal, i, opts(new Set())));
    haptic();
  };
  const remove = async (day: PlanDay, meal: MealKey, i: number) => {
    await db.plans.put({ ...day, meals: { ...day.meals, [meal]: (day.meals[meal] ?? []).filter((_, k) => k !== i) } });
  };
  const addTo = async (date: string, meal: MealKey, r: Recipe) => {
    const day = byDate.get(date) ?? { date, meals: {} };
    const share = mealShares(mpd)[meal] ?? 0.15;
    const kcal = recipeNutr(r, foods).kcal;
    const factor = Math.min(2.5, Math.max(0.5, Math.round(((profile.kcal * share) / Math.max(1, kcal)) * 20) / 20));
    await db.plans.put({ ...day, meals: { ...day.meals, [meal]: [...(day.meals[meal] ?? []), { recipeId: r.id, factor }] } });
    setPicker(null);
  };
  const logDay = async (day: PlanDay) => {
    let n = 0;
    for (const [meal, items] of Object.entries(day.meals) as [MealKey, PlanDay['meals']['desayuno']][]) {
      for (const it of items ?? []) {
        const r = rmap.get(it.recipeId);
        if (r) { await logRecipe(r, it.factor, day.date, meal, foods); n++; }
      }
    }
    toast(`${n} platos registrados en el diario`);
    setDate(day.date);
    setTab('diario');
  };

  const setPref = async (patch: Partial<typeof profile>) => db.profile.update(1, patch);

  return (
    <>
      <div className="card col">
        <div className="chips">
          {DIETS.map((d) => <button key={d.k} className={'chip' + (diet === d.k ? ' on' : '')} onClick={() => setPref({ dietType: d.k })}>{d.label}</button>)}
        </div>
        <div className="row between small">
          <span className="muted">Comidas al día</span>
          <div className="seg" style={{ margin: 0, width: 150 }}>
            {[3, 4, 5].map((n) => <button key={n} className={mpd === n ? 'on' : ''} onClick={() => setPref({ mealsPerDay: n as 3 | 4 | 5 })}>{n}</button>)}
          </div>
        </div>
        {(profile.excluded ?? []).length > 0 && <div className="tiny muted">Sin: {(profile.excluded ?? []).join(', ')} (cámbialo en Perfil)</div>}
        <button className="btn" onClick={() => generate()}><Ico name="sparkle" />Generar menú de la semana</button>
      </div>

      <div className="row between" style={{ margin: '4px 0 8px' }}>
        <button className="btn ghost sm" onClick={() => setWeek(week - 1)}>‹ Anterior</button>
        <b className="small">{week === 0 ? 'Esta semana' : week === 1 ? 'Próxima semana' : fmtDate(ws, { day: 'numeric', month: 'short' })}</b>
        <button className="btn ghost sm" onClick={() => setWeek(week + 1)}>Siguiente ›</button>
      </div>

      {plans.length > 0 && <button className="btn secondary sm" style={{ width: '100%', marginBottom: 10 }} onClick={() => setPrinting(true)}><Ico name="pdf" />Exportar menú a PDF</button>}

      {days.filter((d) => d >= today || byDate.has(d)).map((d) => {
        const day = byDate.get(d);
        const tot = day ? dayTotals(day, rmap, foods) : null;
        return (
          <div className="card" key={d} style={{ opacity: d < today ? 0.6 : 1 }}>
            <div className="row between">
              <b>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}{d === today ? ' · hoy' : ''}</b>
              <button className="btn ghost sm" onClick={() => generate(d)}>{day ? 'Rehacer' : 'Generar'}</button>
            </div>
            {tot && (
              <div className="tiny muted num" style={{ margin: '2px 0 8px' }}>
                {tot.kcal} / {profile.kcal} kcal · P {Math.round(tot.p)}/{profile.protein} · C {Math.round(tot.c)} · G {Math.round(tot.f)}
              </div>
            )}
            {MEALS.filter((m) => m.key in mealShares(mpd) || day?.meals[m.key]?.length).map((m) => (
              <div key={m.key} style={{ marginTop: 6 }}>
                <div className="row between">
                  <span className="small muted" style={{ fontWeight: 600 }}>{m.label}</span>
                  <button className="btn ghost sm" style={{ minHeight: 28, padding: 0 }} onClick={() => setPicker({ date: d, meal: m.key })}>＋</button>
                </div>
                {(day?.meals[m.key] ?? []).map((it, i) => {
                  const r = rmap.get(it.recipeId);
                  if (!r) return null;
                  const n = recipeNutr(r, foods, it.factor);
                  return (
                    <div className="row" key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                      <button className="grow row" style={{ textAlign: 'left', gap: 8 }} onClick={() => setView({ r, factor: it.factor, meal: m.key })}>
                        <span style={{ fontSize: 22 }}>{r.emoji}</span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <div className="small ellipsis">{r.name}{it.extra ? ' (refuerzo)' : ''}</div>
                          <div className="tiny muted num">{fmtFactor(it.factor)} · {n.kcal} kcal · P {Math.round(n.p)}</div>
                        </span>
                      </button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Cambiar plato" onClick={() => day && swap(day, m.key, i)}><Ico name="refresh" size={17} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Quitar" onClick={() => day && remove(day, m.key, i)}><Ico name="close" size={15} /></button>
                    </div>
                  );
                })}
              </div>
            ))}
            {day && Object.values(day.meals).some((x) => x?.length) && (
              <button className="btn secondary sm" style={{ width: '100%', marginTop: 10 }} onClick={() => logDay(day)}><Ico name="check" />Registrar este día en el diario</button>
            )}
          </div>
        );
      })}
      <p className="note">El menú se arma en tu teléfono, sin IA y sin conexión, con recetas que cumplen tus calorías y proteína. Valores aproximados.</p>

      {picker && (
        <RecipePicker meal={picker.meal} recipes={recipes} foods={foods} onClose={() => setPicker(null)} onPick={(r) => addTo(picker.date, picker.meal, r)} />
      )}
      {view && <RecipeSheet recipe={view.r} initialFactor={view.factor} meal={view.meal} onClose={() => setView(null)} />}
      {printing && <PrintPlan days={days.map((d) => byDate.get(d)).filter(Boolean) as PlanDay[]} rmap={rmap} foods={foods} onDone={() => setPrinting(false)} />}
    </>
  );
}

function PrintPlan({ days, rmap, foods, onDone }: { days: PlanDay[]; rmap: Map<string, Recipe>; foods: FoodMap; onDone: () => void }) {
  const { profile } = useApp();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    // Se imprime una sola vez al abrir; la vista queda visible hasta tocar «Cerrar».
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  const shop = shoppingList(days, rmap, foods);
  return createPortal(
    <div id="print-area">
      <button className="btn no-print" style={{ position: 'fixed', top: 'calc(var(--safe-top) + 10px)', right: 10, width: 'auto', zIndex: 2 }} onClick={() => doneRef.current()}>Cerrar</button>
      <h1>Menú semanal · Not Stop</h1>
      <p>Meta diaria: {profile.kcal} kcal · Proteína {profile.protein} g · Carbos {profile.carbs} g · Grasa {profile.fat} g</p>
      {days.map((d) => {
        const t = dayTotals(d, rmap, foods);
        return (
          <section key={d.date}>
            <h2>{fmtDate(d.date)} — {t.kcal} kcal, P {Math.round(t.p)} g</h2>
            <table>
              <tbody>
                {MEALS.map((m) => (d.meals[m.key] ?? []).map((it, i) => {
                  const r = rmap.get(it.recipeId);
                  if (!r) return null;
                  const n = recipeNutr(r, foods, it.factor);
                  return (
                    <tr key={m.key + i}>
                      <td>{i === 0 ? m.label : ''}</td>
                      <td><b>{r.name}</b> ({fmtFactor(it.factor)})<br /><small>{r.ingredients.map((g) => `${foods.get(g.foodId)?.name} ${Math.round(g.grams * it.factor)} g`).join(', ')}</small></td>
                      <td>{n.kcal} kcal<br /><small>P {Math.round(n.p)} · C {Math.round(n.c)} · G {Math.round(n.f)}</small></td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </section>
        );
      })}
      <h2>Lista de compras</h2>
      {Object.entries(shop).map(([sec, items]) => (
        <div key={sec}>
          <h3>{sec}</h3>
          <ul>{items.map((i) => <li key={i.foodId}>☐ {i.name}: {i.grams} g {i.approx}</li>)}</ul>
        </div>
      ))}
      <p><small>Valores aproximados. Generado por Not Stop.</small></p>
    </div>,
    document.body,
  );
}

function RecipePicker({ meal, recipes, foods, onPick, onClose }: { meal: MealKey; recipes: Recipe[]; foods: FoodMap; onPick: (r: Recipe) => void; onClose: () => void }) {
  const { profile } = useApp();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const list = recipes.filter((r) => (all || allowed(r, foods, profile.dietType ?? 'normal', profile.excluded ?? [], meal)) && r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title={`Agregar a ${MEALS.find((m) => m.key === meal)!.label.toLowerCase()}`} onClose={onClose}>
      <input type="search" placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <label className="row small muted" style={{ marginBottom: 8 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} style={{ width: 18, height: 18 }} /> Mostrar todas (ignorar dieta y comida)</label>
      <div className="list">
        {list.length === 0 && <div className="item muted small">No hay recetas que encajen. Activa «Mostrar todas» o crea una.</div>}
        {list.map((r) => {
          const n = recipeNutr(r, foods);
          return (
            <button className="item" key={r.id} onClick={() => onPick(r)}>
              <span className="emoji">{r.emoji}</span>
              <div className="grow"><div className="ellipsis">{r.name}</div><div className="tiny muted num">{n.kcal} kcal · P {Math.round(n.p)} g por porción</div></div>
              <Ico name="plus" size={20} style={{ color: 'var(--accent)' }} />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ======================= Recetas =======================
function RecipesTab() {
  const { recipes, foods } = useData();
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState<MealKey | 'todas'>('todas');
  const [tag, setTag] = useState<string | null>(null);
  const [view, setView] = useState<Recipe | null>(null);
  const [edit, setEdit] = useState<Recipe | null>(null);
  const list = recipes.filter((r) => (meal === 'todas' || r.meals.includes(meal)) && (!tag || recipeTags(r, foods).includes(tag)) && r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input type="search" placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="chips" style={{ marginBottom: 6 }}>
        {([['todas', 'Todas'], ['desayuno', 'Desayuno'], ['almuerzo', 'Almuerzo/cena'], ['snacks', 'Snacks']] as const).map(([k, l]) => (
          <button key={k} className={'chip' + (meal === k ? ' on' : '')} onClick={() => setMeal(k)}>{l}</button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {['Alta en proteína', 'Vegetariana', 'Baja en carbos', 'Rápida'].map((t) => (
          <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? null : t)}>{t}</button>
        ))}
      </div>
      <button className="btn secondary" style={{ marginBottom: 10 }} onClick={() => setEdit({ id: 'cr-' + Date.now().toString(36), name: '', emoji: '🍽️', meals: ['almuerzo', 'cena'], servings: 1, minutes: 20, ingredients: [], steps: [], custom: true })}><Ico name="edit" />Crear receta propia</button>
      <div className="list">
        {list.length === 0 && <div className="item muted small">Sin recetas con esos filtros.</div>}
        {list.map((r) => {
          const n = recipeNutr(r, foods);
          return (
            <button className="item" key={r.id} onClick={() => setView(r)}>
              <span className="emoji">{r.emoji}</span>
              <div className="grow">
                <div className="ellipsis">{r.name}{r.custom ? ' ✏️' : ''}</div>
                <div className="tiny muted num">{n.kcal} kcal · P {Math.round(n.p)} · C {Math.round(n.c)} · G {Math.round(n.f)} · {r.minutes} min</div>
              </div>
            </button>
          );
        })}
      </div>
      {view && <RecipeSheet recipe={view} onClose={() => setView(null)} onEdit={view.custom ? () => { setEdit(view); setView(null); } : undefined} />}
      {edit && <RecipeEditor recipe={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

export function RecipeSheet({ recipe: r, initialFactor = 1, meal: initialMeal, onClose, onEdit }: { recipe: Recipe; initialFactor?: number; meal?: MealKey; onClose: () => void; onEdit?: () => void }) {
  const { profile, date } = useApp();
  const { foods } = useData();
  const [factor, setFactor] = useState(initialFactor);
  const [meal, setMeal] = useState<MealKey>(initialMeal ?? r.meals[0]);
  const n = recipeNutr(r, foods, factor);
  const share = mealShares(profile.mealsPerDay ?? 4)[meal] ?? 0.15;
  const fit = () => {
    const k = recipeNutr(r, foods).kcal;
    setFactor(Math.min(3, Math.max(0.25, Math.round(((profile.kcal * share) / Math.max(1, k)) * 20) / 20)));
    haptic();
  };
  return (
    <Sheet title={`${r.emoji} ${r.name}`} onClose={onClose} right={onEdit ? <button className="btn ghost sm" onClick={onEdit}>Editar</button> : undefined}>
      <div className="tiny muted" style={{ marginBottom: 8 }}>{recipeTags(r, foods).join(' · ')} · {r.minutes} min</div>
      <div className="card row" style={{ justifyContent: 'space-around' }}>
        <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{n.kcal}</b><span>kcal</span></div>
        <div className="kpi"><b className="num" style={{ color: 'var(--prot)' }}>{Math.round(n.p)} g</b><span>Proteína</span></div>
        <div className="kpi"><b className="num" style={{ color: 'var(--carb)' }}>{Math.round(n.c)} g</b><span>Carbos</span></div>
        <div className="kpi"><b className="num" style={{ color: 'var(--fat)' }}>{Math.round(n.f)} g</b><span>Grasa</span></div>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => setFactor(Math.max(0.25, round1(factor - 0.25)))} aria-label="Menos">−</button>
        <div className="grow center bold num">{fmtFactor(factor)}</div>
        <button className="icon-btn" onClick={() => setFactor(Math.min(4, round1(factor + 0.25)))} aria-label="Más">＋</button>
      </div>
      <button className="btn secondary sm" style={{ width: '100%', marginBottom: 12 }} onClick={fit}><Ico name="scale" />Ajustar porción a mi meta de {MEALS.find((m) => m.key === meal)!.label.toLowerCase()} ({Math.round(profile.kcal * share)} kcal)</button>
      <div className="section-title">Ingredientes</div>
      <div className="list">
        {r.ingredients.map((i, k) => {
          const f = foods.get(i.foodId);
          return <div className="item small" key={k}><div className="grow">{f?.name ?? i.foodId}</div><b className="num">{Math.round((i.grams * factor) / r.servings)} g</b></div>;
        })}
      </div>
      {r.steps.length > 0 && (
        <>
          <div className="section-title">Preparación</div>
          <div className="card small">{r.steps.map((s, k) => <p key={k} style={{ margin: '0 0 8px' }}><b>{k + 1}.</b> {s}</p>)}</div>
        </>
      )}
      <div className="chips" style={{ margin: '6px 0 12px' }}>
        {MEALS.map((m) => <button key={m.key} className={'chip' + (meal === m.key ? ' on' : '')} onClick={() => setMeal(m.key)}>{m.icon} {m.label}</button>)}
      </div>
      <button className="btn" onClick={async () => { await logRecipe(r, factor, date, meal, foods); haptic(); toast('Agregado al diario'); onClose(); }}>Agregar al diario ({fmtDate(date, { day: 'numeric', month: 'short' })})</button>
    </Sheet>
  );
}

function RecipeEditor({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { foods } = useData();
  const allFoods = useMemo(() => [...foods.values()], [foods]);
  const [r, setR] = useState<Recipe>(recipe);
  const [q, setQ] = useState('');
  const [stepsTxt, setStepsTxt] = useState(recipe.steps.join('\n'));
  const results = q.trim() ? searchFoods(allFoods, q).slice(0, 8) : [];
  const n = recipeNutr(r, foods);
  const ok = r.name.trim() && r.ingredients.length > 0 && r.meals.length > 0;
  const save = async () => {
    await db.recipes.put({ ...r, name: r.name.trim(), steps: stepsTxt.split('\n').map((s) => s.trim()).filter(Boolean), custom: true });
    toast('Receta guardada');
    onClose();
  };
  return (
    <Sheet full title={recipe.name ? 'Editar receta' : 'Nueva receta'} onClose={onClose} right={<button className="btn sm" disabled={!ok} onClick={save}>Guardar</button>}>
      <div className="row">
        <input value={r.emoji} onChange={(e) => setR({ ...r, emoji: e.target.value.slice(0, 2) || '🍽️' })} style={{ width: 60, textAlign: 'center', fontSize: 22 }} aria-label="Emoji" />
        <input value={r.name} placeholder="Nombre de la receta" onChange={(e) => setR({ ...r, name: e.target.value })} />
      </div>
      <div className="chips" style={{ margin: '10px 0' }}>
        {MEALS.map((m) => {
          const on = r.meals.includes(m.key);
          return <button key={m.key} className={'chip' + (on ? ' on' : '')} onClick={() => setR({ ...r, meals: on ? r.meals.filter((x) => x !== m.key) : [...r.meals, m.key] })}>{m.label}</button>;
        })}
      </div>
      <div className="row">
        <div className="grow"><label className="small muted">Porciones que rinde</label><input inputMode="numeric" value={r.servings} onChange={(e) => setR({ ...r, servings: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
        <div className="grow"><label className="small muted">Minutos</label><input inputMode="numeric" value={r.minutes} onChange={(e) => setR({ ...r, minutes: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
      </div>
      <div className="section-title">Ingredientes (total de la receta)</div>
      <div className="list">
        {r.ingredients.map((i, k) => (
          <div className="item small" key={k}>
            <div className="grow ellipsis">{foods.get(i.foodId)?.name ?? i.foodId}</div>
            <input inputMode="decimal" value={i.grams} onChange={(e) => setR({ ...r, ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, grams: Math.max(0, parseFloat(e.target.value) || 0) } : x)) })} style={{ width: 80, textAlign: 'center', padding: '6px' }} aria-label="Gramos" />
            <span className="muted">g</span>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, j) => j !== k) })} aria-label="Quitar">×</button>
          </div>
        ))}
      </div>
      <input type="search" placeholder="＋ Buscar ingrediente" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <div className="list" style={{ marginTop: 6 }}>
          {results.map((f) => (
            <button className="item small" key={f.id} onClick={() => { setR({ ...r, ingredients: [...r.ingredients, { foodId: f.id, grams: f.servings[0].g === 1 ? 100 : f.servings[0].g }] }); setQ(''); }}>
              <div className="grow ellipsis">{f.name}</div><Ico name="plus" size={20} style={{ color: 'var(--accent)' }} />
            </button>
          ))}
        </div>
      )}
      <div className="card small num" style={{ marginTop: 10 }}>Por porción: <b>{n.kcal} kcal</b> · P {Math.round(n.p)} · C {Math.round(n.c)} · G {Math.round(n.f)}</div>
      <label className="small muted">Pasos (uno por línea)</label>
      <textarea rows={5} value={stepsTxt} onChange={(e) => setStepsTxt(e.target.value)} style={{ marginTop: 6 }} />
      {recipe.name && (
        <button className="btn danger" style={{ marginTop: 14 }} onClick={async () => { if (confirm('¿Borrar esta receta?')) { await db.recipes.delete(recipe.id); onClose(); } }}>Borrar receta</button>
      )}
    </Sheet>
  );
}

// ======================= Compras =======================
function ShoppingTab() {
  const { rmap, foods } = useData();
  const today = isoDate();
  const [week, setWeek] = useState(0);
  const ws = addDays(weekStart(today), week * 7);
  const plans = useLiveQuery(() => db.plans.where('date').between(week === 0 ? today : ws, addDays(ws, 6), true, true).toArray(), [ws, week], []);
  const key = 'shop-' + ws;
  const state = useLiveQuery(() => db.kv.get(key), [key])?.value as { checked: string[]; extra: string[] } | undefined;
  const checked = new Set(state?.checked ?? []);
  const extra = state?.extra ?? [];
  const [newItem, setNewItem] = useState('');
  const list = useMemo(() => shoppingList(plans, rmap, foods), [plans, rmap, foods]);
  const save = (c: Set<string>, e: string[]) => db.kv.put({ key, value: { checked: [...c], extra: e } });
  const toggle = (id: string) => {
    const c = new Set(checked);
    c.has(id) ? c.delete(id) : c.add(id);
    haptic();
    save(c, extra);
  };
  const text = () =>
    ['🛒 Lista de compras – Not Stop', ...Object.entries(list).flatMap(([s, items]) => [`\n${s}:`, ...items.map((i) => `${checked.has(i.foodId) ? '✓' : '•'} ${i.name} – ${i.grams} g ${i.approx}`)]), ...(extra.length ? ['\nOtros:', ...extra.map((x) => `${checked.has('x:' + x) ? '✓' : '•'} ${x}`)] : [])].join('\n');
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: text() });
      else { await navigator.clipboard.writeText(text()); toast('Lista copiada'); }
    } catch { /* cancelado */ }
  };
  const total = Object.values(list).flat().length + extra.length;
  return (
    <>
      <div className="seg">
        <button className={week === 0 ? 'on' : ''} onClick={() => setWeek(0)}>Esta semana</button>
        <button className={week === 1 ? 'on' : ''} onClick={() => setWeek(1)}>Próxima</button>
      </div>
      {Object.keys(list).length === 0 ? (
        <Empty icon="🛒" title="Sin menú para estas fechas" text="Genera el menú en «Menú» y la lista se arma sola." />
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="small muted">{[...checked].length} de {total} marcados</span>
            <button className="btn ghost sm" onClick={share}><Ico name="share" />Compartir</button>
          </div>
          {Object.entries(list).map(([sec, items]) => (
            <div key={sec}>
              <div className="section-title">{sec}</div>
              <div className="list">
                {items.map((i) => (
                  <button className="item" key={i.foodId} onClick={() => toggle(i.foodId)}>
                    <span className={'check' + (checked.has(i.foodId) ? ' on' : '')} style={{ width: 28, height: 28 }}>✓</span>
                    <div className="grow" style={{ textDecoration: checked.has(i.foodId) ? 'line-through' : undefined, opacity: checked.has(i.foodId) ? 0.5 : 1 }}>
                      {i.name}
                      <div className="tiny muted">{i.grams >= 1000 ? `${fmtNum(i.grams / 1000, 2)} kg` : `${i.grams} g`} {i.approx}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <div className="section-title">Otros productos</div>
      <div className="list">
        {extra.map((x) => (
          <div className="item" key={x}>
            <button className={'check' + (checked.has('x:' + x) ? ' on' : '')} style={{ width: 28, height: 28 }} onClick={() => toggle('x:' + x)}>✓</button>
            <div className="grow">{x}</div>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => save(checked, extra.filter((e) => e !== x))} aria-label="Quitar">×</button>
          </div>
        ))}
      </div>
      <div className="row">
        <input value={newItem} placeholder="Ej.: papel higiénico" onChange={(e) => setNewItem(e.target.value)} />
        <button className="btn sm" disabled={!newItem.trim()} onClick={() => { save(checked, [...extra, newItem.trim()]); setNewItem(''); }}>Añadir</button>
      </div>
      {checked.size > 0 && <button className="btn ghost" onClick={() => save(new Set(), extra)}>Desmarcar todo</button>}
    </>
  );
}

// ======================= Coach =======================
const QUICK = ['¿Qué cocino para la cena con lo que me queda hoy?', '¿Por qué no bajo de peso esta semana?', '¿Cómo voy hoy?', 'Dame un snack alto en proteína', '¿Cómo ajusto mis comidas los días de pierna?'];

function CoachTab() {
  const { profile } = useApp();
  const { recipes, foods } = useData();
  const msgs = useLiveQuery(() => db.chat.orderBy('at').toArray(), [], []);
  const [text, setText] = useState('');
  const [img, setImg] = useState<{ base64: string; mediaType: 'image/jpeg'; dataUrl: string } | null>(null);
  const [stream, setStream] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [pantry, setPantry] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const hasKey = !!profile.aiKey?.trim();
  const todayEntries = useLiveQuery(() => db.entries.where('date').equals(isoDate()).toArray(), [], []);
  const burned = useLiveQuery(async () => {
    const d = isoDate();
    const [w, r] = await Promise.all([db.workouts.where('date').equals(d).toArray(), db.runs.where('date').equals(d).toArray()]);
    return w.reduce((a, x) => a + x.kcal, 0) + r.reduce((a, x) => a + x.kcal, 0);
  }, [], 0);
  const remaining = profile.kcal - sumNutr(todayEntries).kcal + burned;

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [msgs.length, stream]);

  const send = async (q: string) => {
    const question = q.trim();
    if ((!question && !img) || stream !== null) return;
    setErr('');
    const image = img;
    await db.chat.add({ role: 'user', text: question, at: Date.now(), image: image?.dataUrl });
    setText('');
    setImg(null);
    setStream('');
    try {
      const history = [...msgs, { role: 'user' as const, text: question, image: image?.dataUrl }].map((m) => ({
        role: m.role,
        text: m.text,
        image: m.image ? { base64: m.image.split(',')[1], mediaType: 'image/jpeg' as const } : undefined,
      }));
      // Solo la última imagen viaja completa; las anteriores se sustituyen por texto para ahorrar.
      history.forEach((h, i) => { if (i < history.length - 1 && h.image) { h.image = undefined; h.text = (h.text || '') + ' [foto enviada antes]'; } });
      const ctx = await buildCoachContext(profile);
      let acc = '';
      const final = await coachReply({ apiKey: profile.aiKey, model: profile.aiModel }, ctx, history, (d) => { acc += d; setStream(acc); });
      await db.chat.add({ role: 'assistant', text: final || acc, at: Date.now() });
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setStream(null);
    }
  };

  const matches = pantryMatches(pantry, recipes, foods, remaining);

  return (
    <>
      <AlertsList profile={profile} />
      {!hasKey && (
        <div className="card small">
          <b>🤖 El chat del coach usa tu clave de IA</b> (Perfil → Inteligencia artificial). Sin clave tienes igualmente las alertas, el menú automático y este buscador de recetas:
        </div>
      )}
      <div className="card col">
        <b>🧺 ¿Qué cocino con lo que tengo?</b>
        <input value={pantry} placeholder="Ej.: huevos, arroz, tomate, aguacate" onChange={(e) => setPantry(e.target.value)} />
        <div className="tiny muted">Te quedan {remaining} kcal hoy. Funciona sin internet.</div>
        {pantry.trim() && matches.length === 0 && <div className="small muted">Ninguna receta usa esos ingredientes. {hasKey ? 'Pregúntale al coach abajo.' : ''}</div>}
        {matches.map((m) => (
          <RecipeMatch key={m.r.id} r={m.r} factor={m.factor} have={m.have} total={m.r.ingredients.length} missing={m.missing} />
        ))}
        {hasKey && pantry.trim() && <button className="btn secondary sm" onClick={() => send(`Tengo: ${pantry}. ¿Qué cocino que encaje en lo que me queda hoy?`)}><Ico name="sparkle" />Preguntar al coach con estos ingredientes</button>}
      </div>

      {hasKey && (
        <>
          <div className="row between">
            <div className="section-title">Chat</div>
            {msgs.length > 0 && <button className="btn ghost sm" onClick={async () => { if (confirm('¿Borrar la conversación?')) await db.chat.clear(); }}>Borrar</button>}
          </div>
          {msgs.length === 0 && (
            <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
              {QUICK.map((q) => <button key={q} className="chip" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          <div className="col" style={{ gap: 8 }}>
            {msgs.map((m) => <Bubble key={m.id} role={m.role} text={m.text} image={m.image} />)}
            {stream !== null && <Bubble role="assistant" text={stream || '…'} />}
          </div>
          {err && <div className="card small" style={{ color: 'var(--danger)', marginTop: 8 }}>{err}</div>}
          <div ref={endRef} />
          {img && <img src={img.dataUrl} alt="Adjunto" style={{ width: 90, borderRadius: 10, marginTop: 10 }} />}
          <div className="row" style={{ marginTop: 10, position: 'sticky', bottom: 'calc(90px + var(--safe-bot))' }}>
            <label className="icon-btn" aria-label="Adjuntar foto">📷<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImg(await fileToImage(f, 1024)); }} /></label>
            <input value={text} placeholder="Pregúntale a tu coach…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(text); }} />
            <button className="btn sm" disabled={stream !== null || (!text.trim() && !img)} onClick={() => send(text)}>{stream !== null ? '…' : 'Enviar'}</button>
          </div>
          <p className="note">El coach ve un resumen de tus registros de las últimas 2 semanas. No sustituye a un profesional de la salud.</p>
        </>
      )}
    </>
  );
}

function RecipeMatch({ r, factor, have, total, missing }: { r: Recipe; factor: number; have: number; total: number; missing: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="item" style={{ background: 'var(--card2)', borderRadius: 12 }} onClick={() => setOpen(true)}>
        <span className="emoji">{r.emoji}</span>
        <div className="grow"><div className="small ellipsis">{r.name}</div><div className="tiny muted">Tienes {have}/{total}{missing.length ? ` · falta: ${missing.slice(0, 3).join(', ')}` : ''}</div></div>
      </button>
      {open && <RecipeSheet recipe={r} initialFactor={factor} onClose={() => setOpen(false)} />}
    </>
  );
}

function Bubble({ role, text, image }: { role: 'user' | 'assistant'; text: string; image?: string }) {
  const mine = role === 'user';
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', background: mine ? 'var(--accent)' : 'var(--card)', color: mine ? '#fff' : 'var(--text)', borderRadius: 16, padding: '10px 13px', whiteSpace: 'pre-wrap', fontSize: 15, userSelect: 'text', WebkitUserSelect: 'text' }}>
      {image && <img src={image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 6 }} />}
      {text.replace(/\*\*(.+?)\*\*/g, '$1')}
    </div>
  );
}

export type { Food };
