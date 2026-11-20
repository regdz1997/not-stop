import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, exportCSV, importAll, type Profile } from '../db';
import { useApp } from '../ctx';
import { ACTIVITY, ageFromBirth, computeTargets, GOALS, isoDate, macrosFor, type Activity, type Goal } from '../lib/calc';
import { bodyOf, saveProfile } from '../lib/profile';
import { download, fmtDate, fmtNum, Sheet, toast, Ico } from '../components/ui';
import { MEALS } from '../lib/calc';
import type { DietType } from '../db';
import { DIETS } from './Plan';
import { AI_MODELS, DEFAULT_MODEL, friendlyError, testKey } from '../lib/ai';
import { buildICS } from '../lib/ics';

export default function Settings({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const [p, setP] = useState<Profile>(profile);
  const goals = useLiveQuery(() => db.goals.orderBy(':id').reverse().limit(10).toArray(), [], []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [excludedTxt, setExcludedTxt] = useState((profile.excluded ?? []).join(', '));
  const [keyMsg, setKeyMsg] = useState('');
  const shortcutURL = `${location.origin}${location.pathname}?peso=PESO&pasos=PASOS`;
  const reminderICS = () => {
    const rs = MEALS.filter((m) => p.reminders?.[m.key]).map((m) => ({ title: `${m.icon} ${m.label} – registra en Not Stop`, time: p.reminders![m.key]! }));
    download('recordatorios-not-stop.ics', buildICS(rs), 'text/calendar');
  };
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const n = (s: string) => Math.max(0, parseFloat(s.replace(',', '.')) || 0);

  const recommended = computeTargets(bodyOf(p));
  const macroKcal = p.protein * 4 + p.carbs * 4 + p.fat * 9;

  const save = async () => {
    const excluded = excludedTxt.split(',').map((x) => x.trim()).filter(Boolean);
    await saveProfile({ ...p, excluded }, { recalc: !p.customMacros });
    toast('Perfil guardado');
    onClose();
  };

  const backup = async () => {
    const data = await exportAll();
    download(`not-stop-respaldo-${isoDate()}.json`, JSON.stringify(data));
    await db.kv.put({ key: 'lastBackup', value: isoDate() });
  };

  const csvs = async () => {
    const files = await exportCSV();
    for (const [name, content] of Object.entries(files)) download(name, '﻿' + content, 'text/csv');
  };

  const restore = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (!confirm('Esto reemplaza TODOS los datos de este teléfono con los del respaldo. ¿Continuar?')) return;
      await importAll(json);
      toast('Respaldo restaurado');
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    }
  };

  const reset = async () => {
    if (!confirm('¿Borrar todos tus datos de este teléfono? No se puede deshacer. Haz un respaldo antes.')) return;
    if (!confirm('Última confirmación: se borrará todo.')) return;
    await db.delete();
    location.reload();
  };

  const age = ageFromBirth(p.birth);

  return (
    <Sheet full title="Perfil y ajustes" onClose={onClose} right={<button className="btn sm" onClick={save}>Guardar</button>}>
      <div className="section-title">Mis datos</div>
      <div className="card col">
        <Field label="Nombre"><input value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="seg" style={{ margin: 0 }}>
          <button className={p.sex === 'h' ? 'on' : ''} onClick={() => set('sex', 'h')}>Hombre</button>
          <button className={p.sex === 'm' ? 'on' : ''} onClick={() => set('sex', 'm')}>Mujer</button>
        </div>
        <Field label={`Fecha de nacimiento (${age} años)`}><input type="date" value={p.birth} max={isoDate()} onChange={(e) => set('birth', e.target.value)} /></Field>
        <div className="row">
          <Field label="Estatura (cm)"><input inputMode="decimal" defaultValue={p.heightCm} onChange={(e) => set('heightCm', n(e.target.value))} /></Field>
          <Field label="Peso (kg)"><input inputMode="decimal" defaultValue={p.weightKg} onChange={(e) => set('weightKg', n(e.target.value))} /></Field>
          <Field label="Meta (kg)"><input inputMode="decimal" defaultValue={p.targetKg} onChange={(e) => set('targetKg', n(e.target.value))} /></Field>
        </div>
        <Field label="Nivel de actividad">
          <select value={p.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => <option key={a} value={a}>{ACTIVITY[a].label} · {ACTIVITY[a].desc}</option>)}
          </select>
        </Field>
      </div>

      <div className="section-title">Objetivo</div>
      <div className="seg">
        {(Object.keys(GOALS) as Goal[]).map((g) => (
          <button key={g} className={p.goal === g ? 'on' : ''} onClick={() => set('goal', g)}>{GOALS[g].label.replace('Mantener mi peso', 'Mantener').replace('Bajar de peso', 'Bajar').replace('Ganar músculo', 'Ganar')}</button>
        ))}
      </div>

      <div className="section-title">Calorías y macros</div>
      <div className="card col">
        <label className="row between">
          <span>Personalizar manualmente</span>
          <input type="checkbox" checked={p.customMacros} onChange={(e) => {
            const on = e.target.checked;
            setP((x) => ({ ...x, customMacros: on, ...(on ? {} : recommended) }));
          }} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
        </label>
        {!p.customMacros ? (
          <div className="small muted">
            Recomendado: <b style={{ color: 'var(--text)' }}>{recommended.kcal} kcal</b> · P {recommended.protein} g · C {recommended.carbs} g · G {recommended.fat} g. Se recalcula al guardar.
          </div>
        ) : (
          <>
            <div className="row">
              <Field label="Calorías"><input inputMode="numeric" value={p.kcal} onChange={(e) => set('kcal', Math.round(n(e.target.value)))} /></Field>
              <button className="btn secondary sm" style={{ alignSelf: 'flex-end', height: 48 }} onClick={() => setP((x) => ({ ...x, ...macrosFor(x.kcal, x.weightKg, x.goal) }))}>Repartir</button>
            </div>
            <div className="row">
              <Field label="Proteína g"><input inputMode="numeric" value={p.protein} onChange={(e) => set('protein', Math.round(n(e.target.value)))} /></Field>
              <Field label="Carbos g"><input inputMode="numeric" value={p.carbs} onChange={(e) => set('carbs', Math.round(n(e.target.value)))} /></Field>
              <Field label="Grasa g"><input inputMode="numeric" value={p.fat} onChange={(e) => set('fat', Math.round(n(e.target.value)))} /></Field>
            </div>
            <div className="small muted">
              Las macros suman {macroKcal} kcal{Math.abs(macroKcal - p.kcal) > 50 ? ` (meta ${p.kcal})` : ''} · proteína {fmtNum(p.protein / (p.weightKg || 1), 1)} g/kg
            </div>
          </>
        )}
      </div>

      <div className="section-title">Preferencias</div>
      <div className="card col">
        <div className="row">
          <Field label="Vasos de agua al día"><input inputMode="numeric" value={p.waterGoal} onChange={(e) => set('waterGoal', Math.min(20, Math.round(n(e.target.value))))} /></Field>
          <Field label="Descanso entre series (s)"><input inputMode="numeric" value={p.restSec} onChange={(e) => set('restSec', Math.round(n(e.target.value)))} /></Field>
        </div>
        <Field label="Unidad de peso">
          <div className="seg" style={{ margin: 0 }}>
            <button className={p.unit === 'kg' ? 'on' : ''} onClick={() => set('unit', 'kg')}>kg</button>
            <button className={p.unit === 'lb' ? 'on' : ''} onClick={() => set('unit', 'lb')}>lb</button>
          </div>
        </Field>
        <label className="row between">
          <span>Ajuste semanal de calorías<div className="tiny muted">Propone una meta nueva según tu peso real</div></span>
          <input type="checkbox" checked={p.adaptive !== false} onChange={(e) => set('adaptive', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
        </label>
      </div>

      <div className="section-title">Dieta y menú</div>
      <div className="card col">
        <Field label="Tipo de dieta">
          <select value={p.dietType ?? 'normal'} onChange={(e) => set('dietType', e.target.value as DietType)}>
            {DIETS.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Alimentos que no me gustan (separados por coma)">
          <input value={excludedTxt} onChange={(e) => setExcludedTxt(e.target.value)} placeholder="Ej.: atún, brócoli, cerdo" />
        </Field>
        <Field label="Comidas al día">
          <div className="seg" style={{ margin: 0 }}>
            {[3, 4, 5].map((n) => <button key={n} className={(p.mealsPerDay ?? 4) === n ? 'on' : ''} onClick={() => set('mealsPerDay', n as 3 | 4 | 5)}>{n}</button>)}
          </div>
        </Field>
      </div>

      <div className="section-title">Recordatorios</div>
      <div className="card col">
        {MEALS.map((m) => (
          <div className="row between" key={m.key}>
            <span>{m.icon} {m.label}</span>
            <input type="time" value={p.reminders?.[m.key] ?? ''} onChange={(e) => set('reminders', { ...(p.reminders ?? {}), [m.key]: e.target.value })} style={{ width: 130 }} />
          </div>
        ))}
        <button className="btn secondary" disabled={!Object.values(p.reminders ?? {}).some(Boolean)} onClick={reminderICS}><Ico name="calendar" />Añadir recordatorios al Calendario</button>
        <div className="tiny muted">Safari no permite que una web programe avisos con la app cerrada. Por eso los recordatorios van a tu Calendario del iPhone, que avisa siempre. Abre el archivo y toca «Añadir todo».</div>
      </div>

      <div className="section-title">Inteligencia artificial</div>
      <div className="card col">
        <Field label="Clave de API de Anthropic (Claude)">
          <input type="password" autoComplete="off" value={p.aiKey ?? ''} onChange={(e) => set('aiKey', e.target.value)} placeholder="sk-ant-… · se guarda solo en este teléfono" />
        </Field>
        <Field label="Modelo">
          <select value={p.aiModel ?? DEFAULT_MODEL} onChange={(e) => set('aiModel', e.target.value)}>
            {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <button className="btn secondary sm" disabled={!p.aiKey?.trim() || keyMsg === '…'} onClick={async () => {
          setKeyMsg('…');
          try { setKeyMsg('✅ Clave válida: ' + (await testKey({ apiKey: p.aiKey, model: p.aiModel }))); } catch (e) { setKeyMsg('❌ ' + friendlyError(e)); }
        }}>Probar clave</button>
        {keyMsg && keyMsg !== '…' && <div className="small">{keyMsg}</div>}
        <div className="tiny muted">Se usa para foto, voz, texto, etiquetas y el coach. Crea la clave en console.anthropic.com. Cada análisis cuesta céntimos de dólar (Haiku: fracciones de céntimo). Solo se envía lo que tú mandes a analizar.</div>
      </div>

      <div className="section-title">Apple Salud (peso y pasos)</div>
      <div className="card small col">
        <div>Las webs no pueden leer Apple Salud. Con un <b>Atajo</b> de iOS lo traes en un toque:</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Abre <b>Atajos</b> → ＋ → «Buscar muestras de salud»: <i>Peso</i>, la más reciente.</li>
          <li>Agrega «Buscar muestras de salud»: <i>Pasos</i>, de hoy, y «Calcular estadísticas»: suma.</li>
          <li>Agrega «Abrir URL» con:<br /><code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{shortcutURL}</code><br />reemplazando PESO y PASOS por las variables.</li>
          <li>Ponle de nombre «Not Stop Salud» y añádelo a la pantalla de inicio o a una automatización diaria.</li>
        </ol>
        <button className="btn secondary sm" onClick={async () => { try { await navigator.clipboard.writeText(shortcutURL); toast('URL copiada'); } catch { /* sin portapapeles */ } }}>Copiar URL</button>
      </div>

      {goals.length > 0 && (
        <>
          <div className="section-title">Historial de objetivos</div>
          <div className="list">
            {goals.map((g) => (
              <div className="item small" key={g.id}>
                <div className="grow">{GOALS[g.goal].label}<div className="muted tiny">{fmtDate(g.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                <span className="num">{g.kcal} kcal · P {g.protein}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Mis datos y copia de seguridad</div>
      <div className="list">
        <button className="item" onClick={backup}><span className="emoji">💾</span><div className="grow">Crear copia de seguridad (JSON)<div className="muted small">Guárdala en Archivos o iCloud Drive</div></div></button>
        <button className="item" onClick={() => fileRef.current?.click()}><span className="emoji">📥</span><div className="grow">Restaurar copia de seguridad</div></button>
        <button className="item" onClick={csvs}><span className="emoji">📊</span><div className="grow">Exportar historial (CSV)<div className="muted small">Comidas, peso, entrenos y trotes</div></div></button>
        <button className="item" onClick={reset}><span className="emoji">🗑️</span><div className="grow" style={{ color: 'var(--danger)' }}>Borrar todos los datos</div></button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />

      <div className="card small muted">
        <b style={{ color: 'var(--text)' }}>Privacidad.</b> Tus datos se guardan solo en este teléfono, sin cuentas ni servidor. Si borras los datos de Safari o desinstalas la app, se pierden: haz copias de seguridad.
        <br /><br />
        <b style={{ color: 'var(--text)' }}>Apple Health.</b> Una web no puede conectarse a Salud; eso llegará con la versión nativa (v5).
        <br /><br />
        Las calorías y los nutrientes son estimaciones aproximadas y no sustituyen el consejo de un profesional.
      </div>
      <p className="note">Not Stop v2.0</p>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grow">
      <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
