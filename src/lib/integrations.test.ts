import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { analyzeFood, analyzeMeal, coachReply, friendlyError, sanitizeMeal } from './ai';
import { lookupBarcode, offToFood, searchOFF } from './off';
import { buildICS } from './ics';
import { importFromURL } from './urlImport';
import { db } from '../db';
import { isoDate } from './calc';

// Servidor simulado: guarda la última petición y responde lo que le digamos.
function fakeFetch(respond: (url: string, body: any) => Response) {
  const calls: { url: string; body: any; headers: Headers }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const h = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((v, k) => h.set(k, v));
    calls.push({ url, body, headers: h });
    return respond(url, body);
  }) as typeof fetch;
  return { f, calls };
}

const message = (text: string, stop = 'end_turn') =>
  new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } }), { status: 200, headers: { 'content-type': 'application/json' } });

describe('IA: registro de comidas', () => {
  const meal = { items: [{ name: 'Arepa', quantity: 1, unit: 'unidad', grams: 90, kcal: 197, protein: 4, carbs: 40, fat: 2, fiber: 3 }, { name: 'Café con leche', quantity: 1, unit: 'taza', grams: 240, kcal: 130, protein: 6, carbs: 17, fat: 4, fiber: 0 }], note: 'Arepa asada sin mantequilla' };

  it('envía texto con salida estructurada y devuelve los alimentos', async () => {
    const { f, calls } = fakeFetch(() => message(JSON.stringify(meal)));
    const r = await analyzeMeal({ apiKey: 'sk-test', fetch: f }, { text: 'una arepa y un café con leche' });
    expect(r.items).toHaveLength(2);
    expect(r.items[0].kcal).toBe(197);
    const b = calls[0].body;
    expect(calls[0].url).toContain('/v1/messages');
    expect(b.model).toBe('claude-opus-5-5');
    expect(b.output_config.format.type).toBe('json_schema');
    expect(b.output_config.effort).toBe('low');
    expect(JSON.stringify(b.messages)).toContain('una arepa y un café con leche');
    expect(calls[0].headers.get('authorization')).toBe('Bearer sk-test');
    expect(calls[0].headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
  });

  it('envía la foto como imagen base64 y respeta el modelo elegido', async () => {
    const { f, calls } = fakeFetch(() => message(JSON.stringify(meal)));
    await analyzeMeal({ apiKey: 'sk-test', model: 'claude-haiku-5-5', fetch: f }, { image: { base64: 'AAAA', mediaType: 'image/jpeg' } });
    const content = calls[0].body.messages[0].content;
    expect(content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(calls[0].body.model).toBe('claude-haiku-5-5');
  });

  it('sin clave avisa sin llamar a la red', async () => {
    const { f, calls } = fakeFetch(() => message('{}'));
    await expect(analyzeMeal({ apiKey: '', fetch: f }, { text: 'x' })).rejects.toThrow(/clave/i);
    expect(calls).toHaveLength(0);
  });

  it('clave inválida → mensaje claro en español', async () => {
    const { f } = fakeFetch(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    try {
      await analyzeMeal({ apiKey: 'sk-mala', fetch: f }, { text: 'arroz' });
      throw new Error('debía fallar');
    } catch (e) {
      expect(friendlyError(e)).toMatch(/clave de API no es válida/);
    }
  });

  it('respuesta rechazada → error controlado', async () => {
    const { f } = fakeFetch(() => message('', 'refusal'));
    await expect(analyzeMeal({ apiKey: 'sk', fetch: f }, { text: 'x' })).rejects.toThrow(/no pudo procesar/);
  });

  it('limpia valores imposibles', () => {
    const r = sanitizeMeal({ note: '', items: [{ name: ' Pan ', quantity: -1, unit: 'unidad', grams: 50, kcal: NaN, protein: 4, carbs: 25, fat: 1, fiber: 1 }, { name: 'Nada', quantity: 1, unit: 'g', grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }] });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ name: 'Pan', quantity: 1, kcal: 0 });
  });

  it('lee una etiqueta nutricional', async () => {
    const label = { name: 'Galletas de avena', brand: 'Marca X', servingLabel: 'galleta', servingGrams: 12, per100: { kcal: 450, protein: 7, carbs: 65, fat: 18, fiber: 5, sugar: 22, sodiumMg: 300 } };
    const { f } = fakeFetch(() => message(JSON.stringify(label)));
    const r = await analyzeFood({ apiKey: 'sk', fetch: f }, { text: 'galletas de avena' });
    expect(r.per100.kcal).toBe(450);
    expect(r.servingGrams).toBe(12);
  });
});

describe('IA: coach con streaming', () => {
  it('recibe el texto por partes y envía el contexto como mensaje de sistema al final', async () => {
    const ev = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const sse = [
      ev('message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } }),
      ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Te quedan ' } }),
      ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '600 kcal.' } }),
      ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
      ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 6 } }),
      ev('message_stop', { type: 'message_stop' }),
    ].join('');
    const { f, calls } = fakeFetch(() => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    const parts: string[] = [];
    const out = await coachReply({ apiKey: 'sk', fetch: f }, 'Metas: 2140 kcal', [{ role: 'user', text: '¿Cómo voy?' }], (d) => parts.push(d));
    expect(out).toBe('Te quedan 600 kcal.');
    expect(parts).toEqual(['Te quedan ', '600 kcal.']);
    const msgs = calls[0].body.messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ role: 'system' });
    expect(msgs[msgs.length - 1].content).toContain('2140 kcal');
    expect(calls[0].body.stream).toBe(true);
  });
});

describe('Open Food Facts', () => {
  const product = { code: '7702011000000', product_name: 'Galletas Saladas', brands: 'Marca A, Grupo B', serving_quantity: 30, serving_size: '30 g', nutriments: { 'energy-kcal_100g': 420, proteins_100g: 9, carbohydrates_100g: 70, fat_100g: 11, fiber_100g: 3, sugars_100g: 4, sodium_100g: 0.8 } };
  it('convierte un producto a alimento', () => {
    const f = offToFood(product)!;
    expect(f).toMatchObject({ id: 'off-7702011000000', name: 'Galletas Saladas', brand: 'Marca A', kcal: 420, p: 9, sodium: 800 });
    expect(f.servings[0]).toMatchObject({ g: 30 });
  });
  it('calcula kcal desde kJ si falta', () => {
    const f = offToFood({ ...product, nutriments: { energy_100g: 1757, proteins_100g: 9 } })!;
    expect(f.kcal).toBe(420);
  });
  it('busca por código y por texto', async () => {
    const { f, calls } = fakeFetch((url) =>
      url.includes('/product/') ? new Response(JSON.stringify({ status: 1, product })) : new Response(JSON.stringify({ products: [product, { code: '1', product_name: '' }] })),
    );
    expect((await lookupBarcode('7702011000000', f))!.name).toBe('Galletas Saladas');
    expect(calls[0].url).toContain('/api/v2/product/7702011000000.json');
    const list = await searchOFF('galletas', f);
    expect(list).toHaveLength(1);
  });
  it('producto inexistente → null', async () => {
    const { f } = fakeFetch(() => new Response(JSON.stringify({ status: 0 }), { status: 404 }));
    expect(await lookupBarcode('123456789', f)).toBeNull();
  });
});

describe('Calendario (.ics)', () => {
  it('genera eventos diarios con alarma', () => {
    const ics = buildICS([{ title: 'Desayuno, registra', time: '08:30' }, { title: 'Cena', time: '23:55' }], new Date(2026, 10, 19));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20261119T083000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('SUMMARY:Desayuno\\, registra');
    expect(ics).toContain('BEGIN:VALARM');
  });
  it('evento único sin repetición', () => {
    const ics = buildICS([{ title: 'Fin de ayuno', time: '12:00', once: true, date: new Date(2026, 10, 20) }]);
    expect(ics).not.toContain('RRULE');
    expect(ics).toContain('DTSTART:20261120T120000');
  });
});

describe('Importación desde Atajo de iOS', () => {
  it('guarda peso y pasos de la URL', async () => {
    await db.open();
    const msg = await importFromURL('?peso=81,4&pasos=9123');
    expect(msg).toMatch(/81\.4|81,4/);
    expect((await db.weights.toArray()).at(-1)!.kg).toBe(81.4);
    expect((await db.steps.get(isoDate()))!.steps).toBe(9123);
  });
  it('ignora valores absurdos', async () => {
    expect(await importFromURL('?peso=9999&pasos=-5')).toBeNull();
    expect(await importFromURL('')).toBeNull();
  });
});
