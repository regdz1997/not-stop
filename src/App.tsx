import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Ctx, type Tab } from './ctx';
import { isoDate, mealForHour, type MealKey } from './lib/calc';
import { haptic, Icon, toast, ToastHost } from './components/ui';
import Onboarding from './screens/Onboarding';
import Diary from './screens/Diary';
import AddFood from './screens/AddFood';
import Train from './screens/Train';
import Progress, { WeightSheet } from './screens/Progress';
import Plan from './screens/Plan';
import Settings from './screens/Settings';
import Hub from './screens/Hub';
import { RunSheet } from './screens/Run';
import Fasting from './screens/Fasting';
import AILog, { type AIMode } from './screens/AILog';
import Barcode from './screens/Barcode';
import Compare from './screens/Compare';
import { MeasureSheet } from './screens/Body';
import { importFromURL } from './lib/urlImport';

export default function App() {
  const profile = useLiveQuery(() => db.profile.get(1), [], null);
  const [tab, setTab] = useState<Tab>('diario');
  const [date, setDate] = useState(isoDate());
  const [addMeal, setAddMeal] = useState<MealKey | null>(null);
  const [settings, setSettings] = useState(false);
  const [hub, setHub] = useState(false);
  const [run, setRun] = useState(false);
  const [weight, setWeight] = useState(false);
  const [fasting, setFasting] = useState(false);
  const [ai, setAi] = useState<AIMode | null>(null);
  const [scan, setScan] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [compare, setCompare] = useState(false);

  // Importación desde un Atajo de iOS: ?peso=81.2&pasos=8000&fecha=2026-11-19
  useEffect(() => {
    if (!profile) return;
    importFromURL(location.search).then((msg) => {
      if (msg) {
        toast(msg);
        history.replaceState(null, '', location.pathname);
      }
    });
  }, [profile]);

  // null = cargando; undefined = sin perfil
  if (profile === null) return null;
  if (!profile) return <Onboarding onDone={() => setTab('diario')} />;

  const ctx = {
    profile,
    date,
    setDate,
    tab,
    setTab,
    openAddFood: (m?: MealKey) => setAddMeal(m ?? mealForHour(new Date().getHours())),
    openSettings: () => setSettings(true),
    openHub: () => setHub(true),
    openRun: () => setRun(true),
    openWeight: () => setWeight(true),
    openFasting: () => setFasting(true),
    openAI: (m: AIMode) => setAi(m),
    openScan: () => setScan(true),
    openMeasure: () => setMeasure(true),
    openCompare: () => setCompare(true),
  };

  const tabs: { k: Tab | 'plus'; label: string; icon: () => JSX.Element }[] = [
    { k: 'diario', label: 'Diario', icon: Icon.diary },
    { k: 'plan', label: 'Plan', icon: Icon.plan },
    { k: 'plus', label: '', icon: Icon.plus },
    { k: 'entreno', label: 'Entreno', icon: Icon.train },
    { k: 'progreso', label: 'Progreso', icon: Icon.progress },
  ];

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        {tab === 'diario' && <Diary />}
        {tab === 'plan' && <Plan />}
        {tab === 'entreno' && <Train />}
        {tab === 'progreso' && <Progress />}
      </div>
      <nav className="tabbar">
        {tabs.map((t) =>
          t.k === 'plus' ? (
            <button key="plus" className="tab-plus tap" aria-label="Registrar" onClick={() => { haptic(); setHub(true); }}>
              <t.icon />
            </button>
          ) : (
            <button key={t.k} className={'tab' + (tab === t.k ? ' on' : '')} onClick={() => { haptic(); setTab(t.k as Tab); window.scrollTo(0, 0); }}>
              <t.icon />
              {t.label}
            </button>
          ),
        )}
      </nav>
      {hub && <Hub onClose={() => setHub(false)} />}
      {addMeal && <AddFood meal={addMeal} onClose={() => setAddMeal(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
      {run && <RunSheet onClose={() => setRun(false)} />}
      {weight && <WeightSheet onClose={() => setWeight(false)} />}
      {fasting && <Fasting onClose={() => setFasting(false)} />}
      {ai && <AILog mode={ai} onClose={() => setAi(null)} />}
      {scan && <Barcode onClose={() => setScan(false)} />}
      {measure && <MeasureSheet onClose={() => setMeasure(false)} />}
      {compare && <Compare onClose={() => setCompare(false)} />}
      <ToastHost />
    </Ctx.Provider>
  );
}
