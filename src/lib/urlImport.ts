import { db } from '../db';
import { isoDate } from './calc';
import { logWeight } from './profile';

/** Lee ?peso=&pasos=&fecha= (desde un Atajo de iOS) y lo guarda. Devuelve un mensaje o null. */
export async function importFromURL(search: string): Promise<string | null> {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const v = parseFloat((q.get(k) ?? '').replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };
  const fecha = q.get('fecha');
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= isoDate() ? fecha : isoDate();
  const parts: string[] = [];
  const peso = num('peso');
  if (peso !== null && peso >= 25 && peso <= 400) {
    await logWeight(date, Math.round(peso * 10) / 10);
    parts.push(`peso ${peso} kg`);
  }
  const pasos = num('pasos');
  if (pasos !== null && pasos >= 0 && pasos < 200000) {
    await db.steps.put({ date, steps: Math.round(pasos) });
    parts.push(`${Math.round(pasos)} pasos`);
  }
  return parts.length ? `📲 Importado de Salud: ${parts.join(' y ')}` : null;
}
