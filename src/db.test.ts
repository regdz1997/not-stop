import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, exportAll, exportCSV, importAll } from './db';

describe('copia de seguridad', () => {
  it('exporta, borra e importa sin perder datos', async () => {
    await db.open();
    expect(await db.routines.count()).toBe(3); // rutinas semilla
    await db.entries.add({ date: '2026-11-19', meal: 'desayuno', foodId: 'arepa', name: 'Arepa', qty: 2, servingLabel: 'unidad', grams: 180, kcal: 394, p: 8, c: 81, f: 3, fiber: 5, createdAt: 1 });
    await db.weights.add({ date: '2026-11-19', kg: 81 });
    await db.meals.add({ name: 'Desayuno habitual', uses: 0, items: [] });
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    await db.entries.clear();
    await db.weights.clear();
    await importAll(backup);
    expect(await db.entries.count()).toBe(1);
    expect((await db.weights.toArray())[0].kg).toBe(81);
    expect(await db.meals.count()).toBe(1);
    const csv = await exportCSV();
    expect(csv['comidas.csv']).toContain('Arepa');
  });
  it('rechaza archivos que no son de la app', async () => {
    await expect(importAll({ foo: 1 })).rejects.toThrow(/Not Stop/);
  });
});
