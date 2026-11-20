import { useState } from 'react';
import { ACTIVITY, GOALS, ageFromBirth, bmr, computeTargets, isoDate, tdee, type Activity, type Goal, type Sex } from '../lib/calc';
import { haptic, NumberField } from '../components/ui';
import { db, type Profile } from '../db';
import { bodyOf, logWeight, saveProfile } from '../lib/profile';

const GOAL_ICON: Record<Goal, string> = { perder: '🔥', mantener: '⚖️', ganar: '💪' };
const ACT_ICON: Record<Activity, string> = { sedentario: '🪑', ligero: '🚶', moderado: '🏋️', alto: '🏃', muy_alto: '⚡' };

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('perder');
  const [sex, setSex] = useState<Sex>('h');
  const [birth, setBirth] = useState('1995-01-01');
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(80);
  const [target, setTarget] = useState(72);
  const [activity, setActivity] = useState<Activity>('moderado');
  const [name, setName] = useState('');

  const TOTAL = 9;
  const next = () => {
    haptic();
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const age = ageFromBirth(birth);
  const body = { sex, age, heightCm: height, weightKg: weight, activity, goal };
  const targets = computeTargets(body);

  const finish = async () => {
    const p: Profile = {
      id: 1,
      name: name.trim(),
      sex,
      birth,
      heightCm: height,
      weightKg: weight,
      targetKg: target,
      activity,
      goal,
      ...targets,
      customMacros: false,
      waterGoal: 8,
      unit: 'kg',
      restSec: 90,
      createdAt: isoDate(),
    };
    await saveProfile(p);
    await logWeight(isoDate(), weight);
    await db.kv.put({ key: 'onboarded', value: true });
    onDone();
  };

  const validAge = age >= 14 && age <= 100;

  const screens = [
    // 0 Bienvenida
    <>
      <div style={{ fontSize: 64, marginTop: 30 }}>⚡</div>
      <h1>Bienvenido a Not Stop</h1>
      <p className="sub">Cuenta calorías y macros, registra tu fuerza y tus trotes, y sigue tu progreso. Todo gratis y guardado solo en tu teléfono.</p>
      <label className="small muted">¿Cómo te llamas? (opcional)</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" style={{ marginTop: 6 }} />
    </>,
    // 1 Objetivo
    <>
      <h1>¿Cuál es tu objetivo?</h1>
      <p className="sub">Puedes cambiarlo cuando quieras desde tu perfil.</p>
      {(Object.keys(GOALS) as Goal[]).map((g) => (
        <button key={g} className={'opt' + (goal === g ? ' on' : '')} onClick={() => { setGoal(g); haptic(); }}>
          <span className="emoji">{GOAL_ICON[g]}</span>
          <span className="grow">
            <div className="bold">{GOALS[g].label}</div>
            <div className="small muted">{GOALS[g].desc}</div>
          </span>
        </button>
      ))}
    </>,
    // 2 Sexo
    <>
      <h1>¿Cuál es tu sexo?</h1>
      <p className="sub">Lo usamos para calcular tu metabolismo basal.</p>
      {([['h', 'Hombre', '👨'], ['m', 'Mujer', '👩']] as const).map(([k, l, e]) => (
        <button key={k} className={'opt' + (sex === k ? ' on' : '')} onClick={() => { setSex(k); haptic(); }}>
          <span className="emoji">{e}</span>
          <span className="bold">{l}</span>
        </button>
      ))}
    </>,
    // 3 Nacimiento
    <>
      <h1>¿Cuándo naciste?</h1>
      <p className="sub">Tu edad cambia tu gasto de energía.</p>
      <input type="date" value={birth} max={isoDate()} onChange={(e) => setBirth(e.target.value)} style={{ fontSize: 20, textAlign: 'center' }} />
      <p className="center big num" style={{ marginTop: 26 }}>{validAge ? `${age} años` : '—'}</p>
      {!validAge && <p className="center small" style={{ color: 'var(--danger)' }}>Introduce una fecha válida (14 a 100 años).</p>}
    </>,
    // 4 Estatura
    <>
      <h1>¿Cuánto mides?</h1>
      <p className="sub">En centímetros.</p>
      <NumberField value={height} onChange={setHeight} min={120} max={230} suffix="cm" />
    </>,
    // 5 Peso
    <>
      <h1>¿Cuánto pesas hoy?</h1>
      <p className="sub">En kilogramos. Puedes usar decimales.</p>
      <NumberField value={weight} onChange={(v) => { setWeight(v); if (goal === 'perder' && target >= v) setTarget(Math.round(v * 0.9)); }} step={0.5} min={30} max={300} suffix="kg" />
    </>,
    // 6 Peso meta
    <>
      <h1>¿Cuál es tu peso meta?</h1>
      <p className="sub">Te mostraremos cuánto te falta en la pestaña Progreso.</p>
      <NumberField value={target} onChange={setTarget} step={0.5} min={30} max={300} suffix="kg" />
      <p className="center muted">
        {target < weight ? `Bajar ${(weight - target).toFixed(1)} kg` : target > weight ? `Subir ${(target - weight).toFixed(1)} kg` : 'Mantener tu peso'}
      </p>
    </>,
    // 7 Actividad
    <>
      <h1>¿Qué tan activo eres?</h1>
      <p className="sub">Cuenta tus entrenos de fuerza y tus trotes de la semana.</p>
      {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
        <button key={a} className={'opt' + (activity === a ? ' on' : '')} onClick={() => { setActivity(a); haptic(); }}>
          <span className="emoji">{ACT_ICON[a]}</span>
          <span className="grow">
            <div className="bold">{ACTIVITY[a].label}</div>
            <div className="small muted">{ACTIVITY[a].desc}</div>
          </span>
        </button>
      ))}
    </>,
    // 8 Resultado
    <>
      <h1>Tu plan está listo{name ? `, ${name.trim()}` : ''}</h1>
      <p className="sub">Meta diaria para «{GOALS[goal].label.toLowerCase()}».</p>
      <div className="card center">
        <div className="muted small">Calorías diarias</div>
        <div className="big num" style={{ fontSize: 48, color: 'var(--accent)' }}>{targets.kcal}</div>
        <div className="muted small">kcal</div>
        <div className="row" style={{ justifyContent: 'space-around', marginTop: 16 }}>
          <div className="kpi"><b style={{ color: 'var(--prot)' }}>{targets.protein} g</b><span>Proteína</span></div>
          <div className="kpi"><b style={{ color: 'var(--carb)' }}>{targets.carbs} g</b><span>Carbos</span></div>
          <div className="kpi"><b style={{ color: 'var(--fat)' }}>{targets.fat} g</b><span>Grasa</span></div>
        </div>
      </div>
      <div className="card small">
        <div className="row between"><span className="muted">Metabolismo basal</span><b className="num">{Math.round(bmr(bodyOf({ sex, birth, heightCm: height, weightKg: weight, activity, goal })))} kcal</b></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted">Gasto diario estimado</span><b className="num">{Math.round(tdee(body))} kcal</b></div>
      </div>
      <p className="note">Son estimaciones aproximadas (fórmula Mifflin-St Jeor). Podrás editarlas en tu perfil.</p>
    </>,
  ];

  return (
    <div className="ob">
      <div className="row" style={{ marginBottom: 10, minHeight: 32 }}>
        {step > 0 && <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={back}>‹ Atrás</button>}
      </div>
      <div className="ob-progress"><i style={{ width: `${((step + 1) / TOTAL) * 100}%` }} /></div>
      <div className="body" key={step} style={{ animation: 'fade .25s ease' }}>{screens[step]}</div>
      <div style={{ paddingTop: 16 }}>
        {step < TOTAL - 1 ? (
          <button className="btn" onClick={next} disabled={step === 3 && !validAge}>
            {step === 0 ? 'Comenzar' : 'Continuar'}
          </button>
        ) : (
          <button className="btn" onClick={finish}>Empezar</button>
        )}
      </div>
    </div>
  );
}
