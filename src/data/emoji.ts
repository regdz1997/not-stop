import { normalize, type Food } from './foods';

// Emoji y color de burbuja por categoría (tono suave sobre fondo oscuro).
export const CAT_STYLE: Record<string, { emoji: string; hue: string }> = {
  Venezolana: { emoji: '🫓', hue: '#F2B34A' },
  Latina: { emoji: '🌮', hue: '#F28C4A' },
  Proteínas: { emoji: '🍗', hue: '#FF6B7D' },
  Pescados: { emoji: '🐟', hue: '#4FB6FF' },
  Lácteos: { emoji: '🧀', hue: '#F5D76E' },
  Cereales: { emoji: '🍚', hue: '#D9B98C' },
  Panadería: { emoji: '🥖', hue: '#E0A060' },
  Legumbres: { emoji: '🫘', hue: '#B07A5A' },
  Frutas: { emoji: '🍎', hue: '#FF7A93' },
  Verduras: { emoji: '🥦', hue: '#5ED68F' },
  'Frutos secos': { emoji: '🥜', hue: '#C89A62' },
  Grasas: { emoji: '🥑', hue: '#9BD35A' },
  Bebidas: { emoji: '🥤', hue: '#5AC8FA' },
  Dulces: { emoji: '🍰', hue: '#FF8AD0' },
  'Comida rápida': { emoji: '🍔', hue: '#FF9F43' },
  Snacks: { emoji: '🍿', hue: '#FFC857' },
  Salsas: { emoji: '🫙', hue: '#E36B5B' },
  Suplementos: { emoji: '💪', hue: '#9C8CFF' },
  Otros: { emoji: '🍽️', hue: '#A0A4B0' },
  Mis: { emoji: '✏️', hue: '#7FA8FF' },
};

// Palabra clave → emoji (la primera coincidencia gana; orden de más específico a más general).
const KEYS: [string, string][] = [
  ['tequeno', '🧀'], ['cachapa', '🫓'], ['arepa', '🫓'], ['empanada', '🥟'], ['pastelito', '🥟'], ['hallaca', '🫔'], ['tamal', '🫔'], ['bollo', '🫔'],
  ['pizza', '🍕'], ['hamburguesa', '🍔'], ['perro caliente', '🌭'], ['salchicha', '🌭'], ['taco', '🌮'], ['burrito', '🌯'], ['wrap', '🌯'], ['sushi', '🍣'], ['ramen', '🍜'],
  ['sandwich', '🥪'], ['sándwich', '🥪'], ['pepito', '🥖'], ['papas fritas', '🍟'], ['papitas', '🍟'], ['salchipapa', '🍟'], ['cotufa', '🍿'],
  ['sopa', '🍲'], ['sancocho', '🍲'], ['hervido', '🍲'], ['mondongo', '🍲'], ['crema de', '🥣'], ['caldo', '🍲'], ['pisca', '🍲'], ['chupe', '🍲'],
  ['ensalada', '🥗'], ['bowl', '🥗'], ['pasta', '🍝'], ['espagueti', '🍝'], ['pasticho', '🍝'], ['lasa', '🍝'], ['fideo', '🍜'],
  ['arroz con leche', '🍮'], ['quesillo', '🍮'], ['flan', '🍮'], ['helado', '🍦'], ['paleta', '🍧'], ['torta', '🍰'], ['ponque', '🍰'], ['pie', '🥧'], ['cheesecake', '🍰'],
  ['dona', '🍩'], ['galleta', '🍪'], ['catalina', '🍪'], ['polvorosa', '🍪'], ['chocolate', '🍫'], ['caramelo', '🍬'], ['chupeta', '🍭'], ['gomita', '🍬'], ['miel', '🍯'], ['churro', '🥨'], ['pretzel', '🥨'],
  ['cafe', '☕'], ['capuchino', '☕'], ['latte', '☕'], ['te ', '🍵'], ['te verde', '🍵'], ['infusion', '🍵'], ['manzanilla', '🍵'], ['cerveza', '🍺'], ['malta', '🍺'], ['vino', '🍷'], ['ron', '🥃'], ['whisky', '🥃'], ['vodka', '🥃'], ['tequila', '🥃'], ['anis', '🥃'],
  ['batido', '🥤'], ['merengada', '🥤'], ['smoothie', '🥤'], ['jugo', '🧃'], ['nectar', '🧃'], ['refresco', '🥤'], ['agua', '💧'], ['leche', '🥛'], ['yogur', '🥛'], ['kefir', '🥛'], ['toddy', '🥛'],
  ['queso', '🧀'], ['huevo', '🥚'], ['clara', '🥚'], ['omelette', '🥚'], ['tortilla de', '🥚'], ['perico', '🍳'],
  ['camaron', '🦐'], ['langostino', '🦐'], ['calamar', '🦑'], ['pulpo', '🐙'], ['cangrejo', '🦀'], ['ostra', '🦪'], ['mejillon', '🦪'], ['pepitona', '🦪'],
  ['pescado', '🐟'], ['atun', '🐟'], ['salmon', '🐟'], ['sardina', '🐟'], ['pargo', '🐟'], ['mero', '🐟'], ['cazon', '🐟'], ['trucha', '🐟'], ['tilapia', '🐟'], ['bacalao', '🐟'], ['merluza', '🐟'], ['carite', '🐟'], ['corocoro', '🐟'], ['bagre', '🐟'], ['ceviche', '🐟'],
  ['tocineta', '🥓'], ['bacon', '🥓'], ['jamon', '🥓'], ['mortadela', '🥓'], ['chorizo', '🌭'], ['pollo', '🍗'], ['pechuga', '🍗'], ['alita', '🍗'], ['muslo', '🍗'], ['nugget', '🍗'], ['pavo', '🦃'],
  ['carne', '🥩'], ['bistec', '🥩'], ['res', '🥩'], ['solomo', '🥩'], ['lomo', '🥩'], ['costilla', '🍖'], ['cerdo', '🍖'], ['cochino', '🍖'], ['pernil', '🍖'], ['chuleta', '🍖'], ['asado', '🍖'], ['parrilla', '🍖'], ['chivo', '🍖'], ['higado', '🥩'], ['chicharron', '🍖'],
  ['caraota', '🫘'], ['frijol', '🫘'], ['lenteja', '🫘'], ['garbanzo', '🫘'], ['quinchoncho', '🫘'], ['edamame', '🫛'], ['arveja', '🫛'], ['guisante', '🫛'], ['hummus', '🫘'],
  ['arroz', '🍚'], ['avena', '🥣'], ['cereal', '🥣'], ['granola', '🥣'], ['muesli', '🥣'], ['quinua', '🌾'], ['quinoa', '🌾'], ['pan', '🍞'], ['croissant', '🥐'], ['bagel', '🥯'], ['panqueca', '🥞'], ['waffle', '🧇'], ['casabe', '🫓'], ['harina', '🌾'],
  ['platano', '🍌'], ['tajada', '🍌'], ['toston', '🍌'], ['patacon', '🍌'], ['topocho', '🍌'], ['cambur', '🍌'], ['banano', '🍌'], ['yuca', '🥔'], ['papa', '🥔'], ['batata', '🍠'], ['camote', '🍠'], ['ocumo', '🥔'], ['name', '🥔'], ['apio', '🥔'],
  ['manzana', '🍎'], ['pera', '🍐'], ['naranja', '🍊'], ['mandarina', '🍊'], ['limon', '🍋'], ['toronja', '🍊'], ['uva', '🍇'], ['pasas', '🍇'], ['fresa', '🍓'], ['mora', '🫐'], ['arandano', '🫐'], ['frambuesa', '🍓'], ['cereza', '🍒'],
  ['pina', '🍍'], ['mango', '🥭'], ['coco', '🥥'], ['patilla', '🍉'], ['sandia', '🍉'], ['melon', '🍈'], ['durazno', '🍑'], ['kiwi', '🥝'], ['lechosa', '🍈'], ['parchita', '🍋'], ['guayaba', '🍐'],
  ['aguacate', '🥑'], ['guacamole', '🥑'], ['guasacaca', '🥑'], ['tomate', '🍅'], ['zanahoria', '🥕'], ['brocoli', '🥦'], ['coliflor', '🥦'], ['lechuga', '🥬'], ['espinaca', '🥬'], ['acelga', '🥬'], ['repollo', '🥬'], ['col ', '🥬'], ['kale', '🥬'],
  ['jojoto', '🌽'], ['maiz', '🌽'], ['mazorca', '🌽'], ['pimenton', '🫑'], ['aji', '🌶️'], ['cebolla', '🧅'], ['ajo', '🧄'], ['champin', '🍄'], ['pepino', '🥒'], ['calabacin', '🥒'], ['berenjena', '🍆'], ['auyama', '🎃'], ['jengibre', '🫚'],
  ['mani', '🥜'], ['nuez', '🌰'], ['nueces', '🌰'], ['almendra', '🌰'], ['merey', '🌰'], ['avellana', '🌰'], ['pistacho', '🥜'], ['chia', '🌱'], ['linaza', '🌱'], ['semilla', '🌻'],
  ['aceite', '🫒'], ['aceituna', '🫒'], ['mantequilla', '🧈'], ['margarina', '🧈'], ['mayonesa', '🫙'], ['salsa', '🫙'], ['ketchup', '🍅'], ['mostaza', '🫙'],
  ['proteina', '💪'], ['whey', '💪'], ['creatina', '💪'], ['barra', '🍫'], ['tofu', '🧊'],
];

export function foodEmoji(f: Pick<Food, 'name' | 'cat'>): string {
  const n = ' ' + normalize(f.name) + ' ';
  for (const [k, e] of KEYS) if (n.includes(k)) return e;
  return CAT_STYLE[f.cat]?.emoji ?? '🍽️';
}

export function catHue(cat: string): string {
  return CAT_STYLE[cat]?.hue ?? '#A0A4B0';
}
