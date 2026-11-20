// Base inicial de alimentos. Valores APROXIMADOS por 100 g, a partir de tablas
// genéricas de libre uso (tipo USDA FoodData Central) y recetas típicas.
// Formato compacto: [id, nombre, categoría, kcal, prot, carb, grasa, fibra, porciones]
// Porciones: "etiqueta:gramos|etiqueta:gramos". Los gramos siempre están disponibles.

export interface Serving { label: string; g: number }
export interface Food {
  id: string;
  name: string;
  cat: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  sugar?: number; // g por 100 g (si se conoce)
  sodium?: number; // mg por 100 g (si se conoce)
  servings: Serving[];
  custom?: boolean;
  brand?: string;
}

import { VE_ROWS, type Row } from './foods-ve';
import { GENERIC_ROWS } from './foods-generic';
import { EXTRA_ROWS, JUICES, MORE_ROWS } from './foods-extra';
import { ES_ROWS, SYNONYMS } from './foods-es';

const ROWS: Row[] = [
  // Comida latinoamericana
  ['arepa', 'Arepa de maíz (sola)', 'Latina', 219, 4.6, 45, 1.9, 3.1, 'unidad mediana:90|unidad pequeña:60'],
  ['arepa-queso', 'Arepa con queso', 'Latina', 260, 9, 34, 9.5, 2.4, 'unidad:150'],
  ['arepa-reina', 'Arepa reina pepiada', 'Latina', 230, 10, 22, 11, 2.6, 'unidad:220'],
  ['empanada-carne', 'Empanada frita de carne', 'Latina', 290, 9, 28, 16, 1.8, 'unidad:110'],
  ['empanada-pollo', 'Empanada de pollo al horno', 'Latina', 250, 11, 27, 11, 1.5, 'unidad:120'],
  ['tamal', 'Tamal de cerdo/pollo', 'Latina', 180, 7, 19, 8.5, 2, 'unidad:250'],
  ['hallaca', 'Hallaca', 'Latina', 200, 7.5, 20, 10, 2, 'unidad:300'],
  ['pupusa', 'Pupusa de queso y frijol', 'Latina', 240, 9, 30, 9, 3, 'unidad:120'],
  ['gallo-pinto', 'Gallo pinto', 'Latina', 165, 6, 27, 3.5, 5, 'taza:180|plato:250'],
  ['arroz-pollo', 'Arroz con pollo', 'Latina', 165, 9, 20, 5, 1, 'plato:350|taza:200'],
  ['ceviche', 'Ceviche de pescado', 'Latina', 95, 16, 5, 1, 0.8, 'plato:250|taza:180'],
  ['lomo-saltado', 'Lomo saltado (sin arroz)', 'Latina', 150, 12, 9, 7.5, 1.2, 'plato:300'],
  ['bandeja-paisa', 'Bandeja paisa', 'Latina', 230, 11, 20, 12, 3.5, 'plato:700'],
  ['pabellon', 'Pabellón criollo', 'Latina', 175, 9, 22, 6, 4, 'plato:450'],
  ['tacos-pastor', 'Taco al pastor', 'Latina', 215, 11, 20, 10, 2.5, 'unidad:85'],
  ['quesadilla', 'Quesadilla de queso', 'Latina', 300, 13, 28, 15, 1.8, 'unidad:130'],
  ['burrito', 'Burrito de carne y frijol', 'Latina', 205, 9, 25, 7.5, 3, 'unidad:250'],
  ['sancocho', 'Sancocho / sopa de res', 'Latina', 70, 5, 8, 2, 1.2, 'plato:400|taza:250'],
  ['caldo-pollo', 'Caldo / sopa de pollo', 'Latina', 45, 4, 4, 1.5, 0.5, 'plato:400|taza:250'],
  ['chicharron', 'Chicharrón de cerdo', 'Latina', 540, 27, 0, 48, 0, 'porción:50'],
  ['pan-bono', 'Pan de bono', 'Latina', 330, 10, 38, 15, 0.5, 'unidad:50'],
  ['pan-queso', 'Pan de queso / chipa', 'Latina', 340, 9, 40, 16, 0.6, 'unidad:40'],
  ['tequeno', 'Tequeño', 'Latina', 330, 11, 30, 18, 1, 'unidad:35'],
  ['bunuelo', 'Buñuelo', 'Latina', 360, 9, 38, 19, 0.8, 'unidad:45'],
  ['concha', 'Pan dulce (concha)', 'Latina', 375, 7.5, 57, 13, 1.8, 'unidad:80'],
  ['tajadas', 'Plátano maduro frito (tajadas)', 'Latina', 230, 1.2, 38, 9, 2.3, 'porción:100|unidad:30'],
  ['patacon', 'Patacón / tostón', 'Latina', 310, 1.5, 44, 15, 2.6, 'unidad:40'],
  ['platano-cocido', 'Plátano maduro cocido', 'Latina', 120, 1.1, 31, 0.3, 2.3, 'unidad:180'],
  ['yuca', 'Yuca cocida', 'Latina', 150, 1.3, 36, 0.3, 1.8, 'porción:150|taza:200'],
  ['yuca-frita', 'Yuca frita', 'Latina', 300, 1.5, 40, 15, 2, 'porción:120'],
  ['choclo', 'Jojoto / mazorca cocida', 'Latina', 96, 3.4, 21, 1.5, 2.4, 'unidad:150|taza:150'],
  ['tortilla-maiz', 'Tortilla de maíz', 'Latina', 218, 5.7, 45, 2.9, 6.3, 'unidad:30'],
  ['tortilla-harina', 'Tortilla de harina de trigo', 'Latina', 305, 8, 50, 8, 3, 'unidad:45'],
  ['frijoles-negros', 'Caraotas negras cocidas (frijoles negros)', 'Latina', 132, 8.9, 24, 0.5, 8.7, 'taza:170|cucharón:100'],
  ['frijoles-rojos', 'Frijoles rojos cocidos', 'Latina', 127, 8.7, 23, 0.5, 6.4, 'taza:175|cucharón:100'],
  ['frijoles-refritos', 'Frijoles refritos', 'Latina', 150, 6, 18, 6, 6, 'cucharada:20|taza:240'],
  ['queso-blanco', 'Queso blanco fresco / costeño', 'Lácteos', 300, 18, 3, 24, 0, 'tajada:30|cucharada rallado:10'],
  ['cafe-leche', 'Café con leche (con azúcar)', 'Bebidas', 55, 2.4, 7, 1.8, 0, 'taza:240'],
  ['agua-panela', 'Agua de panela / papelón', 'Bebidas', 40, 0, 10, 0, 0, 'vaso:250'],
  ['chicha', 'Chicha / bebida de maíz', 'Bebidas', 75, 1, 16, 0.6, 0.2, 'vaso:250'],
  // Cereales y tubérculos
  ['arroz', 'Arroz blanco cocido', 'Cereales', 130, 2.7, 28, 0.3, 0.4, 'taza:160|cucharada:15|plato:200'],
  ['arroz-integral', 'Arroz integral cocido', 'Cereales', 123, 2.7, 26, 1, 1.6, 'taza:195|plato:200'],
  ['pasta', 'Pasta cocida', 'Cereales', 158, 5.8, 31, 0.9, 1.8, 'taza:140|plato:220'],
  ['avena', 'Avena en hojuelas (cruda)', 'Cereales', 379, 13, 68, 6.5, 10, 'taza:80|cucharada:10'],
  ['pan-blanco', 'Pan de molde blanco', 'Cereales', 266, 8.9, 49, 3.3, 2.7, 'rebanada:28'],
  ['pan-integral', 'Pan de molde integral', 'Cereales', 250, 12, 43, 3.5, 6, 'rebanada:30'],
  ['pan-frances', 'Pan francés / canilla', 'Cereales', 275, 9, 55, 2, 2.5, 'unidad:60'],
  ['papa', 'Papa cocida', 'Cereales', 87, 1.9, 20, 0.1, 1.8, 'unidad mediana:150|taza:150'],
  ['papa-frita', 'Papas fritas', 'Cereales', 312, 3.4, 41, 15, 3.8, 'porción:120'],
  ['camote', 'Batata / camote cocido', 'Cereales', 90, 2, 21, 0.2, 3.3, 'unidad:150'],
  ['quinoa', 'Quinua cocida', 'Cereales', 120, 4.4, 21, 1.9, 2.8, 'taza:185'],
  ['cereal', 'Cereal de maíz (hojuelas)', 'Cereales', 375, 7, 84, 0.9, 3, 'taza:30'],
  ['granola', 'Granola', 'Cereales', 470, 10, 64, 20, 7, 'cucharada:12|taza:110'],
  // Proteínas
  ['huevo', 'Huevo entero', 'Proteínas', 143, 12.6, 0.7, 9.5, 0, 'unidad:50'],
  ['huevos-revueltos', 'Huevos revueltos (con aceite)', 'Proteínas', 170, 11, 1.6, 13, 0, 'unidad:60|porción de 2:120'],
  ['clara', 'Clara de huevo', 'Proteínas', 52, 11, 0.7, 0.2, 0, 'unidad:33'],
  ['pollo-pechuga', 'Pechuga de pollo a la plancha', 'Proteínas', 165, 31, 0, 3.6, 0, 'filete:150|porción:120'],
  ['pollo-muslo', 'Muslo de pollo asado (sin piel)', 'Proteínas', 180, 25, 0, 8.5, 0, 'unidad:90'],
  ['pollo-asado', 'Pollo asado con piel', 'Proteínas', 215, 25, 0, 12.5, 0, '1/4 de pollo:250'],
  ['res-bistec', 'Bistec de res magro', 'Proteínas', 190, 29, 0, 8, 0, 'filete:150'],
  ['res-molida', 'Carne molida de res 90/10 cocida', 'Proteínas', 217, 26, 0, 12, 0, 'porción:120|taza:140'],
  ['cerdo-lomo', 'Lomo de cerdo', 'Proteínas', 175, 27, 0, 7, 0, 'filete:150'],
  ['chuleta', 'Chuleta de cerdo', 'Proteínas', 230, 25, 0, 14, 0, 'unidad:130'],
  ['atun', 'Atún en agua (escurrido)', 'Proteínas', 116, 26, 0, 1, 0, 'lata:120'],
  ['salmon', 'Salmón', 'Proteínas', 208, 20, 0, 13, 0, 'filete:150'],
  ['tilapia', 'Tilapia / pescado blanco', 'Proteínas', 128, 26, 0, 2.7, 0, 'filete:150'],
  ['camaron', 'Camarones cocidos', 'Proteínas', 99, 24, 0.2, 0.3, 0, 'porción:100'],
  ['jamon-pavo', 'Jamón de pavo', 'Proteínas', 105, 17, 2.5, 3, 0, 'rebanada:20'],
  ['salchicha', 'Salchicha', 'Proteínas', 290, 11, 3, 26, 0, 'unidad:45'],
  ['chorizo', 'Chorizo', 'Proteínas', 450, 24, 2, 38, 0, 'unidad:75'],
  ['whey', 'Proteína en polvo (whey)', 'Proteínas', 390, 78, 8, 6, 0, 'scoop:30'],
  ['tofu', 'Tofu firme', 'Proteínas', 145, 16, 3, 8.7, 2.3, 'porción:100'],
  ['lentejas', 'Lentejas cocidas', 'Proteínas', 116, 9, 20, 0.4, 7.9, 'taza:200|cucharón:100'],
  ['garbanzos', 'Garbanzos cocidos', 'Proteínas', 164, 8.9, 27, 2.6, 7.6, 'taza:165'],
  // Lácteos
  ['leche-entera', 'Leche entera', 'Lácteos', 61, 3.2, 4.8, 3.3, 0, 'taza:240|vaso:250'],
  ['leche-descremada', 'Leche descremada', 'Lácteos', 34, 3.4, 5, 0.1, 0, 'taza:240|vaso:250'],
  ['yogur-griego', 'Yogur griego natural 0 %', 'Lácteos', 59, 10, 3.6, 0.4, 0, 'pote:170|taza:225'],
  ['yogur', 'Yogur natural', 'Lácteos', 61, 3.5, 4.7, 3.3, 0, 'pote:150'],
  ['mozzarella', 'Queso mozzarella', 'Lácteos', 280, 28, 3, 17, 0, 'tajada:25'],
  ['cheddar', 'Queso amarillo / cheddar', 'Lácteos', 403, 25, 1.3, 33, 0, 'tajada:20'],
  ['queso-crema', 'Queso crema', 'Lácteos', 342, 6, 4, 34, 0, 'cucharada:15'],
  // Grasas y frutos secos
  ['aguacate', 'Aguacate / palta', 'Grasas', 160, 2, 8.5, 14.7, 6.7, 'unidad:200|1/2 unidad:100|cucharada:15'],
  ['aceite-oliva', 'Aceite de oliva', 'Grasas', 884, 0, 0, 100, 0, 'cucharada:13.5|cucharadita:4.5'],
  ['aceite', 'Aceite vegetal', 'Grasas', 884, 0, 0, 100, 0, 'cucharada:13.5|cucharadita:4.5'],
  ['mantequilla', 'Mantequilla', 'Grasas', 717, 0.9, 0.1, 81, 0, 'cucharada:14|cucharadita:5'],
  ['mani-crema', 'Mantequilla de maní', 'Grasas', 588, 25, 20, 50, 6, 'cucharada:16'],
  ['mani', 'Maní tostado', 'Grasas', 585, 24, 21, 50, 8, 'puñado:30'],
  ['almendras', 'Almendras', 'Grasas', 579, 21, 22, 50, 12.5, 'puñado:30|unidad:1.2'],
  ['mayonesa', 'Mayonesa', 'Grasas', 680, 1, 0.6, 75, 0, 'cucharada:14'],
  // Frutas
  ['banana', 'Cambur (banano)', 'Frutas', 89, 1.1, 23, 0.3, 2.6, 'unidad:118'],
  ['manzana', 'Manzana', 'Frutas', 52, 0.3, 14, 0.2, 2.4, 'unidad:180'],
  ['naranja', 'Naranja', 'Frutas', 47, 0.9, 12, 0.1, 2.4, 'unidad:140'],
  ['mandarina', 'Mandarina', 'Frutas', 53, 0.8, 13, 0.3, 1.8, 'unidad:90'],
  ['papaya', 'Lechosa (papaya)', 'Frutas', 43, 0.5, 11, 0.3, 1.7, 'taza:145|tajada:150'],
  ['mango', 'Mango', 'Frutas', 60, 0.8, 15, 0.4, 1.6, 'unidad:200|taza:165'],
  ['pina', 'Piña', 'Frutas', 50, 0.5, 13, 0.1, 1.4, 'taza:165|rodaja:85'],
  ['fresas', 'Fresas', 'Frutas', 32, 0.7, 7.7, 0.3, 2, 'taza:150|unidad:12'],
  ['uvas', 'Uvas', 'Frutas', 69, 0.7, 18, 0.2, 0.9, 'taza:150'],
  ['sandia', 'Patilla (sandía)', 'Frutas', 30, 0.6, 7.6, 0.2, 0.4, 'taza:150|tajada:280'],
  ['guayaba', 'Guayaba', 'Frutas', 68, 2.6, 14, 1, 5.4, 'unidad:55'],
  ['maracuya', 'Parchita (maracuyá), pulpa', 'Frutas', 97, 2.2, 23, 0.7, 10, 'unidad:18'],
  // Verduras
  ['tomate', 'Tomate', 'Verduras', 18, 0.9, 3.9, 0.2, 1.2, 'unidad:120|rodaja:20'],
  ['lechuga', 'Lechuga', 'Verduras', 15, 1.4, 2.9, 0.2, 1.3, 'taza:50'],
  ['cebolla', 'Cebolla', 'Verduras', 40, 1.1, 9.3, 0.1, 1.7, 'unidad:110|cucharada:10'],
  ['zanahoria', 'Zanahoria', 'Verduras', 41, 0.9, 9.6, 0.2, 2.8, 'unidad:60|taza:110'],
  ['brocoli', 'Brócoli cocido', 'Verduras', 35, 2.4, 7.2, 0.4, 3.3, 'taza:155'],
  ['pepino', 'Pepino', 'Verduras', 15, 0.7, 3.6, 0.1, 0.5, 'unidad:200'],
  ['espinaca', 'Espinaca', 'Verduras', 23, 2.9, 3.6, 0.4, 2.2, 'taza:30'],
  ['ensalada', 'Ensalada mixta (sin aderezo)', 'Verduras', 20, 1.2, 3.8, 0.2, 1.8, 'plato:150|taza:80'],
  ['pimenton', 'Pimentón (pimiento)', 'Verduras', 26, 1, 6, 0.3, 2.1, 'unidad:120'],
  // Bebidas y otros
  ['cafe', 'Café negro', 'Bebidas', 2, 0.3, 0, 0, 0, 'taza:240'],
  ['jugo-naranja', 'Jugo de naranja natural', 'Bebidas', 45, 0.7, 10.4, 0.2, 0.2, 'vaso:250'],
  ['gaseosa', 'Gaseosa / refresco', 'Bebidas', 42, 0, 10.6, 0, 0, 'lata:355|vaso:250'],
  ['cerveza', 'Cerveza', 'Bebidas', 43, 0.5, 3.6, 0, 0, 'lata:355|botella:330'],
  ['azucar', 'Azúcar', 'Otros', 387, 0, 100, 0, 0, 'cucharadita:4|cucharada:12'],
  ['miel', 'Miel', 'Otros', 304, 0.3, 82, 0, 0.2, 'cucharada:21'],
  ['chocolate-oscuro', 'Chocolate oscuro 70 %', 'Otros', 600, 7.8, 46, 43, 11, 'cuadrito:10|barra:100'],
  ['galletas', 'Galletas dulces', 'Otros', 480, 6, 68, 20, 2, 'unidad:10'],
  ['pizza', 'Pizza de queso', 'Otros', 266, 11, 33, 10, 2.3, 'porción:110'],
  ['hamburguesa', 'Hamburguesa sencilla', 'Otros', 254, 13, 25, 11, 1.5, 'unidad:200'],
  ['perro-caliente', 'Perro caliente', 'Otros', 260, 10, 22, 15, 1, 'unidad:150'],
];

function parseServings(s: string): Serving[] {
  const list = s
    .split('|')
    .filter(Boolean)
    .map((p) => {
      const i = p.lastIndexOf(':');
      return { label: p.slice(0, i), g: Number(p.slice(i + 1)) };
    });
  return [...list, { label: 'gramos', g: 1 }];
}

// ---------- Variantes generadas ----------
const r1 = (n: number) => Math.round(n * 10) / 10;
function generated(): Row[] {
  const out: Row[] = [];
  const LECHE = { kcal: 61, p: 3.2, c: 4.8, f: 3.3 };
  for (const [id, nombre, kcal, carb, prot] of JUICES) {
    const citrus = ['naranja', 'mandarina', 'limon'].includes(id);
    if (id === 'limon') continue; // ya existe la limonada
    const k = citrus ? 0.95 : 0.42; // fracción de fruta en el vaso
    const base = [r1(kcal * k), r1(prot * k), r1(carb * k)];
    if (!citrus) out.push([`jugo-${id}-natural`, `Jugo de ${nombre} sin azúcar`, 'Bebidas', base[0], base[1], base[2], 0.1, 0.3, 'vaso:300|vaso pequeño:200']);
    out.push([`jugo-${id}-azucar`, `Jugo de ${nombre} con azúcar`, 'Bebidas', r1(base[0] + 24), base[1], r1(base[2] + 6), 0.1, 0.3, 'vaso:300|vaso pequeño:200']);
    if (!citrus && !['zanahoria', 'remolacha', 'tamarindo'].includes(id)) {
      out.push([`batido-${id}-leche`, `Batido de ${nombre} con leche`, 'Bebidas', r1(kcal * 0.35 + LECHE.kcal * 0.5 + 16), r1(prot * 0.35 + LECHE.p * 0.5), r1(carb * 0.35 + LECHE.c * 0.5 + 4), r1(LECHE.f * 0.5), 0.5, 'vaso:350']);
    }
  }
  const cookable: [string, string][] = [
    ['pollo-pechuga', 'Pechuga de pollo'], ['pollo-muslo', 'Muslo de pollo'], ['res-bistec', 'Bistec de res'], ['cerdo-lomo', 'Lomo de cerdo'],
    ['tilapia', 'Filete de pescado blanco'], ['salmon', 'Salmón'], ['pargo', 'Pargo'], ['res-molida', 'Carne molida'], ['higado-res', 'Hígado de res'],
  ];
  const all = new Map([...ROWS, ...VE_ROWS, ...GENERIC_ROWS].map((r) => [r[0], r]));
  for (const [id, nombre] of cookable) {
    const b = all.get(id);
    if (!b) continue;
    const [, , cat, kcal, p, c, f] = b;
    out.push([`${id}-frito`, `${nombre} frito`, cat, r1(kcal + 85), p, r1(c + 1), r1(f + 9.5), 0, 'porción:150|filete:150']);
    out.push([`${id}-guisado`, `${nombre} guisado`, cat, r1(kcal * 0.85 + 18), r1(p * 0.85), r1(c + 3), r1(f * 0.85 + 1.5), 0.6, 'porción con salsa:200|porción:150']);
  }
  return out;
}

/** Todas las filas, sin ids repetidos (gana la primera aparición). */
export const ALL_ROWS: Row[] = (() => {
  const seen = new Set<string>();
  return [...ROWS, ...VE_ROWS, ...ES_ROWS, ...GENERIC_ROWS, ...EXTRA_ROWS, ...MORE_ROWS, ...generated()].filter((r) => (seen.has(r[0]) ? false : (seen.add(r[0]), true)));
})();

export const SEED_FOODS: Food[] = ALL_ROWS.map(([id, name, cat, kcal, p, c, f, fiber, serv]) => ({
  id,
  name,
  cat,
  kcal,
  p,
  c,
  f,
  fiber,
  servings: parseServings(serv),
}));

export const FOOD_CATS = ['Venezolana', 'Española', 'Latina', 'Proteínas', 'Pescados', 'Lácteos', 'Cereales', 'Panadería', 'Legumbres', 'Frutas', 'Verduras', 'Frutos secos', 'Grasas', 'Bebidas', 'Dulces', 'Comida rápida', 'Snacks', 'Salsas', 'Suplementos', 'Otros'];

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Alimentos de uso diario que deben aparecer primero en la búsqueda. */
const POPULAR = new Set([
  'arepa-asada', 'arepa', 'arepa-queso-mano', 'arroz-blanco-ve', 'arroz', 'caraotas-negras-guisadas', 'frijoles-negros', 'huevo', 'huevos-revueltos', 'perico',
  'pollo-pechuga', 'carne-mechada', 'pollo-desmechado', 'banana', 'tajadas-ve', 'cafe-con-leche-ve', 'cafe-negrito', 'queso-blanco-duro', 'queso-blanco-suave', 'pan-canilla',
  'pabellon-criollo', 'empanada-carne-molida', 'cachapa-queso', 'tequeno-frito', 'leche-entera', 'avena', 'atun', 'aguacate', 'pasta', 'papa', 'yuca-sancochada',
  'platano-cocido', 'manzana', 'naranja', 'jamon-pavo', 'yogur-griego', 'whey', 'pan-integral', 'ensalada', 'tomate', 'agua', 'refresco-cola', 'malta', 'cerveza-pilsen',
]);

/** Búsqueda tolerante a tildes; todas las palabras deben aparecer. Ordena por relevancia. */
export function searchFoods(foods: Food[], q: string): Food[] {
  const qn = normalize(q).trim();
  const words = qn.split(/\s+/).filter(Boolean);
  if (words.length === 0) return foods;
  const scored: { f: Food; s: number }[] = [];
  for (const f of foods) {
    const n = normalize(f.name + ' ' + (f.brand ?? ''));
    let viaSynonym = false;
    const ok = words.every((w) => {
      if (n.includes(w)) return true;
      const alts = SYNONYMS[w] ?? SYNONYMS[w.replace(/s$/, '')] ?? [];
      if (alts.some((a) => n.includes(normalize(a)))) return (viaSynonym = true);
      return false;
    });
    if (!ok) continue;
    const name = normalize(f.name);
    let s = name === qn ? 0 : name.startsWith(qn) ? 10 : name.split(/[\s(/,]+/).some((t) => t.startsWith(words[0])) ? 20 : 30;
    if (POPULAR.has(f.id)) s -= 8;
    if (f.custom) s -= 3; // lo que el usuario creó o usó
    if (viaSynonym) s += 4; // primero lo que coincide literalmente
    s += Math.min(8, name.length / 8);
    scored.push({ f, s });
  }
  return scored.sort((a, b) => a.s - b.s).map((x) => x.f);
}
