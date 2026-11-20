import { useState } from 'react';
import { searchFoods, type Food } from '../data/foods';
import { useFoods } from '../components/Portion';
import { fmtNum, Sheet } from '../components/ui';

type Basis = '100' | 'porcion';

const ROWS: { k: keyof Food | 'protPer100kcal'; label: string; unit: string; better: 'high' | 'low' }[] = [
  { k: 'kcal', label: 'Calorías', unit: 'kcal', better: 'low' },
  { k: 'p', label: 'Proteína', unit: 'g', better: 'high' },
  { k: 'c', label: 'Carbohidratos', unit: 'g', better: 'low' },
  { k: 'f', label: 'Grasa', unit: 'g', better: 'low' },
  { k: 'fiber', label: 'Fibra', unit: 'g', better: 'high' },
  { k: 'sugar', label: 'Azúcar', unit: 'g', better: 'low' },
  { k: 'sodium', label: 'Sodio', unit: 'mg', better: 'low' },
  { k: 'protPer100kcal', label: 'Proteína por 100 kcal', unit: 'g', better: 'high' },
];

function value(f: Food, k: (typeof ROWS)[number]['k'], basis: Basis): number | undefined {
  const g = basis === '100' ? 100 : f.servings[0].g === 1 ? 100 : f.servings[0].g;
  if (k === 'protPer100kcal') return f.kcal > 0 ? (f.p / f.kcal) * 100 : undefined;
  const v = f[k as keyof Food];
  return typeof v === 'number' ? (v * g) / 100 : undefined;
}

export default function Compare({ onClose, initial }: { onClose: () => void; initial?: Food }) {
  const foods = useFoods();
  const [a, setA] = useState<Food | null>(initial ?? null);
  const [b, setB] = useState<Food | null>(null);
  const [picking, setPicking] = useState<'a' | 'b' | null>(initial ? 'b' : 'a');
  const [q, setQ] = useState('');
  const [basis, setBasis] = useState<Basis>('100');
  const results = q.trim() ? searchFoods(foods, q).slice(0, 30) : [];

  const slot = (f: Food | null, which: 'a' | 'b') => (
    <button className="card tap" style={{ margin: 0, padding: 12, textAlign: 'left', border: picking === which ? '2px solid var(--accent)' : '2px solid transparent' }} onClick={() => { setPicking(which); setQ(''); }}>
      <div className="tiny muted">{which === 'a' ? 'Alimento A' : 'Alimento B'}</div>
      <div className="bold small" style={{ minHeight: 36 }}>{f ? f.name : 'Elegir…'}</div>
      {f && basis === 'porcion' && <div className="tiny muted">{f.servings[0].g === 1 ? '100 g' : `${f.servings[0].label} (${fmtNum(f.servings[0].g)} g)`}</div>}
    </button>
  );

  return (
    <Sheet full title="Comparar alimentos" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {slot(a, 'a')}
        {slot(b, 'b')}
      </div>
      {picking && (
        <>
          <input type="search" autoFocus placeholder={`Buscar alimento ${picking.toUpperCase()}`} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="list">
            {results.map((f) => (
              <button className="item" key={f.id} onClick={() => { picking === 'a' ? setA(f) : setB(f); setPicking(picking === 'a' && !b ? 'b' : null); setQ(''); }}>
                <div className="grow ellipsis">{f.name}</div>
                <span className="small muted num">{Math.round(f.kcal)} kcal/100 g</span>
              </button>
            ))}
          </div>
        </>
      )}
      {a && b && (
        <>
          <div className="seg">
            <button className={basis === '100' ? 'on' : ''} onClick={() => setBasis('100')}>Por 100 g</button>
            <button className={basis === 'porcion' ? 'on' : ''} onClick={() => setBasis('porcion')}>Por porción</button>
          </div>
          <div className="list">
            {ROWS.map((r) => {
              const va = value(a, r.k, basis);
              const vb = value(b, r.k, basis);
              const both = va !== undefined && vb !== undefined && Math.abs(va - vb) > 0.05;
              const aWins = both && (r.better === 'high' ? va! > vb! : va! < vb!);
              const bWins = both && !aWins;
              const cell = (v: number | undefined, win: boolean) => (
                <div className="num center" style={{ width: 90, fontWeight: win ? 800 : 500, color: win ? 'var(--ok)' : undefined }}>
                  {v === undefined ? '—' : `${fmtNum(v, r.unit === 'kcal' || r.unit === 'mg' ? 0 : 1)} ${r.unit}`}
                </div>
              );
              return (
                <div className="item small" key={r.label}>
                  {cell(va, aWins)}
                  <div className="grow center muted">{r.label}</div>
                  {cell(vb, bWins)}
                </div>
              );
            })}
          </div>
          <p className="note">En verde, el valor más favorable para bajar de peso (más proteína y fibra; menos calorías, azúcar, sodio y grasa). «—» = dato no disponible.</p>
        </>
      )}
    </Sheet>
  );
}
