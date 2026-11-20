// Proyección del peso hacia la meta.
// Simula día a día: el gasto (TDEE) baja a medida que bajas de peso, así la
// proyección no es una recta optimista sino una curva realista (7700 kcal ≈ 1 kg).
import { ACTIVITY, addDays, bmr, isoDate, round1, trend, type Activity, type Sex } from './calc';

export const KCAL_PER_KG = 7700;

export interface SimInput {
  sex: Sex;
  age: number;
  heightCm: number;
  activity: Activity;
  startKg: number;
  targetKg: number;
  dailyKcal: number;
  /** Corrección del gasto: diferencia entre el gasto real estimado y la fórmula (kcal/día). */
  tdeeOffset?: number;
  maxDays?: number;
}

export interface SimResult {
  reachable: boolean;
  days: number | null;
  date: string | null;
  /** Peso al final de cada semana (incluye la semana 0). */
  weekly: number[];
  /** Ritmo inicial en kg por semana (negativo = bajar). */
  initialRate: number;
  initialDeficit: number;
  reason?: string;
}

export function tdeeAt(i: Pick<SimInput, 'sex' | 'age' | 'heightCm' | 'activity' | 'tdeeOffset'>, kg: number) {
  return bmr({ sex: i.sex, age: i.age, heightCm: i.heightCm, weightKg: kg }) * ACTIVITY[i.activity].factor + (i.tdeeOffset ?? 0);
}

export function simulate(i: SimInput, today = isoDate()): SimResult {
  const maxDays = i.maxDays ?? 3 * 365;
  const losing = i.targetKg < i.startKg;
  const initialDeficit = Math.round(tdeeAt(i, i.startKg) - i.dailyKcal);
  const initialRate = round1((-initialDeficit * 7) / KCAL_PER_KG * 10) / 10;
  const weekly = [round1(i.startKg)];
  if (Math.abs(i.startKg - i.targetKg) < 0.05) return { reachable: true, days: 0, date: today, weekly, initialRate, initialDeficit };
  if ((losing && initialDeficit <= 0) || (!losing && initialDeficit >= 0)) {
    return {
      reachable: false, days: null, date: null, weekly, initialRate, initialDeficit,
      reason: losing ? 'Con estas calorías no hay déficit: tu peso no bajaría.' : 'Con estas calorías no hay superávit: tu peso no subiría.',
    };
  }
  // Peso de equilibrio: donde lo que comes iguala lo que gastas (el BMR es lineal en el peso).
  const f = ACTIVITY[i.activity].factor;
  const eq = ((i.dailyKcal - (i.tdeeOffset ?? 0)) / f - (bmr({ sex: i.sex, age: i.age, heightCm: i.heightCm, weightKg: 0 }))) / 10;
  if ((losing && eq > i.targetKg + 0.05) || (!losing && eq < i.targetKg - 0.05)) {
    return { reachable: false, days: null, date: null, weekly, initialRate, initialDeficit, reason: `Con estas calorías te estabilizarías cerca de ${round1(eq)} kg, antes de tu meta.` };
  }
  let w = i.startKg;
  for (let d = 1; d <= maxDays; d++) {
    w -= (tdeeAt(i, w) - i.dailyKcal) / KCAL_PER_KG;
    if (d % 7 === 0) weekly.push(round1(w));
    if ((losing && w <= i.targetKg) || (!losing && w >= i.targetKg)) {
      if (d % 7 !== 0) weekly.push(round1(i.targetKg));
      return { reachable: true, days: d, date: addDays(today, d), weekly, initialRate, initialDeficit };
    }
    // Si el déficit se agota antes de llegar (equilibrio), no se alcanza.
    const def = tdeeAt(i, w) - i.dailyKcal;
    if ((losing && def <= 1) || (!losing && def >= -1)) {
      return { reachable: false, days: null, date: null, weekly, initialRate, initialDeficit, reason: `Con estas calorías te estabilizarías cerca de ${round1(w)} kg, antes de tu meta.` };
    }
  }
  return { reachable: false, days: null, date: null, weekly, initialRate, initialDeficit, reason: 'A este ritmo tardarías más de 3 años.' };
}

/** Pendiente de la tendencia (kg/semana) por regresión lineal de los últimos `days` días. */
export function trendRate(weights: { date: string; kg: number }[], today = isoDate(), days = 28): number | null {
  if (weights.length < 3) return null;
  const tr = smoothWeights(weights);
  const from = addDays(today, -days);
  const pts = weights.map((w, i) => ({ t: (Date.parse(w.date) - Date.parse(today)) / 86400000, y: tr[i], date: w.date })).filter((p) => p.date >= from);
  if (pts.length < 3) return null;
  const span = pts[pts.length - 1].t - pts[0].t;
  if (span < 10) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.t, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num = pts.reduce((a, p) => a + (p.t - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.t - mx) ** 2, 0);
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100;
}

export interface Scenario {
  key: 'plan' | 'comida' | 'tendencia';
  label: string;
  detail: string;
  days: number | null;
  date: string | null;
  rate: number; // kg/semana
  weekly: number[];
  reason?: string;
}

/** Construye los escenarios disponibles: según tu meta de calorías, según lo que comes y según tu tendencia real. */
export function scenarios(p: {
  sex: Sex; age: number; heightCm: number; activity: Activity;
  currentKg: number; targetKg: number; planKcal: number;
  avgIntake: number | null; loggedDays: number;
  weights: { date: string; kg: number }[];
  today?: string;
}): Scenario[] {
  const today = p.today ?? isoDate();
  const base = { sex: p.sex, age: p.age, heightCm: p.heightCm, activity: p.activity, startKg: p.currentKg, targetKg: p.targetKg };
  const out: Scenario[] = [];
  const plan = simulate({ ...base, dailyKcal: p.planKcal }, today);
  out.push({ key: 'plan', label: 'Si cumples tu meta', detail: `${p.planKcal} kcal al día · déficit de ${Math.abs(plan.initialDeficit)} kcal`, days: plan.days, date: plan.date, rate: plan.initialRate, weekly: plan.weekly, reason: plan.reason });
  if (p.avgIntake && p.loggedDays >= 7) {
    const real = simulate({ ...base, dailyKcal: p.avgIntake }, today);
    out.push({ key: 'comida', label: 'Con lo que comes de verdad', detail: `Promedio de ${p.loggedDays} días: ${Math.round(p.avgIntake)} kcal`, days: real.days, date: real.date, rate: real.initialRate, weekly: real.weekly, reason: real.reason });
  }
  const rate = trendRate(p.weights, today);
  if (rate !== null) {
    const losing = p.targetKg < p.currentKg;
    const ok = losing ? rate < -0.02 : rate > 0.02;
    const days = ok ? Math.ceil((Math.abs(p.currentKg - p.targetKg) / Math.abs(rate)) * 7) : null;
    const weekly: number[] = [p.currentKg];
    if (days) for (let wk = 1; wk <= Math.ceil(days / 7); wk++) weekly.push(round1(losing ? Math.max(p.targetKg, p.currentKg + rate * wk) : Math.min(p.targetKg, p.currentKg + rate * wk)));
    out.push({ key: 'tendencia', label: 'Según tu báscula', detail: `Tu tendencia de las últimas 4 semanas: ${rate > 0 ? '+' : '−'}${Math.abs(rate).toFixed(2).replace('.', ',')} kg/semana`, days, date: days ? addDays(today, days) : null, rate, weekly, reason: ok ? undefined : 'Tu peso no se está moviendo hacia la meta en las últimas semanas.' });
  }
  return out;
}

/** Ritmo seguro recomendado: entre 0,5 % y 1 % del peso por semana al bajar. */
export function rateAdvice(rate: number, kg: number, losing: boolean): { tone: 'ok' | 'warn' | 'slow'; text: string } {
  if (!losing) return rate > 0.5 ? { tone: 'warn', text: 'Ritmo de subida alto: puede ganar más grasa que músculo.' } : { tone: 'ok', text: 'Ritmo de subida adecuado para ganar músculo.' };
  const pct = (Math.abs(rate) / kg) * 100;
  if (pct > 1.1) return { tone: 'warn', text: 'Ritmo muy rápido: más de 1 % de tu peso por semana. Riesgo de perder músculo.' };
  if (pct < 0.3) return { tone: 'slow', text: 'Ritmo lento pero sostenible.' };
  return { tone: 'ok', text: 'Ritmo saludable: entre 0,3 % y 1 % de tu peso por semana.' };
}

/**
 * Tendencia suavizada SIN retraso: para cada pesaje ajusta una recta local
 * (pesos tricúbicos) con los pesajes de los 14 días anteriores y 7 posteriores,
 * y toma su valor en ese día. En el último pesaje solo usa el pasado, pero al
 * ser una recta sigue el ritmo real en vez de quedarse atrás como una media móvil.
 */
export function smoothWeights(ws: { date: string; kg: number }[]): number[] {
  const t = ws.map((w) => Date.parse(w.date) / 86400000);
  return ws.map((_, i) => {
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let j = 0; j < ws.length; j++) {
      const dt = t[j] - t[i];
      if (dt < -14 || dt > 7) continue;
      const u = Math.abs(dt) / (dt < 0 ? 15 : 8);
      const w = (1 - u ** 3) ** 3;
      sw += w; sx += w * dt; sy += w * ws[j].kg; sxx += w * dt * dt; sxy += w * dt * ws[j].kg;
    }
    if (sw === 0) return ws[i].kg;
    const den = sw * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return round1((sy / sw) * 10) / 10;
    const b = (sw * sxy - sx * sy) / den;
    const a = (sy - b * sx) / sw;
    return Math.round(a * 100) / 100; // valor de la recta en dt = 0
  });
}
