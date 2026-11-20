import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../ctx';
import { MEALS, type MealKey } from '../lib/calc';
import { FOOD_CATS, searchFoods, type Food, type Serving } from '../data/foods';
import { Empty, fmtNum, FoodBubble, haptic, Ico, IconBubble, Sheet, toast, type IconName } from '../components/ui';
import { CAT_STYLE, catHue, foodEmoji } from '../data/emoji';
import { PortionSheet, useFoods, type PortionResult } from '../components/Portion';
import { analyzeFood, fileToImage, friendlyError } from '../lib/ai';
import { searchOFF } from '../lib/off';
import AILog, { type AIMode } from './AILog';
import Barcode from './Barcode';
import Compare from './Compare';

type View = 'buscar' | 'recientes' | 'favoritos' | 'frecuentes' | 'mios';

const QUICK: { k: 'foto' | 'voz' | 'texto' | 'scan' | 'compare'; label: string; icon: IconName; hue: string }[] = [
  { k: 'foto', label: 'Foto', icon: 'camera', hue: '#4d8dff' },
  { k: 'voz', label: 'Voz', icon: 'mic', hue: '#ff5c7a' },
  { k: 'texto', label: 'Describir', icon: 'chat', hue: '#7a6bff' },
  { k: 'scan', label: 'Código', icon: 'barcode', hue: '#3dd6a4' },
  { k: 'compare', label: 'Comparar', icon: 'compare', hue: '#ffb547' },
];

export default function AddFood({ meal: initialMeal, onClose }: { meal: MealKey; onClose: () => void }) {
  const { date } = useApp();
  const foods = useFoods();
  const [meal, setMeal] = useState<MealKey>(initialMeal);
  const [view, setView] = useState<View>('buscar');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [picked, setPicked] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState(0);
  const [ai, setAi] = useState<AIMode | null>(null);
  const [scan, setScan] = useState(false);
  const [compare, setCompare] = useState(false);
  const [online, setOnline] = useState<{ q: string; list: Food[]; busy: boolean; err: string } | null>(null);
  const searchOnline = async () => {
    const term = q.trim();
    setOnline({ q: term, list: [], busy: true, err: '' });
    try {
      const list = await searchOFF(term);
      setOnline({ q: term, list, busy: false, err: list.length ? '' : 'Sin resultados en Open Food Facts.' });
    } catch {
      setOnline({ q: term, list: [], busy: false, err: navigator.onLine ? 'Open Food Facts no respondió. Intenta de nuevo.' : 'Sin conexión a internet.' });
    }
  };

  const recents = useLiveQuery(async () => {
    const last = await db.entries.orderBy('createdAt').reverse().limit(300).toArray();
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const e of last) if (!seen.has(e.foodId)) { seen.add(e.foodId); ids.push(e.foodId); }
    return ids.slice(0, 25);
  }, [], []);
  const favs = useLiveQuery(() => db.favorites.toArray(), [], []);
  const saved = useLiveQuery(() => db.meals.orderBy('name').toArray(), [], []);

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const counts = useMemo(() => foods.reduce<Record<string, number>>((a, f) => ((a[f.cat] = (a[f.cat] ?? 0) + 1), a), {}), [foods]);

  const list: Food[] = useMemo(() => {
    if (q.trim()) return searchFoods(foods, q).slice(0, 80);
    if (view === 'recientes') return recents.map((id) => byId.get(id)).filter(Boolean) as Food[];
    if (view === 'favoritos') return favs.map((f) => byId.get(f.foodId)).filter(Boolean) as Food[];
    if (view === 'mios') return foods.filter((f) => f.custom);
    if (cat) return foods.filter((f) => f.cat === cat).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return [];
  }, [q, view, cat, foods, recents, favs, byId]);

  const add = async (food: Food, r: PortionResult) => {
    await db.entries.add({ date, meal: r.meal, foodId: food.id, name: food.name, qty: r.qty, servingLabel: r.servingLabel, grams: r.grams, ...r.nutr, createdAt: Date.now() });
    setPicked(null);
    setAdded((n) => n + 1);
    toast(`${food.name} agregado a ${MEALS.find((m) => m.key === r.meal)!.label.toLowerCase()}`);
  };

  const addSaved = async (id: number) => {
    const m = saved.find((s) => s.id === id)!;
    const now = Date.now();
    await db.entries.bulkAdd(m.items.map((it, i) => ({ ...it, date, meal, createdAt: now + i })));
    await db.meals.update(id, { uses: (m.uses ?? 0) + 1 });
    haptic();
    toast(`«${m.name}» agregada`);
    setAdded((n) => n + m.items.length);
  };

  const views: [View, string][] = [['buscar', 'Buscar'], ['recientes', 'Recientes'], ['favoritos', 'Favoritos'], ['frecuentes', 'Frecuentes'], ['mios', 'Mis alimentos']];

  return (
    <Sheet title="Agregar alimento" onClose={onClose} full right={added > 0 ? <button className="btn sm" onClick={onClose}>Listo</button> : null}>
      <div className="chips" style={{ marginBottom: 10 }}>
        {MEALS.map((m) => (
          <button key={m.key} className={'chip' + (meal === m.key ? ' on' : '')} onClick={() => setMeal(m.key)}>{m.icon} {m.label}</button>
        ))}
      </div>
      <input type="search" placeholder="Buscar entre 870+ alimentos" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {!q && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
          {QUICK.map((x) => (
            <button key={x.k} className="tap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}
              onClick={() => (x.k === 'scan' ? setScan(true) : x.k === 'compare' ? setCompare(true) : setAi(x.k))}>
              <IconBubble name={x.icon} hue={x.hue} size="lg" />
              {x.label}
            </button>
          ))}
        </div>
      )}
      {!q && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {views.map(([k, l]) => (
            <button key={k} className={'chip' + (view === k ? ' on' : '')} onClick={() => { setView(k); setCat(null); }}>{l}</button>
          ))}
        </div>
      )}

      {!q && view === 'buscar' && !cat && (
        <>
          <div className="section-title">Explorar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {FOOD_CATS.filter((c) => counts[c]).map((c) => (
              <button key={c} className="tap row" style={{ background: 'var(--s1)', borderRadius: 16, padding: 10, boxShadow: 'var(--lift)', textAlign: 'left' }} onClick={() => setCat(c)}>
                <FoodBubble emoji={CAT_STYLE[c]?.emoji ?? '🍽️'} hue={catHue(c)} />
                <div className="grow"><div className="small bold ellipsis">{c}</div><div className="tiny muted num">{counts[c]}</div></div>
              </button>
            ))}
          </div>
          <button className="btn secondary" style={{ marginTop: 14 }} onClick={() => setCreating(true)}><Ico name="edit" /> Crear alimento propio</button>
          <p className="note">Valores aproximados por 100 g de tablas genéricas. Para productos de marca usa el código de barras.</p>
        </>
      )}

      {cat && !q && (
        <button className="btn ghost sm" style={{ paddingLeft: 0, marginBottom: 6 }} onClick={() => setCat(null)}>‹ {cat}</button>
      )}

      {view === 'frecuentes' && !q ? (
        saved.length === 0 ? (
          <Empty icon="⭐" title="Sin comidas frecuentes" text="En el Diario, toca ⋯ en una comida y elige «Guardar como comida frecuente»." />
        ) : (
          <div className="list">
            {saved.map((m) => {
              const kcal = m.items.reduce((a, i) => a + i.kcal, 0);
              return (
                <div className="item" key={m.id}>
                  <IconBubble name="star" hue="#ffb547" />
                  <div className="grow">
                    <div className="ellipsis bold">{m.name}</div>
                    <div className="muted small ellipsis">{m.items.map((i) => i.name).join(', ')}</div>
                    <div className="small num">{kcal} kcal</div>
                  </div>
                  <button className="icon-btn" aria-label="Borrar" onClick={async () => { if (confirm(`¿Borrar «${m.name}»?`)) await db.meals.delete(m.id!); }}>🗑</button>
                  <button className="icon-btn" aria-label="Agregar" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => addSaved(m.id!)}>＋</button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        (q || view !== 'buscar' || cat) && (
          list.length === 0 ? (
            <Empty
              icon={view === 'favoritos' ? '☆' : view === 'mios' ? '✏️' : '🔎'}
              title={q ? 'Sin resultados' : view === 'favoritos' ? 'Aún no tienes favoritos' : view === 'recientes' ? 'Aún no hay recientes' : 'Aún no creas alimentos'}
              text={q ? 'Prueba otra palabra o crea el alimento.' : view === 'favoritos' ? 'Toca ☆ al ver un alimento.' : undefined}
            />
          ) : (
            <div className="list">
              {list.map((f) => (
                <button className="item" key={f.id} onClick={() => setPicked(f)}>
                  <FoodBubble emoji={foodEmoji(f)} hue={catHue(f.cat)} />
                  <div className="grow">
                    <div className="ellipsis">{f.name}</div>
                    <div className="muted small ellipsis">
                      {f.servings[0].g !== 1 ? `${f.servings[0].label} (${fmtNum(f.servings[0].g)} g) · ${Math.round((f.kcal * f.servings[0].g) / 100)} kcal` : `100 g · ${Math.round(f.kcal)} kcal`}
                    </div>
                  </div>
                  <Ico name="plus" size={20} style={{ color: 'var(--accent)' }} />
                </button>
              ))}
            </div>
          )
        )
      )}
      {q.trim().length >= 3 && (
        online?.q === q.trim() ? (
          <>
            <div className="section-title">Open Food Facts</div>
            {online.busy && <div className="card center small">Buscando productos…</div>}
            {online.err && <div className="card small muted">{online.err}</div>}
            {online.list.length > 0 && (
              <div className="list">
                {online.list.map((f) => (
                  <button className="item" key={f.id} onClick={async () => { await db.foods.put(f); setPicked(f); }}>
                    <FoodBubble emoji={foodEmoji(f)} hue="#3dd6a4" />
                    <div className="grow"><div className="ellipsis">{f.name}</div><div className="muted small ellipsis">{f.brand ?? 'Sin marca'} · {Math.round(f.kcal)} kcal/100 g</div></div>
                    <Ico name="plus" size={20} style={{ color: 'var(--accent)' }} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <button className="btn secondary" style={{ marginBottom: 10 }} onClick={searchOnline}><Ico name="search" />Buscar «{q.trim()}» en productos de marca</button>
        )
      )}
      {(q || view === 'mios') && (
        <button className="btn secondary" onClick={() => setCreating(true)}><Ico name="edit" />Crear alimento propio{q ? ` «${q}»` : ''}</button>
      )}

      {ai && <AILog mode={ai} onClose={() => setAi(null)} />}
      {scan && <Barcode onClose={() => { setScan(false); }} />}
      {compare && <Compare onClose={() => setCompare(false)} />}
      {picked && <PortionSheet food={picked} meal={meal} confirmLabel="Agregar" onClose={() => setPicked(null)} onConfirm={(r) => add(picked, r)} />}
      {creating && (
        <CustomFoodSheet
          initialName={q}
          onClose={() => setCreating(false)}
          onCreated={(f) => { setCreating(false); setPicked(f); }}
        />
      )}
    </Sheet>
  );
}

export function CustomFoodSheet({ initialName = '', fixedId, onClose, onCreated }: { initialName?: string; fixedId?: string; onClose: () => void; onCreated: (f: Food) => void }) {
  const { profile } = useApp();
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState('');
  const [basis, setBasis] = useState<'100' | 'porcion'>('porcion');
  const [servLabel, setServLabel] = useState('porción');
  const [servG, setServG] = useState('100');
  const [v, setV] = useState({ kcal: '', p: '', c: '', f: '', fiber: '', sugar: '', sodium: '' });
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const num = (s: string) => Math.max(0, parseFloat(s.replace(',', '.')) || 0);

  const g = num(servG);
  const ok = name.trim() && num(v.kcal) > 0 && (basis === '100' || g > 0);

  const runAI = async (input: Parameters<typeof analyzeFood>[1]) => {
    setAiBusy(true);
    setAiErr('');
    try {
      const r = await analyzeFood({ apiKey: profile.aiKey, model: profile.aiModel }, input);
      const s1 = (x: number) => String(Math.round(x * 10) / 10);
      setName(r.name || name);
      setBrand(r.brand || '');
      setBasis('100');
      setServLabel(r.servingLabel || 'porción');
      setServG(s1(r.servingGrams || 100));
      setV({ kcal: s1(r.per100.kcal), p: s1(r.per100.protein), c: s1(r.per100.carbs), f: s1(r.per100.fat), fiber: s1(r.per100.fiber), sugar: s1(r.per100.sugar), sodium: s1(r.per100.sodiumMg) });
      haptic();
    } catch (e) {
      setAiErr(friendlyError(e));
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    const k = basis === '100' ? 1 : 100 / g;
    const servings: Serving[] = [];
    if (servLabel.trim() && g > 0 && !(basis === '100' && g === 100 && servLabel.trim() === 'porción')) servings.push({ label: servLabel.trim() || 'porción', g });
    servings.push({ label: 'gramos', g: 1 });
    const food: Food = {
      id: fixedId ?? 'c-' + Date.now().toString(36),
      name: name.trim(),
      brand: brand.trim() || undefined,
      cat: 'Mis',
      kcal: num(v.kcal) * k,
      p: num(v.p) * k,
      c: num(v.c) * k,
      f: num(v.f) * k,
      fiber: num(v.fiber) * k,
      sugar: v.sugar ? num(v.sugar) * k : undefined,
      sodium: v.sodium ? num(v.sodium) * k : undefined,
      servings,
      custom: true,
    };
    await db.foods.put(food);
    toast('Alimento guardado');
    onCreated(food);
  };

  const field = (key: keyof typeof v, label: string) => (
    <div>
      <label className="small muted">{label}</label>
      <input inputMode="decimal" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} placeholder="0" style={{ marginTop: 4 }} />
    </div>
  );

  return (
    <Sheet title="Crear alimento" onClose={onClose}>
      <div className="card col" style={{ background: 'var(--card2)' }}>
        <div className="bold small">✨ Rellenar con IA</div>
        <div className="row">
          <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Ej.: empanada de queso frita mediana" />
          <button className="btn sm" disabled={aiBusy || !aiText.trim()} onClick={() => runAI({ text: aiText })}>{aiBusy ? '…' : 'Describir'}</button>
        </div>
        <label className="btn secondary sm" style={{ width: '100%' }}>
          📷 Foto de la etiqueta nutricional
          <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) runAI({ image: await fileToImage(f, 1600) });
          }} />
        </label>
        {aiErr && <div className="small" style={{ color: 'var(--danger)' }}>{aiErr}</div>}
        {aiBusy && <div className="small muted">Analizando…</div>}
      </div>
      <div className="col">
        <div><label className="small muted">Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Arepa de mi mamá" style={{ marginTop: 4 }} /></div>
        <div><label className="small muted">Marca (opcional)</label><input value={brand} onChange={(e) => setBrand(e.target.value)} style={{ marginTop: 4 }} /></div>
        <div className="seg" style={{ margin: '6px 0 0' }}>
          <button className={basis === 'porcion' ? 'on' : ''} onClick={() => setBasis('porcion')}>Por porción</button>
          <button className={basis === '100' ? 'on' : ''} onClick={() => setBasis('100')}>Por 100 g</button>
        </div>
        <div className="row">
          <div className="grow"><label className="small muted">Nombre de la porción</label><input value={servLabel} onChange={(e) => setServLabel(e.target.value)} style={{ marginTop: 4 }} /></div>
          <div style={{ width: 110 }}><label className="small muted">Gramos</label><input inputMode="decimal" value={servG} onChange={(e) => setServG(e.target.value)} style={{ marginTop: 4 }} /></div>
        </div>
        <div className="muted small">Valores {basis === '100' ? 'por 100 g' : `por ${servLabel || 'porción'}`}:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {field('kcal', 'Calorías (kcal)')}
          {field('p', 'Proteína (g)')}
          {field('c', 'Carbohidratos (g)')}
          {field('f', 'Grasa (g)')}
          {field('fiber', 'Fibra (g)')}
          {field('sugar', 'Azúcar (g)')}
          {field('sodium', 'Sodio (mg)')}
        </div>
        <button className="btn" disabled={!ok} onClick={save} style={{ marginTop: 6 }}>Guardar alimento</button>
      </div>
    </Sheet>
  );
}
