import { db, type Recipe } from '../db';
import { SEED_FOODS, type Food } from '../data/foods';
import { SEED_RECIPES } from '../data/recipes';
import { round1, type MealKey } from './calc';
import { recipeNutr, type FoodMap } from './planner';

export async function foodMap(): Promise<FoodMap> {
  const custom = await db.foods.toArray();
  return new Map([...SEED_FOODS, ...custom].map((f) => [f.id, f]));
}

export async function allRecipes(): Promise<Recipe[]> {
  return [...SEED_RECIPES, ...(await db.recipes.toArray())];
}

/** Registra una receta como un solo alimento (editable) en el diario. */
export async function logRecipe(r: Recipe, factor: number, date: string, meal: MealKey, foods?: FoodMap) {
  const fm = foods ?? (await foodMap());
  const per = recipeNutr(r, fm, 1); // 1 porción
  const gramsPer = r.ingredients.reduce((a, i) => a + i.grams, 0) / r.servings;
  const k = 100 / gramsPer;
  const food: Food = { id: 'r-' + r.id, name: r.name, cat: 'Mis', kcal: per.kcal * k, p: per.p * k, c: per.c * k, f: per.f * k, fiber: per.fiber * k, servings: [{ label: 'porción', g: round1(gramsPer) }, { label: 'gramos', g: 1 }], custom: true };
  await db.foods.put(food);
  const n = recipeNutr(r, fm, factor);
  await db.entries.add({ date, meal, foodId: food.id, name: r.name, qty: factor, servingLabel: 'porción', grams: round1(gramsPer * factor), ...n, createdAt: Date.now() });
}
