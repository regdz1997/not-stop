import type { Recipe } from '../db';
import type { MealKey } from '../lib/calc';

// Recetas sencillas de inspiración latinoamericana, escritas para esta app.
// Cada ingrediente apunta a un alimento base, así la nutrición se calcula sola.
// Cantidades en gramos por 1 porción.
type R = [string, string, string, MealKey[], number, [string, number][], string[]];

const B: MealKey[] = ['desayuno'];
const M: MealKey[] = ['almuerzo', 'cena'];
const S: MealKey[] = ['snacks'];

const L: R[] = [
  ['arepa-huevos', 'Arepa con huevos revueltos y aguacate', '🫓', B, 15, [['arepa', 90], ['huevo', 100], ['aguacate', 50], ['aceite', 3]], ['Asa la arepa en budare o sartén 5 min por lado.', 'Revuelve los huevos con una gota de aceite y sal.', 'Rellena con los huevos y el aguacate en láminas.']],
  ['arepa-perico', 'Arepa con perico', '🍳', B, 15, [['arepa', 90], ['huevo', 100], ['tomate', 50], ['cebolla', 20], ['aceite', 5]], ['Sofríe cebolla y tomate picados 3 min.', 'Agrega los huevos batidos y revuelve hasta cuajar.', 'Sirve con la arepa asada.']],
  ['avena-banana', 'Avena cocida con banano y maní', '🥣', B, 10, [['avena', 50], ['leche-descremada', 200], ['banana', 100], ['mani-crema', 16]], ['Cocina la avena con la leche 5 min a fuego bajo.', 'Sirve con banano en rodajas y la mantequilla de maní.']],
  ['yogur-granola', 'Yogur griego con fresas y granola', '🍓', B, 3, [['yogur-griego', 200], ['fresas', 100], ['granola', 25], ['miel', 10]], ['Sirve el yogur, agrega fresas picadas, granola y miel.']],
  ['omelette-claras', 'Omelette de claras con espinaca y queso', '🥚', B, 10, [['clara', 165], ['huevo', 50], ['espinaca', 30], ['queso-blanco', 30], ['pan-integral', 60], ['aceite', 3]], ['Bate claras y huevo con sal.', 'Cocina en sartén con la espinaca; agrega el queso y dobla.', 'Acompaña con el pan tostado.']],
  ['panquecas-avena', 'Panquecas de avena y banano', '🥞', B, 15, [['avena', 40], ['huevo', 100], ['banana', 60], ['whey', 15], ['miel', 10]], ['Licúa avena, huevos, banano y proteína.', 'Cocina porciones pequeñas en sartén antiadherente.', 'Sirve con la miel.']],
  ['batido-desayuno', 'Batido de proteína con banano y avena', '🥤', B, 5, [['whey', 30], ['leche-descremada', 250], ['banana', 100], ['avena', 30]], ['Licúa todo con hielo.']],
  ['pan-huevo-aguacate', 'Tostadas con huevo y aguacate', '🥑', B, 10, [['pan-integral', 60], ['huevo', 100], ['aguacate', 60], ['tomate', 40]], ['Tuesta el pan.', 'Cocina los huevos a tu gusto.', 'Arma con aguacate machacado, tomate y huevo.']],

  ['pollo-arroz', 'Pollo a la plancha con arroz y ensalada', '🍗', M, 25, [['pollo-pechuga', 150], ['arroz', 150], ['ensalada', 150], ['aceite-oliva', 7]], ['Sazona el pollo y cocínalo a la plancha 6 min por lado.', 'Sirve con arroz y ensalada aliñada con el aceite.']],
  ['pabellon-ligero', 'Pabellón ligero', '🍛', M, 40, [['res-bistec', 120], ['frijoles-negros', 120], ['arroz', 120], ['platano-cocido', 80]], ['Cocina y desmecha la carne con sofrito.', 'Calienta las caraotas.', 'Sirve con arroz y plátano cocido (en vez de frito).']],
  ['gallo-pinto-huevo', 'Gallo pinto con huevo y aguacate', '🍳', [...M, 'desayuno'], 15, [['gallo-pinto', 220], ['huevo', 50], ['aguacate', 40]], ['Calienta el gallo pinto.', 'Cocina el huevo y sirve con aguacate.']],
  ['tacos-pollo', 'Tacos de pollo con pico de gallo', '🌮', M, 20, [['tortilla-maiz', 90], ['pollo-pechuga', 120], ['tomate', 60], ['cebolla', 20], ['aguacate', 40], ['lechuga', 20]], ['Cocina el pollo en tiras con comino y limón.', 'Pica tomate y cebolla para el pico de gallo.', 'Calienta las tortillas y arma.']],
  ['lentejas-arroz', 'Lentejas guisadas con arroz', '🥘', M, 35, [['lentejas', 250], ['arroz', 120], ['zanahoria', 40], ['cebolla', 30], ['aceite', 5]], ['Sofríe cebolla y zanahoria.', 'Agrega las lentejas cocidas con un poco de agua y cocina 10 min.', 'Sirve con arroz.']],
  ['salmon-camote', 'Salmón al horno con camote y brócoli', '🐟', M, 30, [['salmon', 150], ['camote', 180], ['brocoli', 150]], ['Hornea el camote en cubos 25 min a 200 °C.', 'Agrega el salmón sazonado los últimos 12 min.', 'Sirve con brócoli al vapor.']],
  ['pescado-patacon', 'Pescado a la plancha con patacón', '🐠', M, 25, [['tilapia', 180], ['patacon', 80], ['ensalada', 150], ['aceite-oliva', 5]], ['Cocina el pescado a la plancha con ajo y limón.', 'Sirve con 2 patacones y ensalada.']],
  ['bowl-burrito', 'Bowl tipo burrito', '🥗', M, 25, [['res-molida', 120], ['frijoles-negros', 100], ['arroz', 120], ['choclo', 60], ['tomate', 50], ['aguacate', 30]], ['Cocina la carne molida con especias.', 'Arma el bowl con arroz, frijoles, maíz, tomate y aguacate.']],
  ['pasta-atun', 'Pasta con atún y tomate', '🍝', M, 20, [['pasta', 200], ['atun', 120], ['tomate', 120], ['aceite-oliva', 7], ['cebolla', 20]], ['Cocina la pasta.', 'Sofríe cebolla y tomate, agrega el atún.', 'Mezcla con la pasta.']],
  ['quinoa-garbanzos', 'Ensalada de quinua con garbanzos', '🥗', M, 20, [['quinoa', 185], ['garbanzos', 120], ['pepino', 80], ['tomate', 80], ['aceite-oliva', 10], ['queso-blanco', 30]], ['Mezcla la quinua cocida con garbanzos, pepino y tomate.', 'Aliña con aceite, limón y sal; agrega el queso.']],
  ['ceviche-camote', 'Ceviche con camote y choclo', '🍋', M, 20, [['ceviche', 250], ['camote', 120], ['choclo', 60]], ['Sirve el ceviche bien frío con camote cocido y choclo.']],
  ['sancocho-plato', 'Sancocho con aguacate', '🍲', M, 60, [['sancocho', 450], ['aguacate', 40]], ['Sirve un plato hondo de sancocho con aguacate.']],
  ['tofu-salteado', 'Salteado de tofu con verduras', '🥦', M, 20, [['tofu', 180], ['arroz-integral', 150], ['brocoli', 100], ['pimenton', 60], ['zanahoria', 50], ['aceite', 7]], ['Dora el tofu en cubos.', 'Saltea las verduras 4 min y mezcla.', 'Sirve con arroz integral.']],
  ['lomo-saltado-arroz', 'Lomo saltado con arroz', '🥩', M, 25, [['lomo-saltado', 280], ['arroz', 130]], ['Saltea carne, cebolla, tomate y ají a fuego alto.', 'Sirve con arroz.']],
  ['tortilla-espanola', 'Tortilla de papa ligera con ensalada', '🥔', M, 30, [['huevo', 150], ['papa', 150], ['cebolla', 40], ['aceite-oliva', 10], ['ensalada', 120]], ['Cocina papa y cebolla en láminas con poco aceite.', 'Agrega los huevos batidos y cuaja por ambos lados.', 'Sirve con ensalada.']],
  ['pollo-yuca', 'Pollo guisado con yuca', '🍗', M, 40, [['pollo-muslo', 180], ['yuca', 150], ['tomate', 60], ['cebolla', 30], ['pimenton', 30]], ['Guisa el pollo con el sofrito 25 min.', 'Sirve con yuca cocida.']],
  ['ensalada-atun', 'Ensalada de atún con aguacate', '🥑', M, 10, [['atun', 150], ['aguacate', 80], ['lechuga', 80], ['tomate', 80], ['pepino', 80], ['aceite-oliva', 7]], ['Mezcla todo y aliña con limón, aceite y sal.']],
  ['bistec-brocoli', 'Bistec con brócoli y ensalada', '🥩', M, 20, [['res-bistec', 180], ['brocoli', 200], ['ensalada', 120], ['aceite-oliva', 7]], ['Cocina el bistec a la plancha.', 'Sirve con brócoli al vapor y ensalada.']],
  ['frijoles-arroz-queso', 'Frijoles con arroz, queso y plátano', '🫘', M, 20, [['frijoles-rojos', 180], ['arroz', 130], ['queso-blanco', 40], ['platano-cocido', 90]], ['Calienta los frijoles y el arroz.', 'Sirve con queso rallado y plátano.']],

  ['yogur-mango', 'Yogur griego con mango', '🥭', S, 3, [['yogur-griego', 170], ['mango', 100]], ['Sirve el yogur con mango picado.']],
  ['manzana-mani', 'Manzana con mantequilla de maní', '🍎', S, 2, [['manzana', 180], ['mani-crema', 16]], ['Corta la manzana y unta la mantequilla de maní.']],
  ['almendras-mandarina', 'Almendras y mandarina', '🍊', S, 1, [['almendras', 25], ['mandarina', 90]], ['Listo para llevar.']],
  ['sandwich-pavo', 'Sándwich de pavo y queso', '🥪', S, 5, [['pan-integral', 60], ['jamon-pavo', 60], ['mozzarella', 25], ['tomate', 30], ['lechuga', 15]], ['Arma el sándwich y tuéstalo si quieres.']],
  ['batido-whey', 'Batido de proteína', '🥤', S, 2, [['whey', 30], ['leche-descremada', 250]], ['Mezcla en un termo y agita.']],
  ['huevos-duros', 'Huevos duros con tomate', '🥚', S, 12, [['huevo', 100], ['tomate', 100]], ['Hierve los huevos 10 min.', 'Sirve con tomate y sal.']],
  ['papaya-yogur', 'Papaya con yogur y granola', '🧡', S, 3, [['papaya', 150], ['yogur', 150], ['granola', 15]], ['Sirve la papaya con yogur y granola.']],
];

export const SEED_RECIPES: Recipe[] = L.map(([id, name, emoji, meals, minutes, ings, steps]) => ({
  id,
  name,
  emoji,
  meals,
  minutes,
  servings: 1,
  ingredients: ings.map(([foodId, grams]) => ({ foodId, grams })),
  steps,
}));

/** Alimentos que impiden que una receta sea vegetariana. */
export const MEAT_IDS = new Set([
  'pollo-pechuga', 'pollo-muslo', 'pollo-asado', 'res-bistec', 'res-molida', 'cerdo-lomo', 'chuleta', 'atun', 'salmon', 'tilapia', 'camaron',
  'jamon-pavo', 'salchicha', 'chorizo', 'chicharron', 'ceviche', 'lomo-saltado', 'bandeja-paisa', 'pabellon', 'sancocho', 'caldo-pollo',
  'arroz-pollo', 'tacos-pastor', 'empanada-carne', 'empanada-pollo', 'tamal', 'hallaca', 'burrito', 'arepa-reina', 'hamburguesa', 'perro-caliente',
]);
