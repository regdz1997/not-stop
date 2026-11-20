import { describe, expect, it } from 'vitest';
import { addDays } from './calc';
import { rateAdvice, scenarios, simulate, smoothWeights, tdeeAt, trendRate } from './projection';

const P = { sex: 'h' as const, age: 31, heightCm: 170, activity: 'moderado' as const };

describe('proyección de peso', () => {
  it('80 → 72 kg con 2120 kcal: llega en unas 4-6 semanas por kg… total razonable y fecha', () => {
    const r = simulate({ ...P, startKg: 80, targetKg: 72, dailyKcal: 2120 }, '2026-11-20');
    // Gasto inicial ≈ 1718 × 1,55 ≈ 2663 → déficit ≈ 543 kcal → ≈ 0,49 kg/semana
    expect(r.initialDeficit).toBeGreaterThan(500);
    expect(r.initialDeficit).toBeLessThan(590);
    expect(r.initialRate).toBeCloseTo(-0.49, 1);
    expect(r.reachable).toBe(true);
    // 8 kg a ~0,49 kg/sem serían ~114 días en línea recta; como el gasto baja, tarda más
    expect(r.days!).toBeGreaterThan(114);
    expect(r.days!).toBeLessThan(220);
    expect(r.date).toBe(addDays('2026-11-20', r.days!));
    expect(r.weekly[0]).toBe(80);
    expect(r.weekly.at(-1)).toBe(72);
    // La curva siempre baja
    for (let i = 1; i < r.weekly.length; i++) expect(r.weekly[i]).toBeLessThanOrEqual(r.weekly[i - 1]);
  });

  it('más déficit = antes', () => {
    const a = simulate({ ...P, startKg: 80, targetKg: 72, dailyKcal: 2120 });
    const b = simulate({ ...P, startKg: 80, targetKg: 72, dailyKcal: 1900 });
    expect(b.days!).toBeLessThan(a.days!);
  });

  it('sin déficit no se alcanza y lo explica', () => {
    const r = simulate({ ...P, startKg: 80, targetKg: 72, dailyKcal: 2800 });
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/no hay déficit/);
  });

  it('déficit pequeño que se agota antes de la meta', () => {
    // A 2550 kcal el equilibrio está por encima de 72 kg
    const r = simulate({ ...P, startKg: 80, targetKg: 72, dailyKcal: 2550 });
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/estabilizarías/);
  });

  it('el gasto baja al bajar de peso', () => {
    expect(tdeeAt(P, 72)).toBeLessThan(tdeeAt(P, 80));
  });

  it('subir de peso también funciona', () => {
    const r = simulate({ ...P, startKg: 70, targetKg: 74, dailyKcal: 3000 });
    expect(r.reachable).toBe(true);
    expect(r.initialRate).toBeGreaterThan(0);
  });

  it('ritmo según la báscula (regresión de la tendencia)', () => {
    const today = '2026-11-20';
    const ws = Array.from({ length: 30 }, (_, i) => ({ date: addDays(today, -29 + i), kg: 82 - i * (0.5 / 7) }));
    const r = trendRate(ws, today)!;
    expect(r).toBeLessThan(-0.3);
    expect(r).toBeGreaterThan(-0.6);
    expect(trendRate(ws.slice(-2), today)).toBeNull();
  });

  it('escenarios: plan siempre; comida con 7+ días; báscula con datos', () => {
    const today = '2026-11-20';
    const ws = Array.from({ length: 30 }, (_, i) => ({ date: addDays(today, -29 + i), kg: 82 - i * (0.5 / 7) }));
    const sc = scenarios({ ...P, currentKg: 80, targetKg: 72, planKcal: 2120, avgIntake: 2300, loggedDays: 12, weights: ws, today });
    expect(sc.map((s) => s.key)).toEqual(['plan', 'comida', 'tendencia']);
    // Comiendo más que el plan, se tarda más
    expect(sc[1].days!).toBeGreaterThan(sc[0].days!);
    expect(sc[2].date).not.toBeNull();
    expect(scenarios({ ...P, currentKg: 80, targetKg: 72, planKcal: 2120, avgIntake: null, loggedDays: 0, weights: [], today })).toHaveLength(1);
  });

  it('consejo de ritmo', () => {
    expect(rateAdvice(-1.2, 80, true).tone).toBe('warn');
    expect(rateAdvice(-0.5, 80, true).tone).toBe('ok');
    expect(rateAdvice(-0.1, 80, true).tone).toBe('slow');
  });
});

describe('tendencia sin retraso', () => {
  it('sigue una bajada constante sin quedarse atrás (la media móvil se retrasaba ~1 kg)', () => {
    const today = '2026-11-20';
    const noise = [0.4, -0.2, 0.1, 0.5, -0.3, 0.2, -0.1, 0.3, -0.4, 0.1, 0.2, -0.2, 0.3, 0, -0.1, 0.2, -0.3, 0.1];
    const ws = noise.map((n, i) => ({ date: addDays(today, -34 + i * 2), kg: 81 - i * 2 * (0.45 / 7) + n }));
    const tr = smoothWeights(ws);
    const real = 81 - 17 * 2 * (0.45 / 7); // valor sin ruido del último día
    expect(Math.abs(tr[tr.length - 1] - real)).toBeLessThan(0.35);
    // suaviza el ruido: varía menos que los pesajes
    const jumps = (a: number[]) => a.slice(1).reduce((s, v, i) => s + Math.abs(v - a[i]), 0);
    expect(jumps(tr)).toBeLessThan(jumps(ws.map((w) => w.kg)) / 2);
  });
  it('con un solo pesaje devuelve ese valor', () => {
    expect(smoothWeights([{ date: '2026-11-20', kg: 80 }])).toEqual([80]);
  });
});
