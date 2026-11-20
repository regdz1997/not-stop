// Open Food Facts: base abierta y gratuita de productos de marca.
import type { Food, Serving } from '../data/foods';

const FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity';

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Convierte un producto de OFF en un alimento de la app (valores por 100 g). */
export function offToFood(p: OFFProduct): Food | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (!kcal && num(n['energy_100g'])) kcal = num(n['energy_100g']) / 4.184; // kJ → kcal
  const name = (p.product_name_es || p.product_name || '').trim();
  if (!name || !p.code) return null;
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (!kcal && !protein && !carbs && !fat) return null;
  if (!kcal) kcal = protein * 4 + carbs * 4 + fat * 9;
  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq > 0) servings.push({ label: `porción${p.serving_size ? ` (${p.serving_size})` : ''}`, g: sq });
  servings.push({ label: 'gramos', g: 1 });
  return {
    id: 'off-' + p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    cat: 'Mis',
    kcal: Math.round(kcal),
    p: protein,
    c: carbs,
    f: fat,
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
    sodium: Math.round(num(n['sodium_100g']) * 1000),
    servings,
    custom: true,
  } as Food;
}

export async function lookupBarcode(code: string, f: typeof fetch = fetch): Promise<Food | null> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 6) throw new Error('Código no válido.');
  const res = await f(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}.`);
  const j = (await res.json()) as { status?: number; product?: OFFProduct };
  if (j.status !== 1 || !j.product) return null;
  return offToFood({ ...j.product, code: j.product.code ?? clean });
}

export async function searchOFF(q: string, f: typeof fetch = fetch): Promise<Food[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}.`);
  const j = (await res.json()) as { products?: OFFProduct[] };
  return (j.products ?? []).map(offToFood).filter(Boolean) as Food[];
}
