// Planificador de comidas local (sin IA): elige recetas que cumplen
// calorías y macros, respeta el tipo de dieta y los alimentos excluidos.
import type { DietType, PlanDay, PlanItem, Recipe } from '../db';
import type { Food } from '../data/foods';
import { MEAT_IDS } from '../data/recipes';
import { normalize } from '../data/foods';
import { round1, scale, sumNutr, type MealKey, type Nutr, type Targets } from './calc';

export type FoodMap = Map<string, Food>;

export function recipeNutr(r: Recipe, foods: FoodMap, factor = 1): Nutr {
  const parts = r.ingredients.map((i) => {
    const f = foods.get(i.foodId);
    return f ? scale(f, (i.grams * factor) / r.servings) : { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  });
  return sumNutr(parts);
}

export function isVegetarian(r: Recipe) {
  return !r.ingredients.some((i) => MEAT_IDS.has(i.foodId));
}

export function recipeTags(r: Recipe, foods: FoodMap): string[] {
  const n = recipeNutr(r, foods);
  const tags: string[] = [];
  if (isVegetarian(r)) tags.push('Vegetariana');
  if (n.kcal > 0 && (n.p * 4) / n.kcal >= 0.3) tags.push('Alta en proteína');
  if (n.kcal > 0 && (n.c * 4) / n.kcal <= 0.25) tags.push('Baja en carbos');
  if (r.minutes <= 10) tags.push('Rápida');
  return tags;
}

export function excludedBy(r: Recipe, foods: FoodMap, excluded: string[]): boolean {
  const words = excluded.map((w) => normalize(w.trim())).filter((w) => w.length >= 3);
  if (!words.length) return false;
  return r.ingredients.some((i) => {
    const name = normalize(foods.get(i.foodId)?.name ?? i.foodId);
    return words.some((w) => name.includes(w));
  });
}

export function allowed(r: Recipe, foods: FoodMap, diet: DietType, excluded: string[], meal: MealKey): boolean {
  if (!r.meals.includes(meal)) return false;
  if (excludedBy(r, foods, excluded)) return false;
  if (r.ingredients.some((i) => !foods.has(i.foodId))) return false;
  if (diet === 'vegetariana' && !isVegetarian(r)) return false;
  if (diet === 'baja_carbos') {
    const n = recipeNutr(r, foods);
    const carbRatio = n.kcal ? (n.c * 4) / n.kcal : 1;
    if (carbRatio > (meal === 'almuerzo' || meal === 'cena' ? 0.3 : 0.45)) return false;
  }
  return true;
}

export function mealShares(mealsPerDay: 3 | 4 | 5): Partial<Record<MealKey, number>> {
  if (mealsPerDay === 3) return { desayuno: 0.3, almuerzo: 0.4, cena: 0.3 };
  if (mealsPerDay === 4) return { desayuno: 0.25, almuerzo: 0.35, cena: 0.3, snacks: 0.1 };
  return { desayuno: 0.22, almuerzo: 0.32, cena: 0.28, snacks: 0.18 };
}

/** Generador pseudoaleatorio con semilla (repetible). */
export function rng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundFactor = (f: number) => Math.min(2.5, Math.max(0.5, Math.round(f * 20) / 20));

export interface PlanOptions {
  targets: Targets;
  diet: DietType;
  excluded: string[];
  mealsPerDay: 3 | 4 | 5;
  recipes: Recipe[];
  foods: FoodMap;
  avoid?: Set<string>; // recetas ya usadas en la semana (para variar)
  seed: string;
}

function pick(cands: Recipe[], slotKcal: number, protShare: number, o: PlanOptions, rand: () => number, exclude?: string): PlanItem | null {
  const list = cands.filter((r) => r.id !== exclude);
  if (!list.length) return null;
  const wantProtRatio = o.diet === 'alta_proteina' ? 0.38 : protShare;
  const scored = list.map((r) => {
    const n = recipeNutr(r, o.foods);
    const ratio = n.kcal ? (n.p * 4) / n.kcal : 0;
    const factor = roundFactor(slotKcal / Math.max(1, n.kcal));
    const kcalMiss = Math.abs(n.kcal * factor - slotKcal) / slotKcal;
    const score = Math.abs(ratio - wantProtRatio) * 2 + kcalMiss + (o.avoid?.has(r.id) ? 0.35 : 0) + rand() * 0.25;
    return { r, factor, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  return { recipeId: best.r.id, factor: best.factor };
}

export function dayTotals(day: PlanDay, recipes: Map<string, Recipe>, foods: FoodMap): Nutr {
  const parts: Nutr[] = [];
  for (const items of Object.values(day.meals)) {
    for (const it of items ?? []) {
      const r = recipes.get(it.recipeId);
      if (r) parts.push(recipeNutr(r, foods, it.factor));
    }
  }
  return sumNutr(parts);
}

const BOOSTERS = ['batido-whey', 'yogur-mango', 'huevos-duros', 'sandwich-pavo'];

export function planDay(date: string, o: PlanOptions): PlanDay {
  const rand = rng(o.seed + date);
  const shares = mealShares(o.mealsPerDay);
  const protShare = (o.targets.protein * 4) / o.targets.kcal;
  const meals: PlanDay['meals'] = {};
  for (const [meal, share] of Object.entries(shares) as [MealKey, number][]) {
    const cands = o.recipes.filter((r) => allowed(r, o.foods, o.diet, o.excluded, meal));
    const slotKcal = o.targets.kcal * share;
    if (meal === 'snacks' && o.mealsPerDay === 5) {
      const a = pick(cands, slotKcal / 2, protShare, o, rand);
      const b = a ? pick(cands, slotKcal / 2, protShare, o, rand, a.recipeId) : null;
      meals.snacks = [a, b].filter(Boolean) as PlanItem[];
    } else {
      const it = pick(cands, slotKcal, protShare, o, rand);
      if (it) meals[meal] = [it];
    }
    for (const it of meals[meal] ?? []) o.avoid?.add(it.recipeId);
  }
  const day: PlanDay = { date, meals };
  return balanceProtein(day, o);
}

/** Si falta proteína, agrega un refuerzo y reescala el resto para mantener las calorías. */
export function balanceProtein(day: PlanDay, o: PlanOptions): PlanDay {
  const rmap = new Map(o.recipes.map((r) => [r.id, r]));
  let tot = dayTotals(day, rmap, o.foods);
  const gap = o.targets.protein - tot.p;
  if (gap > 12) {
    const booster = BOOSTERS.map((id) => rmap.get(id)).find((r) => r && allowed(r, o.foods, o.diet, o.excluded, 'snacks'));
    if (booster) {
      const bn = recipeNutr(booster, o.foods);
      const factor = roundFactor(Math.min(2, gap / Math.max(1, bn.p)));
      const extra: PlanItem = { recipeId: booster.id, factor, extra: true };
      day.meals.snacks = [...(day.meals.snacks ?? []), extra];
    }
  }
  // Reescalar las porciones no-extra para acercar las calorías a la meta.
  tot = dayTotals(day, rmap, o.foods);
  const extraKcal = Object.values(day.meals).flat().filter((i) => i?.extra).reduce((a, i) => a + recipeNutr(rmap.get(i!.recipeId)!, o.foods, i!.factor).kcal, 0);
  const mainKcal = tot.kcal - extraKcal;
  if (mainKcal > 0) {
    const k = (o.targets.kcal - extraKcal) / mainKcal;
    for (const items of Object.values(day.meals)) for (const it of items ?? []) if (!it.extra) it.factor = roundFactor(it.factor * k);
  }
  return day;
}

export function swapItem(day: PlanDay, meal: MealKey, index: number, o: PlanOptions): PlanDay {
  const rmap = new Map(o.recipes.map((r) => [r.id, r]));
  const cur = day.meals[meal]?.[index];
  if (!cur) return day;
  const curR = rmap.get(cur.recipeId);
  const curKcal = curR ? recipeNutr(curR, o.foods, cur.factor).kcal : o.targets.kcal * 0.3;
  const cands = o.recipes.filter((r) => allowed(r, o.foods, o.diet, o.excluded, meal) && !(day.meals[meal] ?? []).some((i) => i.recipeId === r.id));
  const rand = rng(o.seed + day.date + meal + index + Date.now());
  const it = pick(cands, curKcal, (o.targets.protein * 4) / o.targets.kcal, o, rand, cur.recipeId);
  if (!it) return day;
  const meals = { ...day.meals, [meal]: (day.meals[meal] ?? []).map((x, i) => (i === index ? { ...it, extra: x.extra } : x)) };
  return { ...day, meals };
}

// ---------------- Lista de compras ----------------
export const SECTION_OF: Record<string, string> = {
  Proteínas: 'Carnes, pescados y proteínas',
  Lácteos: 'Lácteos y huevos',
  Frutas: 'Frutas y verduras',
  Verduras: 'Frutas y verduras',
  Cereales: 'Granos, panadería y tubérculos',
  Grasas: 'Aceites, frutos secos y semillas',
  Bebidas: 'Bebidas',
  Latina: 'Preparados y típicos',
  Venezolana: 'Preparados y típicos',
  Pescados: 'Carnes, pescados y proteínas',
  Panadería: 'Granos, panadería y tubérculos',
  Legumbres: 'Granos, panadería y tubérculos',
  'Frutos secos': 'Aceites, frutos secos y semillas',
  Dulces: 'Despensa',
  Snacks: 'Despensa',
  Salsas: 'Despensa',
  Suplementos: 'Despensa',
  'Comida rápida': 'Preparados y típicos',
  Otros: 'Despensa',
  Mis: 'Otros',
};

export interface ShopItem { foodId: string; name: string; grams: number; approx: string }

export function shoppingList(days: PlanDay[], recipes: Map<string, Recipe>, foods: FoodMap): Record<string, ShopItem[]> {
  const grams = new Map<string, number>();
  for (const d of days) {
    for (const items of Object.values(d.meals)) {
      for (const it of items ?? []) {
        const r = recipes.get(it.recipeId);
        if (!r) continue;
        for (const ing of r.ingredients) grams.set(ing.foodId, (grams.get(ing.foodId) ?? 0) + (ing.grams * it.factor) / r.servings);
      }
    }
  }
  const out: Record<string, ShopItem[]> = {};
  for (const [foodId, g] of grams) {
    const f = foods.get(foodId);
    if (!f) continue;
    const id = f.id === 'huevo' || f.id === 'clara' ? 'Lácteos' : f.cat;
    const section = SECTION_OF[id] ?? 'Otros';
    const unit = f.servings.find((s) => s.g > 1 && /unidad|lata|filete|pote|scoop/.test(s.label));
    const approx = unit ? `≈ ${Math.max(1, Math.ceil(g / unit.g))} ${unit.label}` : '';
    (out[section] ??= []).push({ foodId, name: f.name, grams: Math.round(g), approx });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return out;
}

export function fmtFactor(f: number) {
  return f === 1 ? '1 porción' : `${round1(f).toString().replace('.', ',')} porciones`;
}
