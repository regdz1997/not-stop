// Lógica pura (sin DOM ni base de datos) para poder probarla aparte.

export type Sex = 'h' | 'm';
export type Goal = 'perder' | 'mantener' | 'ganar';
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';

export const ACTIVITY: Record<Activity, { factor: number; label: string; desc: string }> = {
  sedentario: { factor: 1.2, label: 'Sedentario', desc: 'Trabajo sentado, casi sin ejercicio' },
  ligero: { factor: 1.375, label: 'Ligero', desc: '1–3 entrenos por semana' },
  moderado: { factor: 1.55, label: 'Moderado', desc: '3–5 entrenos por semana' },
  alto: { factor: 1.725, label: 'Alto', desc: '6–7 entrenos por semana' },
  muy_alto: { factor: 1.9, label: 'Muy alto', desc: 'Trabajo físico + entreno diario' },
};

export const GOALS: Record<Goal, { label: string; desc: string; adj: number }> = {
  perder: { label: 'Bajar de peso', desc: 'Déficit de ~20 % para perder grasa', adj: -0.2 },
  mantener: { label: 'Mantener mi peso', desc: 'Comer lo que gasto', adj: 0 },
  ganar: { label: 'Ganar músculo', desc: 'Superávit de ~10 % con proteína alta', adj: 0.1 },
};

export interface BodyData {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Metabolismo basal, Mifflin-St Jeor. */
export function bmr({ sex, age, heightCm, weightKg }: Pick<BodyData, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'h' ? base + 5 : base - 161;
}

export function tdee(d: BodyData): number {
  return bmr(d) * ACTIVITY[d.activity].factor;
}

/** Proteína por defecto según objetivo (g por kg). */
export function proteinPerKg(goal: Goal): number {
  return goal === 'mantener' ? 1.8 : goal === 'ganar' ? 2.0 : 2.2;
}

export function computeTargets(d: BodyData): Targets {
  const minKcal = d.sex === 'h' ? 1500 : 1200;
  const kcal = Math.max(minKcal, Math.round((tdee(d) * (1 + GOALS[d.goal].adj)) / 10) * 10);
  return macrosFor(kcal, d.weightKg, d.goal);
}

export function macrosFor(kcal: number, weightKg: number, goal: Goal): Targets {
  const protein = Math.round(weightKg * proteinPerKg(goal));
  const fat = Math.round(Math.max(weightKg * 0.8, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

// ---------- Alimentos y porciones ----------
export interface Nutr {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}

export function scale(per100: Nutr, grams: number): Nutr {
  const k = grams / 100;
  return {
    kcal: Math.round(per100.kcal * k),
    p: round1(per100.p * k),
    c: round1(per100.c * k),
    f: round1(per100.f * k),
    fiber: round1(per100.fiber * k),
  };
}

export function sumNutr(list: Partial<Nutr>[]): Nutr {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  for (const n of list) {
    t.kcal += n.kcal ?? 0;
    t.p += n.p ?? 0;
    t.c += n.c ?? 0;
    t.f += n.f ?? 0;
    t.fiber += n.fiber ?? 0;
  }
  return { kcal: Math.round(t.kcal), p: round1(t.p), c: round1(t.c), f: round1(t.f), fiber: round1(t.fiber) };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Calorías restantes = meta − consumidas + quemadas. */
export function remaining(goal: number, eaten: number, burned: number): number {
  return Math.round(goal - eaten + burned);
}

// ---------- Entrenamiento ----------
/** 1RM estimado (Epley). Con 1 repetición devuelve el propio peso. */
export function oneRM(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0) return 0;
  if (reps === 1) return kg;
  return round1(kg * (1 + reps / 30));
}

/** kcal = MET × peso (kg) × horas. */
export function kcalMET(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * weightKg * (minutes / 60));
}

export const MET_FUERZA = 5.0;

/** MET de trote según velocidad (Compendio de actividades físicas, interpolado). */
export function runMET(kmh: number): number {
  const t: [number, number][] = [
    [6.4, 6.0], [8.0, 8.3], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.8], [12.9, 12.3], [13.8, 12.8], [14.5, 14.5], [16.1, 16.0], [17.7, 19.0],
  ];
  if (kmh <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (kmh <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return round1(y0 + ((kmh - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return t[t.length - 1][1];
}

export function runKcal(km: number, minutes: number, weightKg: number): number {
  if (km <= 0 || minutes <= 0) return 0;
  return kcalMET(runMET(km / (minutes / 60)), weightKg, minutes);
}

/** Ritmo en min/km como "5:30". */
export function pace(km: number, minutes: number): string {
  if (km <= 0 || minutes <= 0) return '–';
  const secPerKm = Math.round((minutes * 60) / km);
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`;
}

// ---------- Peso ----------
/** Tendencia por media móvil exponencial. Entrada ordenada por fecha. */
export function trend(values: number[], alpha = 0.1): number[] {
  const out: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = out.length === 0 ? v : prev + alpha * (v - prev);
    out.push(Math.round(prev * 100) / 100);
  }
  return out;
}

export const KG_PER_LB = 0.45359237;
export const toDisplayWeight = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? round1(kg) : round1(kg / KG_PER_LB));
export const fromDisplayWeight = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : round1(v * KG_PER_LB));

// ---------- Fechas (zona local) ----------
export function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Lunes de la semana de la fecha dada. */
export function weekStart(s: string): string {
  const d = parseISO(s);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return isoDate(d);
}

export function ageFromBirth(birth: string, today = isoDate()): number {
  const b = parseISO(birth);
  const t = parseISO(today);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

export type MealKey = 'desayuno' | 'almuerzo' | 'cena' | 'snacks';
export const MEALS: { key: MealKey; label: string; icon: string }[] = [
  { key: 'desayuno', label: 'Desayuno', icon: '🍳' },
  { key: 'almuerzo', label: 'Almuerzo', icon: '🍛' },
  { key: 'cena', label: 'Cena', icon: '🍲' },
  { key: 'snacks', label: 'Snacks', icon: '🍎' },
];

export function mealForHour(h: number): MealKey {
  if (h >= 5 && h < 11) return 'desayuno';
  if (h >= 11 && h < 16) return 'almuerzo';
  if (h >= 18 && h < 23) return 'cena';
  return 'snacks';
}
