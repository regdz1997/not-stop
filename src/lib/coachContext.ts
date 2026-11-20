import { db, type Profile } from '../db';
import { addDays, ageFromBirth, GOALS, isoDate, round1, sumNutr, trend } from './calc';
import { normalize } from '../data/foods';
import type { Recipe } from '../db';
import { recipeNutr, type FoodMap } from './planner';

/** Resumen compacto de los datos del usuario para el coach. */
export async function buildCoachContext(p: Profile): Promise<string> {
  const today = isoDate();
  const since = addDays(today, -14);
  const entries = await db.entries.where('date').aboveOrEqual(since).toArray();
  const weights = await db.weights.orderBy('date').toArray();
  const workouts = await db.workouts.where('date').aboveOrEqual(since).toArray();
  const runs = await db.runs.where('date').aboveOrEqual(since).toArray();
  const water = await db.water.get(today);

  const todayE = entries.filter((e) => e.date === today);
  const t = sumNutr(todayE);
  const burned = workouts.filter((w) => w.date === today).reduce((a, w) => a + w.kcal, 0) + runs.filter((r) => r.date === today).reduce((a, r) => a + r.kcal, 0);

  const days: string[] = [];
  for (let i = 13; i >= 1; i--) {
    const d = addDays(today, -i);
    const es = entries.filter((e) => e.date === d);
    if (!es.length) { days.push(`${d}: sin registro`); continue; }
    const n = sumNutr(es);
    days.push(`${d}: ${n.kcal} kcal, P ${Math.round(n.p)} g, C ${Math.round(n.c)} g, G ${Math.round(n.f)} g`);
  }
  const recentW = weights.filter((w) => w.date >= addDays(today, -35));
  const tr = trend(weights.map((w) => w.kg));
  const lastTrend = tr[tr.length - 1];
  const idx14 = weights.findIndex((w) => w.date >= addDays(today, -14));
  const ch14 = idx14 >= 0 ? round1(lastTrend - tr[Math.max(0, idx14 - 1)]) : null;

  return [
    `Fecha: ${today}. Perfil: ${p.sex === 'h' ? 'hombre' : 'mujer'}, ${ageFromBirth(p.birth)} años, ${p.heightCm} cm, peso ${p.weightKg} kg, meta ${p.targetKg} kg. Objetivo: ${GOALS[p.goal].label}. Dieta: ${p.dietType ?? 'normal'}. No le gusta: ${(p.excluded ?? []).join(', ') || 'nada indicado'}.`,
    `Metas diarias: ${p.kcal} kcal, proteína ${p.protein} g, carbos ${p.carbs} g, grasa ${p.fat} g, agua ${p.waterGoal} vasos.`,
    `Hoy lleva: ${t.kcal} kcal, P ${Math.round(t.p)} g, C ${Math.round(t.c)} g, G ${Math.round(t.f)} g, fibra ${Math.round(t.fiber)} g, agua ${water?.glasses ?? 0} vasos, quemadas ${burned} kcal. Le quedan ${p.kcal - t.kcal + burned} kcal y ${Math.max(0, Math.round(p.protein - t.p))} g de proteína.`,
    `Comidas de hoy: ${todayE.map((e) => `${e.meal}: ${e.name} (${e.grams} g)`).join('; ') || 'ninguna'}.`,
    `Últimos 13 días:\n${days.join('\n')}`,
    `Pesos recientes: ${recentW.map((w) => `${w.date} ${w.kg}`).join(', ') || 'sin datos'}. Tendencia actual ${lastTrend ? round1(lastTrend) : '?'} kg${ch14 !== null ? `, cambio en 14 días ${ch14 > 0 ? '+' : ''}${ch14} kg` : ''}.`,
    `Entrenos (14 días): ${workouts.length} de fuerza (${workouts.map((w) => w.name).join(', ') || '—'}), ${runs.length} trotes (${round1(runs.reduce((a, r) => a + r.km, 0))} km).`,
  ].join('\n');
}

/** "¿Qué cocino?" sin IA: recetas que más aprovechan los ingredientes que tengo. */
export function pantryMatches(text: string, recipes: Recipe[], foods: FoodMap, remainingKcal: number) {
  const words = normalize(text).split(/[,;\n]|\sy\s/).map((w) => w.trim()).filter((w) => w.length >= 3);
  if (!words.length) return [];
  return recipes
    .map((r) => {
      const names = r.ingredients.map((i) => normalize(foods.get(i.foodId)?.name ?? ''));
      const have = names.filter((n) => words.some((w) => n.includes(w) || w.includes(n.split(' ')[0])));
      const coverage = have.length / names.length;
      const kcal = recipeNutr(r, foods).kcal;
      const factor = remainingKcal > 150 ? Math.min(2, Math.max(0.5, Math.round((Math.min(remainingKcal, 900) / kcal) * 4) / 4)) : 1;
      return { r, coverage, have: have.length, factor, missing: r.ingredients.filter((_, i) => !have.includes(names[i])).map((i) => foods.get(i.foodId)?.name ?? i.foodId) };
    })
    .filter((m) => m.have > 0)
    .sort((a, b) => b.coverage - a.coverage || b.have - a.have)
    .slice(0, 5);
}
