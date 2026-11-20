import Dexie, { type Table } from 'dexie';
import type { Activity, Goal, MealKey, Sex } from './lib/calc';
import type { Food } from './data/foods';
import type { Exercise } from './data/exercises';
import { SEED_ROUTINES } from './data/exercises';

export interface Profile {
  id: 1;
  name: string;
  sex: Sex;
  birth: string; // AAAA-MM-DD
  heightCm: number;
  weightKg: number; // peso al momento del último cálculo
  targetKg: number;
  activity: Activity;
  goal: Goal;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  customMacros: boolean;
  waterGoal: number; // vasos de 250 ml
  unit: 'kg' | 'lb';
  restSec: number;
  aiKey?: string;
  aiModel?: string;
  createdAt: string;
  // v2–v4
  dietType?: DietType;
  excluded?: string[]; // palabras de alimentos que no quiero
  mealsPerDay?: 3 | 4 | 5;
  reminders?: Partial<Record<MealKey, string>>; // 'HH:MM'
  adaptive?: boolean; // ajuste dinámico semanal activado
}

export type DietType = 'normal' | 'vegetariana' | 'alta_proteina' | 'baja_carbos';

export interface Measurement { id?: number; date: string; waist?: number; hip?: number; chest?: number; arm?: number; thigh?: number; neck?: number; bodyFat?: number }
export interface Photo { id?: number; date: string; blob: Blob; note?: string; pose?: string }
export interface Fast { id?: number; start: number; end?: number; targetH: number; protocol: string }
export interface RecipeIng { foodId: string; grams: number }
export interface Recipe { id: string; name: string; meals: MealKey[]; servings: number; ingredients: RecipeIng[]; steps: string[]; minutes: number; emoji: string; custom?: boolean }
export interface PlanItem { recipeId: string; factor: number; extra?: boolean }
export interface PlanDay { date: string; meals: Partial<Record<MealKey, PlanItem[]>> }
export interface ChatMsg { id?: number; role: 'user' | 'assistant'; text: string; at: number; image?: string }
export interface Steps { date: string; steps: number }

export interface Entry {
  id?: number;
  date: string;
  meal: MealKey;
  foodId: string;
  name: string;
  qty: number;
  servingLabel: string;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  createdAt: number;
}

export interface SavedMealItem {
  foodId: string;
  name: string;
  qty: number;
  servingLabel: string;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}

export interface SavedMeal {
  id?: number;
  name: string;
  items: SavedMealItem[];
  uses: number;
}

export interface Water { date: string; glasses: number }
export interface Weight { id?: number; date: string; kg: number }

export interface Routine { id?: number; name: string; exerciseIds: string[] }

export interface WSet { kg: number; reps: number; done: boolean }
export interface WExercise { exId: string; name: string; sets: WSet[] }
export interface Workout {
  id?: number;
  date: string;
  name: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
  kcal: number;
  notes: string;
  exercises: WExercise[];
}

export interface Run {
  id?: number;
  date: string;
  km: number;
  minutes: number;
  rpe: number;
  kcal: number;
  notes: string;
}

export interface GoalChange { id?: number; date: string; goal: Goal; kcal: number; protein: number; carbs: number; fat: number }
export interface Favorite { foodId: string }
export interface KV { key: string; value: unknown }

class NSDB extends Dexie {
  profile!: Table<Profile, number>;
  entries!: Table<Entry, number>;
  foods!: Table<Food, string>;
  favorites!: Table<Favorite, string>;
  meals!: Table<SavedMeal, number>;
  water!: Table<Water, string>;
  weights!: Table<Weight, number>;
  routines!: Table<Routine, number>;
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, number>;
  runs!: Table<Run, number>;
  goals!: Table<GoalChange, number>;
  kv!: Table<KV, string>;
  measurements!: Table<Measurement, number>;
  photos!: Table<Photo, number>;
  fasts!: Table<Fast, number>;
  recipes!: Table<Recipe, string>;
  plans!: Table<PlanDay, string>;
  chat!: Table<ChatMsg, number>;
  steps!: Table<Steps, string>;

  constructor() {
    super('notstop');
    this.version(1).stores({
      profile: 'id',
      entries: '++id, date, foodId, createdAt',
      foods: 'id, name',
      favorites: 'foodId',
      meals: '++id, name',
      water: 'date',
      weights: '++id, date',
      routines: '++id, name',
      exercises: 'id, group',
      workouts: '++id, date',
      runs: '++id, date',
      goals: '++id, date',
      kv: 'key',
    });
    this.version(2).stores({ workouts: '++id, date, startedAt' });
    this.version(3).stores({
      measurements: '++id, date',
      photos: '++id, date',
      fasts: '++id, start',
      recipes: 'id',
      plans: 'date',
      chat: '++id, at',
      steps: 'date',
    });
    this.on('populate', (tx) => {
      tx.table('routines').bulkAdd(SEED_ROUTINES);
    });
  }
}

export const db = new NSDB();

export const TABLES = ['profile', 'entries', 'foods', 'favorites', 'meals', 'water', 'weights', 'routines', 'exercises', 'workouts', 'runs', 'goals', 'kv', 'measurements', 'fasts', 'recipes', 'plans', 'chat', 'steps'] as const;

export async function exportAll() {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.table(t).toArray();
  out.photos = await Promise.all((await db.photos.toArray()).map(async (ph) => ({ ...ph, blob: await blobToDataURL(ph.blob) })));
  return { app: 'not-stop', version: 1, exportedAt: new Date().toISOString(), data: out };
}

export async function importAll(json: unknown) {
  const j = json as { app?: string; data?: Record<string, unknown[]> };
  if (j?.app !== 'not-stop' || !j.data) throw new Error('El archivo no es una copia de seguridad de Not Stop.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = j.data![t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkAdd(rows);
    }
  });
  await db.photos.clear();
  const photos = j.data.photos;
  if (Array.isArray(photos)) {
    for (const ph of photos as (Omit<Photo, 'blob'> & { blob: string })[]) {
      await db.photos.add({ ...ph, blob: dataURLToBlob(ph.blob) });
    }
  }
}

function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => (typeof v === 'string' && /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');
}

export async function exportCSV(): Promise<Record<string, string>> {
  const entries = await db.entries.orderBy('date').toArray();
  const weights = await db.weights.orderBy('date').toArray();
  const workouts = await db.workouts.orderBy('date').toArray();
  const runs = await db.runs.orderBy('date').toArray();
  return {
    'comidas.csv': csv([
      ['fecha', 'comida', 'alimento', 'cantidad', 'porcion', 'gramos', 'kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'fibra_g'],
      ...entries.map((e) => [e.date, e.meal, e.name, e.qty, e.servingLabel, e.grams, e.kcal, e.p, e.c, e.f, e.fiber]),
    ]),
    'peso.csv': csv([['fecha', 'kg'], ...weights.map((w) => [w.date, w.kg])]),
    'entrenos.csv': csv([
      ['fecha', 'entreno', 'minutos', 'kcal', 'ejercicio', 'serie', 'kg', 'reps'],
      ...workouts.flatMap((w) => w.exercises.flatMap((x) => x.sets.filter((s) => s.done).map((s, i) => [w.date, w.name, w.minutes, w.kcal, x.name, i + 1, s.kg, s.reps]))),
    ]),
    'trotes.csv': csv([['fecha', 'km', 'minutos', 'esfuerzo', 'kcal'], ...runs.map((r) => [r.date, r.km, r.minutes, r.rpe, r.kcal])]),
  };
}

export function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export function dataURLToBlob(url: string): Blob {
  const [head, data] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
