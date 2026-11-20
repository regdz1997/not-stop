import { describe, expect, it } from 'vitest';
import { addDays, ageFromBirth, bmr, computeTargets, kcalMET, mealForHour, oneRM, pace, remaining, runKcal, runMET, scale, sumNutr, trend, weekStart } from './calc';
import { FOOD_CATS, SEED_FOODS, searchFoods } from '../data/foods';

describe('metas', () => {
  it('Mifflin-St Jeor hombre', () => {
    // 10*80 + 6.25*175 - 5*30 + 5 = 1748.75
    expect(bmr({ sex: 'h', age: 30, heightCm: 175, weightKg: 80 })).toBeCloseTo(1748.75);
  });
  it('Mifflin-St Jeor mujer', () => {
    expect(bmr({ sex: 'm', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(600 + 1031.25 - 150 - 161);
  });
  it('déficit de 20 % y proteína 2.2 g/kg al bajar', () => {
    const t = computeTargets({ sex: 'h', age: 30, heightCm: 175, weightKg: 80, activity: 'moderado', goal: 'perder' });
    expect(t.kcal).toBe(Math.round((1748.75 * 1.55 * 0.8) / 10) * 10); // 2170
    expect(t.protein).toBe(176);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeGreaterThan(t.kcal - 10);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeLessThan(t.kcal + 10);
  });
  it('nunca baja del mínimo seguro', () => {
    const t = computeTargets({ sex: 'm', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentario', goal: 'perder' });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });
  it('restantes = meta − consumidas + quemadas', () => {
    expect(remaining(2000, 1500, 300)).toBe(800);
    expect(remaining(2000, 2500, 0)).toBe(-500);
  });
});

describe('porciones', () => {
  it('escala por gramos', () => {
    const arepa = SEED_FOODS.find((f) => f.id === 'arepa')!;
    const n = scale(arepa, 90);
    expect(n.kcal).toBe(197);
    expect(arepa.servings.at(-1)).toEqual({ label: 'gramos', g: 1 });
  });
  it('suma nutrientes', () => {
    expect(sumNutr([{ kcal: 100, p: 1.25 }, { kcal: 50, p: 2.3 }])).toMatchObject({ kcal: 150, p: 3.6 });
  });
  it('búsqueda sin tildes', () => {
    expect(searchFoods(SEED_FOODS, 'platano')[0].name).toMatch(/Plátano/);
    expect(searchFoods(SEED_FOODS, 'pollo pechuga').length).toBeGreaterThan(0);
    expect(searchFoods(SEED_FOODS, 'zzzz')).toHaveLength(0);
  });
  it('ids y nombres de alimentos únicos, categorías válidas, más de 850', () => {
    expect(new Set(SEED_FOODS.map((f) => f.id)).size).toBe(SEED_FOODS.length);
    expect(new Set(SEED_FOODS.map((f) => f.name.toLowerCase())).size).toBe(SEED_FOODS.length);
    expect(SEED_FOODS.length).toBeGreaterThan(850);
    for (const f of SEED_FOODS) {
      expect(FOOD_CATS, f.id).toContain(f.cat);
      expect(f.servings.length, f.id).toBeGreaterThan(0);
      for (const v of [f.kcal, f.p, f.c, f.f, f.fiber]) expect(Number.isFinite(v) && v >= 0, f.id).toBe(true);
      // Coherencia aproximada de energía (salvo alcohol y verduras muy bajas en kcal)
      if (f.kcal > 60 && f.fiber < 20 && !/cerveza|ron$|whisky|vino|cuba|sangr|mojito|colada|vodka|tequila|anís|gin|ponche/i.test(f.name)) {
        expect(Math.abs(f.kcal - (4 * f.p + 4 * (f.c - f.fiber) + 2 * f.fiber + 9 * f.f)) / f.kcal, f.id).toBeLessThan(0.25);
      }
    }
  });
  it('búsqueda con nombres venezolanos', () => {
    expect(searchFoods(SEED_FOODS, 'caraotas').length).toBeGreaterThan(5);
    expect(searchFoods(SEED_FOODS, 'cambur')[0].name).toMatch(/Cambur/);
    expect(searchFoods(SEED_FOODS, 'tequeño').length).toBeGreaterThan(1);
    expect(searchFoods(SEED_FOODS, 'pabellon').length).toBeGreaterThan(2);
  });
});

describe('entreno', () => {
  it('1RM Epley', () => {
    expect(oneRM(100, 1)).toBe(100);
    expect(oneRM(100, 10)).toBeCloseTo(133.3, 1);
    expect(oneRM(0, 5)).toBe(0);
  });
  it('MET × kg × horas', () => {
    expect(kcalMET(5, 80, 60)).toBe(400);
  });
  it('trote: ritmo y kcal', () => {
    expect(pace(5, 30)).toBe('6:00');
    expect(runMET(10)).toBeGreaterThan(9.8);
    expect(runMET(10)).toBeLessThan(10.5);
    const k = runKcal(5, 30, 80); // 10 km/h
    expect(k).toBeGreaterThan(390);
    expect(k).toBeLessThan(420);
    expect(runKcal(0, 30, 80)).toBe(0);
  });
});

describe('fechas y tendencia', () => {
  it('suma días cruzando meses', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('la semana empieza el lunes', () => {
    expect(weekStart('2026-11-19')).toBe('2026-11-16'); // jueves → lunes
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // domingo
  });
  it('edad', () => {
    expect(ageFromBirth('1997-11-20', '2026-11-19')).toBe(28);
    expect(ageFromBirth('1997-11-19', '2026-11-19')).toBe(29);
  });
  it('tendencia suaviza', () => {
    const t = trend([80, 82, 80]);
    expect(t[0]).toBe(80);
    expect(t[1]).toBeCloseTo(80.2);
    expect(t[2]).toBeLessThan(80.2);
  });
  it('comida según la hora', () => {
    expect(mealForHour(8)).toBe('desayuno');
    expect(mealForHour(13)).toBe('almuerzo');
    expect(mealForHour(20)).toBe('cena');
    expect(mealForHour(16)).toBe('snacks');
  });
});

import { plural } from '../components/Portion';
describe('plurales de medidas', () => {
  it('pluraliza', () => {
    expect(plural('porción', 1.1)).toBe('porciones');
    expect(plural('unidad mediana', 2)).toBe('unidades medianas');
    expect(plural('taza', 2)).toBe('tazas');
    expect(plural('1/4 de pollo', 2)).toBe('1/4 de pollo');
    expect(plural('lata', 1)).toBe('lata');
  });
});
