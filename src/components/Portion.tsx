import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Entry } from '../db';
import { SEED_FOODS, type Food } from '../data/foods';
import { MEALS, scale, type MealKey, type Nutr } from '../lib/calc';
import { fmtNum, haptic, Sheet } from './ui';

export function useFoods(): Food[] {
  const custom = useLiveQuery(() => db.foods.toArray(), [], []);
  return useMemo(() => [...custom, ...SEED_FOODS], [custom]);
}

export async function getFood(id: string): Promise<Food | undefined> {
  return SEED_FOODS.find((f) => f.id === id) ?? (await db.foods.get(id));
}

/** Reconstruye un "alimento" desde una entrada si ya no existe en la base. */
export function foodFromEntry(e: Pick<Entry, 'foodId' | 'name' | 'grams' | 'kcal' | 'p' | 'c' | 'f' | 'fiber'>): Food {
  const k = e.grams > 0 ? 100 / e.grams : 0;
  return { id: e.foodId, name: e.name, cat: 'Otros', kcal: e.kcal * k, p: e.p * k, c: e.c * k, f: e.f * k, fiber: e.fiber * k, servings: [{ label: 'gramos', g: 1 }] };
}

export interface PortionResult {
  qty: number;
  servingLabel: string;
  grams: number;
  nutr: Nutr;
  meal: MealKey;
}

export function PortionSheet({
  food,
  initial,
  meal: initialMeal,
  title,
  confirmLabel,
  onConfirm,
  onClose,
  onDelete,
}: {
  food: Food;
  initial?: { qty: number; servingLabel: string };
  meal: MealKey;
  title?: string;
  confirmLabel: string;
  onConfirm: (r: PortionResult) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const first = food.servings.find((s) => s.label === initial?.servingLabel) ?? food.servings[0];
  const [serving, setServing] = useState(first);
  const [qtyTxt, setQtyTxt] = useState(String(initial?.qty ?? (first.g === 1 ? 100 : 1)));
  const [meal, setMeal] = useState<MealKey>(initialMeal);
  const qty = Math.max(0, parseFloat(qtyTxt.replace(',', '.')) || 0);
  const grams = Math.round(qty * serving.g * 10) / 10;
  const n = scale(food, grams);
  const fav = useLiveQuery(() => db.favorites.get(food.id), [food.id]);

  const pickServing = (label: string) => {
    const s = food.servings.find((x) => x.label === label)!;
    setServing(s);
    setQtyTxt(s.g === 1 ? String(Math.round(grams) || 100) : '1');
  };

  return (
    <Sheet
      title={title ?? food.name}
      onClose={onClose}
      right={
        <button
          className="icon-btn"
          aria-label="Favorito"
          onClick={async () => {
            haptic();
            if (fav) await db.favorites.delete(food.id);
            else await db.favorites.put({ foodId: food.id });
          }}
        >
          {fav ? '★' : '☆'}
        </button>
      }
    >
      <div className="muted small" style={{ marginBottom: 12 }}>
        {food.brand ? food.brand + ' · ' : ''}
        {fmtNum(food.kcal)} kcal por 100 g
      </div>

      <div className="card center">
        <div className="big num" style={{ color: 'var(--accent)' }}>{n.kcal}</div>
        <div className="muted small">kcal · {fmtNum(grams, 1)} g</div>
        <div className="row" style={{ justifyContent: 'space-around', marginTop: 14 }}>
          <div className="kpi"><b style={{ color: 'var(--prot)' }}>{fmtNum(n.p, 1)} g</b><span>Proteína</span></div>
          <div className="kpi"><b style={{ color: 'var(--carb)' }}>{fmtNum(n.c, 1)} g</b><span>Carbos</span></div>
          <div className="kpi"><b style={{ color: 'var(--fat)' }}>{fmtNum(n.f, 1)} g</b><span>Grasa</span></div>
          <div className="kpi"><b>{fmtNum(n.fiber, 1)} g</b><span>Fibra</span></div>
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
        <div style={{ width: 110 }}>
          <label className="small muted">Cantidad</label>
          <input inputMode="decimal" className="num" value={qtyTxt} onChange={(e) => setQtyTxt(e.target.value)} onFocus={(e) => e.target.select()} style={{ marginTop: 4, fontSize: 20, textAlign: 'center' }} />
        </div>
        <div className="grow">
          <label className="small muted">Medida</label>
          <select value={serving.label} onChange={(e) => pickServing(e.target.value)} style={{ marginTop: 4 }}>
            {food.servings.map((s) => (
              <option key={s.label} value={s.label}>
                {s.g === 1 ? 'gramos (g)' : `${s.label} (${fmtNum(s.g, 1)} g)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {serving.g !== 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {[0.5, 1, 1.5, 2, 3].map((q) => (
            <button key={q} className={'chip' + (qty === q ? ' on' : '')} onClick={() => setQtyTxt(String(q))}>
              {fmtNum(q, 1)}
            </button>
          ))}
        </div>
      )}

      <label className="small muted">Comida</label>
      <div className="chips" style={{ margin: '6px 0 18px' }}>
        {MEALS.map((m) => (
          <button key={m.key} className={'chip' + (meal === m.key ? ' on' : '')} onClick={() => setMeal(m.key)}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <button className="btn" disabled={grams <= 0} onClick={() => { haptic(); onConfirm({ qty, servingLabel: serving.label, grams, nutr: n, meal }); }}>
        {confirmLabel}
      </button>
      {onDelete && (
        <button className="btn danger" style={{ marginTop: 10 }} onClick={onDelete}>
          Eliminar del diario
        </button>
      )}
      <p className="note">Valores aproximados.</p>
    </Sheet>
  );
}

const KEEP = new Set(['de', 'del', 'a', 'la', 'el', 'con', 'y']);
/** Pluraliza medidas caseras simples: "unidad mediana" → "unidades medianas", "porción" → "porciones". */
export function plural(label: string, qty: number): string {
  if (qty === 1 || /\d|\(/.test(label)) return label;
  return label
    .split(' ')
    .map((w) => {
      if (KEEP.has(w) || !/[a-záéíóúñ]$/i.test(w)) return w;
      if (/ón$/.test(w)) return w.replace(/ón$/, 'ones');
      if (/[aeiou]$/i.test(w)) return w + 's';
      if (/z$/.test(w)) return w.replace(/z$/, 'ces');
      return w + 'es';
    })
    .join(' ');
}

export function servingText(qty: number, label: string, grams: number) {
  if (label === 'gramos') return `${fmtNum(grams, 1)} g`;
  return `${fmtNum(qty, 2)} ${plural(label, qty)} · ${fmtNum(grams, 0)} g`;
}
