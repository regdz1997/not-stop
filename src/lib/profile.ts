import { db, type Profile } from '../db';
import { ageFromBirth, computeTargets, isoDate, type BodyData } from './calc';

export function bodyOf(p: Pick<Profile, 'sex' | 'birth' | 'heightCm' | 'weightKg' | 'activity' | 'goal'>): BodyData {
  return { sex: p.sex, age: ageFromBirth(p.birth), heightCm: p.heightCm, weightKg: p.weightKg, activity: p.activity, goal: p.goal };
}

/** Guarda el perfil. Si las macros no son personalizadas, recalcula metas.
 *  Registra el cambio de objetivo/meta en el historial. */
export async function saveProfile(p: Profile, opts: { recalc?: boolean } = {}) {
  let next = { ...p };
  if (opts.recalc || !p.customMacros) {
    const t = computeTargets(bodyOf(p));
    next = { ...next, ...t, customMacros: false };
  }
  const prev = await db.profile.get(1);
  await db.profile.put(next);
  if (!prev || prev.goal !== next.goal || prev.kcal !== next.kcal || prev.protein !== next.protein) {
    await db.goals.add({ date: isoDate(), goal: next.goal, kcal: next.kcal, protein: next.protein, carbs: next.carbs, fat: next.fat });
  }
  return next;
}

/** Registra peso del día (reemplaza si ya hay uno ese día) y actualiza el perfil. */
export async function logWeight(date: string, kg: number) {
  const existing = await db.weights.where('date').equals(date).first();
  if (existing?.id) await db.weights.update(existing.id, { kg });
  else await db.weights.add({ date, kg });
  const latest = await db.weights.orderBy('date').last();
  const p = await db.profile.get(1);
  if (p && latest) await db.profile.update(1, { weightKg: latest.kg });
}
