import { createContext, useContext } from 'react';
import type { Profile } from './db';
import type { MealKey } from './lib/calc';

export type Tab = 'diario' | 'plan' | 'entreno' | 'progreso';

export interface AppCtx {
  profile: Profile;
  date: string;
  setDate: (d: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  openAddFood: (meal?: MealKey) => void;
  openSettings: () => void;
  openHub: () => void;
  openRun: () => void;
  openWeight: () => void;
  openFasting: () => void;
  openAI: (mode: 'foto' | 'voz' | 'texto') => void;
  openScan: () => void;
  openMeasure: () => void;
  openCompare: () => void;
}

export const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => useContext(Ctx)!;
