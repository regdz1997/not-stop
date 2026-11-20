// Puntuación nutricional, ajuste dinámico de metas, alertas, grasa corporal y ayuno.
// Todo es lógica pura para poder probarla sin navegador.
import { addDays, GOALS, macrosFor, round1, trend, type Goal } from './calc';

// ---------------- Puntuación nutricional diaria ----------------
export interface DayInput {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  glasses: number;
  distinctFoods: number;
}
export interface DayTargets { kcal: number; protein: number; carbs: number; fat: number; waterGoal: number }
export interface ScorePart { key: string; label: string; pts: number; max: number }
export interface Score { total: number; parts: ScorePart[]; tips: string[]; grade: string }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Puntos por cercanía relativa: pleno dentro de ±ok, cero a ±zero. */
function closeness(value: number, target: number, ok: number, zero: number): number {
  if (target <= 0) return 0;
  const dev = Math.abs(value - target) / target;
  if (dev <= ok) return 1;
  return clamp01(1 - (dev - ok) / (zero - ok));
}

export function fiberTarget(kcal: number) {
  return Math.round((kcal / 1000) * 14);
}

export function dailyScore(d: DayInput, t: DayTargets): Score {
  const fiberT = fiberTarget(t.kcal);
  const parts: ScorePart[] = [
    { key: 'kcal', label: 'Calorías', max: 30, pts: 30 * closeness(d.kcal, t.kcal, 0.08, 0.4) },
    { key: 'protein', label: 'Proteína', max: 25, pts: 25 * clamp01(d.p / (t.protein * 0.95)) },
    { key: 'carbs', label: 'Carbohidratos', max: 7.5, pts: 7.5 * closeness(d.c, t.carbs, 0.15, 0.6) },
    { key: 'fat', label: 'Grasa', max: 7.5, pts: 7.5 * closeness(d.f, t.fat, 0.15, 0.6) },
    { key: 'fiber', label: 'Fibra', max: 12, pts: 12 * clamp01(d.fiber / fiberT) },
    { key: 'water', label: 'Agua', max: 10, pts: 10 * clamp01(d.glasses / Math.max(1, t.waterGoal)) },
    { key: 'variety', label: 'Variedad', max: 8, pts: 8 * clamp01(d.distinctFoods / 8) },
  ].map((p) => ({ ...p, pts: Math.round(p.pts * 10) / 10 }));
  const total = Math.round(parts.reduce((a, p) => a + p.pts, 0));

  const tips: string[] = [];
  const pLeft = Math.round(t.protein - d.p);
  if (pLeft > 15) tips.push(`Te faltan ${pLeft} g de proteína: pollo, huevos, atún, yogur griego o lentejas.`);
  if (d.kcal > t.kcal * 1.1) tips.push(`Te pasaste ${Math.round(d.kcal - t.kcal)} kcal. Mañana prioriza verduras y proteína magra.`);
  else if (d.kcal < t.kcal * 0.75 && d.kcal > 0) tips.push(`Vas ${Math.round(t.kcal - d.kcal)} kcal por debajo. Comer muy poco frena tu energía y tu fuerza.`);
  if (d.fiber < fiberT * 0.7) tips.push(`Poca fibra hoy (${Math.round(d.fiber)} de ${fiberT} g): suma frijoles, avena, fruta o verduras.`);
  if (d.glasses < t.waterGoal * 0.75) tips.push(`Bebe agua: llevas ${d.glasses} de ${t.waterGoal} vasos.`);
  if (d.f > t.fat * 1.3) tips.push('Mucha grasa: revisa frituras, aceites y quesos.');
  if (d.distinctFoods > 0 && d.distinctFoods < 5) tips.push('Poca variedad: agrega frutas y verduras de colores distintos.');
  if (tips.length === 0 && d.kcal > 0) tips.push('¡Día muy bien equilibrado! Sigue así.');

  const grade = total >= 85 ? 'Excelente' : total >= 70 ? 'Bueno' : total >= 50 ? 'Regular' : 'Por mejorar';
  return { total, parts, tips, grade };
}

// ---------------- Ajuste dinámico de calorías ----------------
export interface AdaptiveInput {
  today: string;
  intakeByDay: Record<string, number>; // kcal registradas por día
  weights: { date: string; kg: number }[]; // ordenados por fecha
  currentKcal: number;
  goal: Goal;
  weightKg: number;
  minKcal: number;
  days?: number;
}
export interface AdaptiveResult {
  ok: boolean;
  reason?: string;
  tdee?: number;
  avgIntake?: number;
  trendChangeKg?: number;
  loggedDays?: number;
  proposedKcal?: number;
  explanation?: string;
}

/** Estima el gasto real con lo comido y la tendencia del peso (7700 kcal ≈ 1 kg). */
export function adaptiveTarget(i: AdaptiveInput): AdaptiveResult {
  const days = i.days ?? 21;
  const start = addDays(i.today, -days);
  const dates = Object.keys(i.intakeByDay).filter((d) => d > start && d < i.today && i.intakeByDay[d] >= 800);
  if (dates.length < 10) return { ok: false, reason: `Necesito al menos 10 días completos registrados en las últimas 3 semanas (tienes ${dates.length}).` };
  const ws = i.weights.filter((w) => w.date > addDays(start, -14) && w.date <= i.today);
  const inWindow = ws.filter((w) => w.date > start);
  if (inWindow.length < 4) return { ok: false, reason: `Necesito al menos 4 pesajes en las últimas 3 semanas (tienes ${inWindow.length}).` };
  const span = (Date.parse(inWindow[inWindow.length - 1].date) - Date.parse(inWindow[0].date)) / 86400000;
  if (span < 10) return { ok: false, reason: 'Los pesajes deben cubrir al menos 10 días.' };

  // Tendencia sobre todos los pesajes (incluye 2 semanas previas para estabilizar)
  const tr = trend(ws.map((w) => w.kg));
  const firstIdx = ws.findIndex((w) => w.date > start);
  const change = tr[tr.length - 1] - tr[Math.max(0, firstIdx)];
  const avgIntake = dates.reduce((a, d) => a + i.intakeByDay[d], 0) / dates.length;
  const tdee = Math.round(avgIntake - (change * 7700) / span);
  const ideal = tdee * (1 + GOALS[i.goal].adj);
  // Cambios suaves: máximo ±200 kcal por semana.
  const delta = Math.max(-200, Math.min(200, ideal - i.currentKcal));
  const proposed = Math.max(i.minKcal, Math.round((i.currentKcal + delta) / 10) * 10);
  const weekly = round1((change / span) * 7);
  const dir = weekly < -0.05 ? `bajando ${Math.abs(weekly)} kg/semana` : weekly > 0.05 ? `subiendo ${weekly} kg/semana` : 'estable';
  let explanation = `En ${dates.length} días comiste en promedio ${Math.round(avgIntake)} kcal y tu peso (tendencia) está ${dir}. Eso indica que gastas unas ${tdee} kcal al día.`;
  if (Math.abs(proposed - i.currentKcal) < 30) explanation += ' Tu meta actual ya encaja: no hace falta cambiarla.';
  else explanation += ` Para «${GOALS[i.goal].label.toLowerCase()}» te propongo ${proposed} kcal (${proposed > i.currentKcal ? '+' : ''}${proposed - i.currentKcal}). Limito el cambio a 200 kcal por semana para ajustar con calma.`;
  return { ok: true, tdee, avgIntake: Math.round(avgIntake), trendChangeKg: round1(change), loggedDays: dates.length, proposedKcal: proposed, explanation };
}

export function applyAdaptive(kcal: number, weightKg: number, goal: Goal) {
  return macrosFor(kcal, weightKg, goal);
}

// ---------------- Alertas proactivas ----------------
export interface Alert { id: string; icon: string; title: string; text: string }
export function proactiveAlerts(a: {
  today: string;
  loggedDates: string[]; // días con al menos un registro
  proteinByDay: Record<string, number>;
  proteinTarget: number;
  weights: { date: string; kg: number }[];
  goal: Goal;
}): Alert[] {
  const out: Alert[] = [];
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(a.today, -(i + 1)));
  const logged = last7.filter((d) => a.loggedDates.includes(d)).length;
  if (a.loggedDates.length > 0 && logged <= 2) {
    out.push({ id: 'nolog', icon: '📝', title: 'Semana con pocos registros', text: `Solo registraste ${logged} de los últimos 7 días. Registrar aunque sea lo aproximado te ayuda a ver avances.` });
  }
  const recent = last7.filter((d) => a.proteinByDay[d] !== undefined).slice(0, 4);
  const low = recent.filter((d) => a.proteinByDay[d] < a.proteinTarget * 0.8).length;
  if (recent.length >= 3 && low >= 3) {
    out.push({ id: 'lowprot', icon: '🥩', title: 'Proteína baja varios días', text: `${low} de tus últimos ${recent.length} días quedaste por debajo del 80 % de tu proteína (${a.proteinTarget} g). Para conservar músculo mientras bajas, súmale una fuente en cada comida.` });
  }
  if (a.goal !== 'mantener' && a.weights.length >= 4) {
    const from = addDays(a.today, -21);
    const ws = a.weights.filter((w) => w.date >= addDays(from, -14));
    const tr = trend(ws.map((w) => w.kg));
    const startIdx = ws.findIndex((w) => w.date >= from);
    const recentWs = ws.filter((w) => w.date >= from);
    if (startIdx >= 0 && recentWs.length >= 3) {
      const change = tr[tr.length - 1] - tr[startIdx];
      const stalled = a.goal === 'perder' ? change > -0.2 : change < 0.15;
      if (stalled) out.push({ id: 'stall', icon: '⏸️', title: 'Peso estancado', text: `Tu tendencia cambió ${change > 0 ? '+' : ''}${round1(change)} kg en 3 semanas. Revisa que estés registrando todo (aceites, salsas, bebidas) o acepta el ajuste semanal de calorías.` });
    }
  }
  return out;
}

// ---------------- Grasa corporal (Marina de EE. UU.) ----------------
/** Medidas en cm. Devuelve % de grasa o null si las medidas no son válidas. */
export function navyBodyFat(sex: 'h' | 'm', heightCm: number, waist: number, neck: number, hip?: number): number | null {
  if (!heightCm || !waist || !neck) return null;
  let bf: number;
  if (sex === 'h') {
    if (waist - neck <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hip || waist + hip - neck <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!isFinite(bf) || bf < 2 || bf > 70) return null;
  return round1(bf);
}

export function bodyFatCategory(sex: 'h' | 'm', bf: number): string {
  const r = sex === 'h' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (bf < r[0]) return 'Esencial';
  if (bf < r[1]) return 'Atlético';
  if (bf < r[2]) return 'Fitness';
  if (bf < r[3]) return 'Promedio';
  return 'Alto';
}

// ---------------- Ayuno intermitente ----------------
export const FAST_PROTOCOLS = [
  { id: '14:10', h: 14, desc: 'Suave, ideal para empezar' },
  { id: '16:8', h: 16, desc: 'El más popular' },
  { id: '18:6', h: 18, desc: 'Intermedio' },
  { id: '20:4', h: 20, desc: 'Avanzado' },
];

export function fastPhase(hours: number): { name: string; desc: string } {
  if (hours < 4) return { name: 'Digestión', desc: 'Tu cuerpo procesa la última comida.' };
  if (hours < 12) return { name: 'Glucosa bajando', desc: 'Empiezas a usar tus reservas de glucógeno.' };
  if (hours < 16) return { name: 'Más uso de grasa', desc: 'Con el glucógeno más bajo, aumenta el uso de grasa.' };
  if (hours < 24) return { name: 'Cetosis ligera', desc: 'Puede empezar la producción de cetonas.' };
  return { name: 'Ayuno prolongado', desc: 'Consulta a un profesional para ayunos de más de 24 h.' };
}

/** Racha: días consecutivos (terminando hoy o ayer) con un ayuno completado. */
export function fastStreak(fasts: { start: number; end?: number; targetH: number }[], today: string): number {
  const okDays = new Set(
    fasts
      .filter((f) => f.end && (f.end - f.start) / 3600000 >= f.targetH * 0.95)
      .map((f) => {
        const d = new Date(f.end!);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }),
  );
  let day = okDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (okDays.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
