import { db } from '../db';
import { useApp } from '../ctx';
import { haptic, IconBubble, Sheet, toast, type IconName } from '../components/ui';

export default function Hub({ onClose }: { onClose: () => void }) {
  const { openAddFood, openRun, openWeight, setTab, date, openFasting, openAI, openScan, openMeasure, openCompare } = useApp();
  const go = (fn: () => void) => () => { haptic(); onClose(); fn(); };
  const water = async () => {
    const w = await db.water.get(date);
    await db.water.put({ date, glasses: (w?.glasses ?? 0) + 1 });
    haptic();
    toast('Vaso de agua sumado');
  };

  const food: [string, IconName, string, () => void][] = [
    ['Foto', 'camera', '#4d8dff', go(() => openAI('foto'))],
    ['Voz', 'mic', '#ff5c7a', go(() => openAI('voz'))],
    ['Describir', 'chat', '#7a6bff', go(() => openAI('texto'))],
    ['Código', 'barcode', '#3dd6a4', go(openScan)],
    ['Buscar', 'search', '#ffb547', go(() => openAddFood())],
    ['Agua', 'water', '#5ac8fa', water],
  ];
  const body: [string, IconName, string, () => void][] = [
    ['Peso', 'scale', '#9c8cff', go(openWeight)],
    ['Medidas', 'ruler', '#ff8ad0', go(openMeasure)],
    ['Ayuno', 'timer', '#ffb547', go(openFasting)],
    ['Fuerza', 'dumbbell', '#4d8dff', go(() => setTab('entreno'))],
    ['Trote', 'run', '#3dd6a4', go(openRun)],
    ['Comparar', 'compare', '#ff7a59', go(openCompare)],
  ];
  const grid = (items: typeof food) => (
    <div className="fab-mini">
      {items.map(([l, icon, hue, fn]) => (
        <button key={l} className="tap" onClick={fn}>
          <IconBubble name={icon} hue={hue} size="lg" />
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <Sheet title="Registrar" onClose={onClose}>
      <div className="section-title" style={{ marginTop: 4 }}>Comida</div>
      {grid(food)}
      <div className="section-title">Cuerpo y entreno</div>
      {grid(body)}
    </Sheet>
  );
}
