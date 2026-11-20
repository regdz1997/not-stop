// IA con la clave propia del usuario (guardada solo en el teléfono).
// Solo sale del teléfono lo que se envía a analizar: foto, texto o pregunta.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (más preciso)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (mucho más barato)' },
];
export const DEFAULT_MODEL = 'claude-opus-5-5';

export interface AIConfig {
  apiKey?: string;
  model?: string;
  fetch?: typeof fetch; // inyectable en pruebas
}

export class AIError extends Error {}

function client(cfg: AIConfig) {
  if (!cfg.apiKey?.trim()) throw new AIError('Agrega tu clave de API en Perfil → Inteligencia artificial para usar esta función.');
  // La clave es del propio usuario y vive en su teléfono; por eso se permite el uso desde el navegador.
  return new Anthropic({ apiKey: cfg.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2, ...(cfg.fetch ? { fetch: cfg.fetch } : {}) });
}

export function friendlyError(e: unknown): string {
  if (e instanceof AIError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de API no es válida. Revísala en Perfil.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para este modelo.';
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas solicitudes o sin saldo. Espera un momento o revisa tu cuenta.';
  if (e instanceof Anthropic.BadRequestError) return 'La solicitud no fue aceptada (¿imagen demasiado grande o ilegible?).';
  if (e instanceof Anthropic.APIConnectionError) return 'Sin conexión a internet. La IA necesita conexión; el resto de la app funciona sin ella.';
  if (e instanceof Anthropic.APIError) return `Error del servicio de IA (${e.status ?? '?'}). Intenta de nuevo.`;
  return e instanceof Error ? e.message : 'Error desconocido.';
}

// ---------------- Comidas por foto / voz / texto ----------------
const ItemSchema = z.object({
  name: z.string().describe('Nombre del alimento en español, claro y corto'),
  quantity: z.number().describe('Cantidad en la medida casera indicada'),
  unit: z.string().describe('Medida casera: unidad, taza, cucharada, plato, vaso, porción, rebanada, g'),
  grams: z.number().describe('Peso total estimado en gramos de esa cantidad'),
  kcal: z.number(),
  protein: z.number().describe('gramos'),
  carbs: z.number().describe('gramos'),
  fat: z.number().describe('gramos'),
  fiber: z.number().describe('gramos'),
});
const MealSchema = z.object({
  items: z.array(ItemSchema),
  note: z.string().describe('Una frase corta en español sobre supuestos tomados (aceite, tamaño), o vacío'),
});
export type AIItem = z.infer<typeof ItemSchema>;
export type AIMeal = z.infer<typeof MealSchema>;

const MEAL_SYSTEM = `Eres un nutricionista experto en comida latinoamericana. Conviertes descripciones o fotos de comidas en una lista de alimentos con cantidades y nutrientes estimados.
Reglas:
- Separa cada alimento (p. ej., "arepa con queso y café con leche" → arepa, queso, café con leche).
- Usa medidas caseras realistas y estima los gramos. Para fotos, estima tamaños con referencias visibles (plato, cubiertos, manos).
- Cuenta el aceite de cocción cuando sea típico (frituras, sofritos) e indícalo en "note".
- Los nutrientes son del total de la cantidad indicada, no por 100 g.
- Si no hay comida reconocible, devuelve items vacío y explícalo en "note".`;

/** El SDK lanza un error genérico si la respuesta no es JSON válido (p. ej., rechazada o vacía). */
async function parseSafe<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw e;
    if (e instanceof Error && /structured output|JSON/i.test(e.message)) throw new AIError('La IA no pudo procesar esta solicitud. Prueba con otra foto o una descripción más clara.');
    throw e;
  }
}

function checkStop(stop: string | null) {
  if (stop === 'refusal') throw new AIError('La IA no pudo procesar esta solicitud. Prueba con otra foto o descripción.');
  if (stop === 'max_tokens') throw new AIError('La respuesta fue demasiado larga. Divide la comida en partes.');
}

export async function analyzeMeal(cfg: AIConfig, input: { text?: string; image?: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } }): Promise<AIMeal> {
  const c = client(cfg);
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 } });
  content.push({ type: 'text', text: input.text?.trim() ? `Comida: ${input.text.trim()}` : 'Identifica los alimentos de la foto y estima porciones y nutrientes.' });
  const res = await parseSafe(c.messages.parse({
    model: cfg.model || DEFAULT_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(MealSchema) },
    system: MEAL_SYSTEM,
    messages: [{ role: 'user', content }],
  }));
  checkStop(res.stop_reason);
  if (!res.parsed_output) throw new AIError('No pude interpretar la respuesta de la IA. Intenta de nuevo.');
  return sanitizeMeal(res.parsed_output);
}

/** Limpia valores imposibles (negativos, NaN) que puedan venir de la IA. */
export function sanitizeMeal(m: AIMeal): AIMeal {
  const n = (x: number) => (Number.isFinite(x) && x > 0 ? Math.round(x * 10) / 10 : 0);
  return {
    note: m.note ?? '',
    items: m.items
      .filter((i) => i.name?.trim() && n(i.grams) > 0)
      .map((i) => ({ ...i, name: i.name.trim(), quantity: n(i.quantity) || 1, grams: n(i.grams), kcal: Math.round(n(i.kcal)), protein: n(i.protein), carbs: n(i.carbs), fat: n(i.fat), fiber: n(i.fiber) })),
  };
}

// ---------------- Etiqueta nutricional / alimento propio ----------------
const LabelSchema = z.object({
  name: z.string(),
  brand: z.string().describe('Marca o vacío'),
  servingLabel: z.string().describe('Nombre de la porción, p. ej. "porción", "galleta", "taza"'),
  servingGrams: z.number().describe('Gramos de una porción; 100 si no se indica'),
  per100: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), fiber: z.number(), sugar: z.number(), sodiumMg: z.number() }),
});
export type AILabel = z.infer<typeof LabelSchema>;

export async function analyzeFood(cfg: AIConfig, input: { text?: string; image?: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } }): Promise<AILabel> {
  const c = client(cfg);
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 } });
  content.push({
    type: 'text',
    text: input.image
      ? 'Lee esta etiqueta nutricional (o identifica el producto) y devuelve los valores por 100 g. Si la etiqueta da valores por porción, conviértelos a 100 g.'
      : `Describe los valores nutricionales aproximados por 100 g de: ${input.text}. Propón una porción casera típica.`,
  });
  const res = await parseSafe(c.messages.parse({
    model: cfg.model || DEFAULT_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(LabelSchema) },
    system: 'Eres un experto en etiquetado nutricional. Responde en español. Valores realistas y coherentes (kcal ≈ 4·P + 4·C + 9·G).',
    messages: [{ role: 'user', content }],
  }));
  checkStop(res.stop_reason);
  if (!res.parsed_output) throw new AIError('No pude leer la etiqueta. Intenta con una foto más nítida.');
  return res.parsed_output;
}

// ---------------- Coach (chat) ----------------
export const COACH_SYSTEM = `Eres el coach de nutrición y entrenamiento de la app Not Stop. Hablas en español latinoamericano, cercano y directo.
- Usa los datos del usuario que vienen en el contexto (metas, registros, peso, entrenos) para responder con números concretos.
- Respuestas breves: 3 a 8 frases o una lista corta. Nada de relleno.
- Para "¿qué cocino?", propone 2 o 3 opciones con ingredientes, cantidades en gramos o medidas caseras y macros aproximados que encajen en lo que le queda del día.
- Recuerda que las cifras son estimaciones. No diagnosticas enfermedades; si algo suena médico, sugiere consultar a un profesional.`;

export interface CoachTurn { role: 'user' | 'assistant'; text: string; image?: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } }

export async function coachReply(cfg: AIConfig, context: string, history: CoachTurn[], onText: (delta: string) => void): Promise<string> {
  const c = client(cfg);
  const messages: Anthropic.MessageParam[] = history.slice(-16).map((t) => ({
    role: t.role,
    content: t.image
      ? [{ type: 'image', source: { type: 'base64', media_type: t.image.mediaType, data: t.image.base64 } }, { type: 'text', text: t.text || '¿Qué puedo cocinar con esto?' }]
      : t.text,
  }));
  // El contexto cambia en cada pregunta: va como mensaje de sistema al final para no romper la caché del historial.
  messages.push({ role: 'system', content: `Datos actuales del usuario:\n${context}` } as unknown as Anthropic.MessageParam);
  const stream = c.messages.stream({
    model: cfg.model || DEFAULT_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: COACH_SYSTEM,
    messages,
  });
  stream.on('text', onText);
  const final = await stream.finalMessage();
  checkStop(final.stop_reason);
  return final.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

// ---------------- Utilidades de imagen ----------------
/** Reduce la foto (máx. 1280 px, JPEG) para enviar menos datos y gastar menos. */
export async function fileToImage(file: Blob, maxSide = 1280): Promise<{ base64: string; mediaType: 'image/jpeg'; dataUrl: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', dataUrl };
}

/** Comprueba la clave sin gastar tokens (consulta el modelo elegido). */
export async function testKey(cfg: AIConfig): Promise<string> {
  const c = client(cfg);
  const m = await c.models.retrieve(cfg.model || DEFAULT_MODEL);
  return m.display_name ?? m.id;
}
