import { describe, expect, it } from 'vitest';
import { adaptiveTarget, dailyScore, fastPhase, fastStreak, navyBodyFat, proactiveAlerts } from './insights';
import { addDays } from './calc';
import { SEED_FOODS } from '../data/foods';
import { SEED_RECIPES } from '../data/recipes';
import { allowed, dayTotals, isVegetarian, planDay, recipeNutr, shoppingList, swapItem } from './planner';

const T = { kcal: 2000, protein: 160, carbs: 200, fat: 60, waterGoal: 8 };

describe('puntuación diaria', () => {
  it('día perfecto ≈ 100', () => {
    const s = dailyScore({ kcal: 2000, p: 165, c: 200, f: 60, fiber: 30, glasses: 8, distinctFoods: 10 }, T);
    expect(s.total).toBeGreaterThanOrEqual(98);
    expect(s.grade).toBe('Excelente');
  });
  it('día vacío = 0', () => {
    expect(dailyScore({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0, glasses: 0, distinctFoods: 0 }, T).total).toBe(0);
  });
  it('avisa de proteína y fibra bajas', () => {
    const s = dailyScore({ kcal: 1900, p: 80, c: 250, f: 60, fiber: 8, glasses: 8, distinctFoods: 8 }, T);
    expect(s.tips.join(' ')).toMatch(/proteína/);
    expect(s.tips.join(' ')).toMatch(/fibra/);
    expect(s.total).toBeLessThan(85);
  });
  it('el máximo suma 100', () => {
    const s = dailyScore({ kcal: 2000, p: 160, c: 200, f: 60, fiber: 28, glasses: 8, distinctFoods: 8 }, T);
    expect(s.parts.reduce((a, p) => a + p.max, 0)).toBe(100);
  });
});

describe('ajuste dinámico', () => {
  const today = '2026-11-19';
  const intake: Record<string, number> = {};
  const weights: { date: string; kg: number }[] = [];
  for (let i = 35; i >= 1; i--) {
    const d = addDays(today, -i);
    intake[d] = 2200;
    weights.push({ date: d, kg: 85 - (35 - i) * (0.5 / 7) }); // baja 0,5 kg/semana
  }
  it('estima el gasto real (~2750) y propone cambio limitado', () => {
    const r = adaptiveTarget({ today, intakeByDay: intake, weights, currentKcal: 2200, goal: 'perder', weightKg: 83, minKcal: 1500 });
    expect(r.ok).toBe(true);
    // 0,5 kg/sem × 7700 / 7 ≈ 550 kcal de déficit → gasto ≈ 2750 (la media móvil lo subestima un poco)
    expect(r.tdee!).toBeGreaterThan(2550);
    expect(r.tdee!).toBeLessThan(2800);
    expect(Math.abs(r.proposedKcal! - 2200)).toBeLessThanOrEqual(200);
    expect(r.explanation).toMatch(/kcal/);
  });
  it('pide más datos si faltan registros', () => {
    const r = adaptiveTarget({ today, intakeByDay: {}, weights, currentKcal: 2200, goal: 'perder', weightKg: 83, minKcal: 1500 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/10 días/);
  });
});

describe('alertas', () => {
  it('detecta semana sin registros y peso estancado', () => {
    const today = '2026-11-19';
    const weights = Array.from({ length: 30 }, (_, i) => ({ date: addDays(today, -30 + i), kg: 80 }));
    const al = proactiveAlerts({ today, loggedDates: [addDays(today, -20)], proteinByDay: {}, proteinTarget: 160, weights, goal: 'perder' });
    expect(al.map((a) => a.id)).toEqual(expect.arrayContaining(['nolog', 'stall']));
  });
  it('detecta proteína baja', () => {
    const today = '2026-11-19';
    const days = [1, 2, 3, 4].map((i) => addDays(today, -i));
    const al = proactiveAlerts({ today, loggedDates: days, proteinByDay: Object.fromEntries(days.map((d) => [d, 90])), proteinTarget: 160, weights: [], goal: 'perder' });
    expect(al.map((a) => a.id)).toContain('lowprot');
  });
});

describe('grasa corporal', () => {
  it('fórmula de la Marina (hombre)', () => {
    // Referencia: 178 cm, cintura 90, cuello 38 → ≈ 19,5 %
    const bf = navyBodyFat('h', 178, 90, 38)!;
    expect(bf).toBeGreaterThan(18);
    expect(bf).toBeLessThan(21);
  });
  it('mujer necesita cadera', () => {
    expect(navyBodyFat('m', 165, 75, 33)).toBeNull();
    const bf = navyBodyFat('m', 165, 75, 33, 100)!;
    expect(bf).toBeGreaterThan(25);
    expect(bf).toBeLessThan(35);
  });
  it('rechaza medidas imposibles', () => {
    expect(navyBodyFat('h', 178, 30, 40)).toBeNull();
  });
});

describe('ayuno', () => {
  it('fases', () => {
    expect(fastPhase(2).name).toBe('Digestión');
    expect(fastPhase(17).name).toBe('Cetosis ligera');
  });
  it('racha de días consecutivos', () => {
    const at = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
    const fasts = ['2026-11-17', '2026-11-18', '2026-11-19'].map((d) => ({ start: at(d, 0) - 16 * 3600000, end: at(d, 12), targetH: 16 }));
    expect(fastStreak(fasts, '2026-11-19')).toBe(3);
    expect(fastStreak(fasts.slice(0, 2), '2026-11-19')).toBe(2); // termina ayer, sigue contando
    expect(fastStreak([{ start: at('2026-11-19', 0), end: at('2026-11-19', 5), targetH: 16 }], '2026-11-19')).toBe(0);
  });
});

describe('recetas y planificador', () => {
  const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));
  const rmap = new Map(SEED_RECIPES.map((r) => [r.id, r]));
  it('todas las recetas usan alimentos existentes y tienen kcal', () => {
    for (const r of SEED_RECIPES) {
      for (const i of r.ingredients) expect(foods.has(i.foodId), `${r.id} → ${i.foodId}`).toBe(true);
      expect(recipeNutr(r, foods).kcal).toBeGreaterThan(100);
    }
    expect(new Set(SEED_RECIPES.map((r) => r.id)).size).toBe(SEED_RECIPES.length);
  });
  const base = { targets: { kcal: 2140, protein: 178, carbs: 211, fat: 65 }, excluded: [] as string[], mealsPerDay: 4 as const, recipes: SEED_RECIPES, foods, seed: 'x' };
  it('el plan normal cumple calorías (±10 %) y proteína (≥ 85 %)', () => {
    for (const date of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) {
      const d = planDay(date, { ...base, diet: 'normal', avoid: new Set() });
      const t = dayTotals(d, rmap, foods);
      expect(t.kcal).toBeGreaterThan(2140 * 0.9);
      expect(t.kcal).toBeLessThan(2140 * 1.1);
      expect(t.p).toBeGreaterThan(178 * 0.85);
    }
  });
  it('vegetariana no incluye carne', () => {
    const d = planDay('2026-11-19', { ...base, diet: 'vegetariana', avoid: new Set() });
    for (const items of Object.values(d.meals)) for (const it of items ?? []) expect(isVegetarian(rmap.get(it.recipeId)!)).toBe(true);
  });
  it('respeta alimentos excluidos', () => {
    const d = planDay('2026-11-19', { ...base, diet: 'normal', excluded: ['huevo', 'atún'], avoid: new Set() });
    for (const items of Object.values(d.meals)) for (const it of items ?? []) {
      const names = rmap.get(it.recipeId)!.ingredients.map((i) => foods.get(i.foodId)!.name.toLowerCase());
      expect(names.some((n) => n.includes('huevo') || n.includes('atún'))).toBe(false);
    }
  });
  it('baja en carbos filtra recetas', () => {
    const r = rmap.get('pasta-atun')!;
    expect(allowed(r, foods, 'baja_carbos', [], 'almuerzo')).toBe(false);
    expect(allowed(rmap.get('ensalada-atun')!, foods, 'baja_carbos', [], 'almuerzo')).toBe(true);
  });
  it('cambiar plato pone otra receta', () => {
    const o = { ...base, diet: 'normal' as const, avoid: new Set<string>() };
    const d = planDay('2026-11-19', o);
    const before = d.meals.almuerzo![0].recipeId;
    const after = swapItem(d, 'almuerzo', 0, o).meals.almuerzo![0].recipeId;
    expect(after).not.toBe(before);
  });
  it('lista de compras agrupa y suma', () => {
    const o = { ...base, diet: 'normal' as const, avoid: new Set<string>() };
    const days = ['2026-11-16', '2026-11-17'].map((d) => planDay(d, o));
    const list = shoppingList(days, rmap, foods);
    const all = Object.values(list).flat();
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((i) => i.grams > 0)).toBe(true);
    expect(Object.keys(list)).toContain('Frutas y verduras');
  });
});
