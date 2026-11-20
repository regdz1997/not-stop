export interface Exercise {
  id: string;
  name: string;
  group: string;
  custom?: boolean;
}

export const GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Glúteos', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cuerpo completo'];

const L: [string, string, string][] = [
  ['press-banca', 'Press de banca con barra', 'Pecho'],
  ['press-inclinado-mancuerna', 'Press inclinado con mancuernas', 'Pecho'],
  ['press-mancuernas', 'Press plano con mancuernas', 'Pecho'],
  ['aperturas', 'Aperturas con mancuernas', 'Pecho'],
  ['cruce-poleas', 'Cruce de poleas', 'Pecho'],
  ['fondos', 'Fondos en paralelas', 'Pecho'],
  ['flexiones', 'Flexiones de pecho', 'Pecho'],
  ['dominadas', 'Dominadas', 'Espalda'],
  ['jalon-pecho', 'Jalón al pecho', 'Espalda'],
  ['remo-barra', 'Remo con barra', 'Espalda'],
  ['remo-mancuerna', 'Remo con mancuerna a una mano', 'Espalda'],
  ['remo-sentado', 'Remo sentado en polea', 'Espalda'],
  ['peso-muerto', 'Peso muerto', 'Espalda'],
  ['pullover', 'Pullover en polea', 'Espalda'],
  ['sentadilla', 'Sentadilla con barra', 'Piernas'],
  ['sentadilla-frontal', 'Sentadilla frontal', 'Piernas'],
  ['prensa', 'Prensa de piernas', 'Piernas'],
  ['zancadas', 'Zancadas con mancuernas', 'Piernas'],
  ['bulgara', 'Sentadilla búlgara', 'Piernas'],
  ['extension-cuadriceps', 'Extensión de cuádriceps', 'Piernas'],
  ['curl-femoral', 'Curl femoral', 'Piernas'],
  ['peso-muerto-rumano', 'Peso muerto rumano', 'Piernas'],
  ['pantorrilla', 'Elevación de pantorrillas', 'Piernas'],
  ['hip-thrust', 'Hip thrust', 'Glúteos'],
  ['patada-gluteo', 'Patada de glúteo en polea', 'Glúteos'],
  ['abduccion', 'Abducción de cadera en máquina', 'Glúteos'],
  ['press-militar', 'Press militar con barra', 'Hombros'],
  ['press-hombro-mancuerna', 'Press de hombro con mancuernas', 'Hombros'],
  ['elevaciones-laterales', 'Elevaciones laterales', 'Hombros'],
  ['pajaros', 'Pájaros / deltoide posterior', 'Hombros'],
  ['face-pull', 'Face pull', 'Hombros'],
  ['encogimientos', 'Encogimientos de trapecio', 'Hombros'],
  ['curl-barra', 'Curl de bíceps con barra', 'Bíceps'],
  ['curl-mancuerna', 'Curl con mancuernas', 'Bíceps'],
  ['curl-martillo', 'Curl martillo', 'Bíceps'],
  ['curl-predicador', 'Curl predicador', 'Bíceps'],
  ['extension-triceps-polea', 'Extensión de tríceps en polea', 'Tríceps'],
  ['press-frances', 'Press francés', 'Tríceps'],
  ['press-cerrado', 'Press de banca agarre cerrado', 'Tríceps'],
  ['extension-nuca', 'Extensión sobre la cabeza', 'Tríceps'],
  ['plancha', 'Plancha (segundos como reps)', 'Core'],
  ['crunch', 'Crunch abdominal', 'Core'],
  ['elevacion-piernas', 'Elevación de piernas colgado', 'Core'],
  ['rueda', 'Rueda abdominal', 'Core'],
  ['russian-twist', 'Giros rusos', 'Core'],
  ['burpees', 'Burpees', 'Cuerpo completo'],
  ['kettlebell-swing', 'Swing con kettlebell', 'Cuerpo completo'],
  ['clean', 'Cargada (clean)', 'Cuerpo completo'],
];

export const SEED_EXERCISES: Exercise[] = L.map(([id, name, group]) => ({ id, name, group }));

export const SEED_ROUTINES = [
  { name: 'Empuje', exerciseIds: ['press-banca', 'press-inclinado-mancuerna', 'press-hombro-mancuerna', 'elevaciones-laterales', 'extension-triceps-polea'] },
  { name: 'Tirón', exerciseIds: ['dominadas', 'remo-barra', 'jalon-pecho', 'face-pull', 'curl-mancuerna', 'curl-martillo'] },
  { name: 'Pierna', exerciseIds: ['sentadilla', 'peso-muerto-rumano', 'prensa', 'curl-femoral', 'hip-thrust', 'pantorrilla'] },
];
