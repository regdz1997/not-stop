import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { useApp } from '../ctx';
import { MEALS, mealForHour, round1, type MealKey } from '../lib/calc';
import { analyzeMeal, fileToImage, friendlyError, type AIItem } from '../lib/ai';
import { normalize, type Food } from '../data/foods';
import { fmtNum, haptic, Sheet, toast } from '../components/ui';

export type AIMode = 'foto' | 'voz' | 'texto';

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function speechSupported() {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Guarda un ítem de IA como alimento propio (para recientes) y lo registra en el diario. */
export async function saveAIItems(items: AIItem[], date: string, meal: MealKey) {
  const now = Date.now();
  for (const [i, it] of items.entries()) {
    const k = 100 / it.grams;
    const id = 'ai-' + normalize(it.name).replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const per = { kcal: it.kcal * k, p: it.protein * k, c: it.carbs * k, f: it.fat * k, fiber: it.fiber * k };
    const unitG = it.quantity > 0 ? it.grams / it.quantity : it.grams;
    const food: Food = { id, name: it.name, cat: 'Mis', ...per, servings: [...(it.unit !== 'g' ? [{ label: it.unit, g: round1(unitG) }] : []), { label: 'gramos', g: 1 }], custom: true };
    await db.foods.put(food);
    await db.entries.add({
      date,
      meal,
      foodId: id,
      name: it.name,
      qty: it.unit === 'g' ? it.grams : it.quantity,
      servingLabel: it.unit === 'g' ? 'gramos' : it.unit,
      grams: it.grams,
      kcal: Math.round(it.kcal),
      p: round1(it.protein),
      c: round1(it.carbs),
      f: round1(it.fat),
      fiber: round1(it.fiber),
      createdAt: now + i,
    });
  }
}

export default function AILog({ mode: initialMode, onClose }: { mode: AIMode; onClose: () => void }) {
  const { profile, date } = useApp();
  const [mode, setMode] = useState<AIMode>(initialMode);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; mediaType: 'image/jpeg'; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<AIItem[] | null>(null);
  const [note, setNote] = useState('');
  const [meal, setMeal] = useState<MealKey>(mealForHour(new Date().getHours()));
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasKey = !!profile.aiKey?.trim();

  useEffect(() => () => recRef.current?.stop(), []);
  useEffect(() => {
    if (initialMode === 'foto' && hasKey) setTimeout(() => fileRef.current?.click(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVoice = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setErr('Este navegador no permite el dictado dentro de la app. Toca el campo de texto y usa el micrófono 🎙️ del teclado del iPhone: funciona igual.');
      return;
    }
    setErr('');
    const rec = new Ctor();
    rec.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX';
    rec.continuous = true;
    rec.interimResults = true;
    const base = text ? text.trim() + ' ' : '';
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(base + t);
    };
    rec.onerror = (e) => {
      setListening(false);
      setErr(e.error === 'not-allowed' ? 'Permite el micrófono en Ajustes → Safari → Micrófono.' : 'No se pudo escuchar. Prueba otra vez o escribe.');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    haptic();
  };
  const stopVoice = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const analyze = async () => {
    stopVoice();
    setBusy(true);
    setErr('');
    try {
      const r = await analyzeMeal({ apiKey: profile.aiKey, model: profile.aiModel }, { text, image: photo ?? undefined });
      if (!r.items.length) setErr(r.note || 'No encontré alimentos. Describe la comida con más detalle.');
      setItems(r.items);
      setNote(r.note);
      haptic();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const setGrams = (i: number, g: number) => {
    setItems((list) =>
      list!.map((it, k) => {
        if (k !== i || g <= 0) return it;
        const f = g / it.grams;
        return { ...it, grams: g, quantity: round1(it.quantity * f), kcal: Math.round(it.kcal * f), protein: round1(it.protein * f), carbs: round1(it.carbs * f), fat: round1(it.fat * f), fiber: round1(it.fiber * f) };
      }),
    );
  };

  const save = async () => {
    if (!items?.length) return;
    await saveAIItems(items, date, meal);
    toast(`✅ ${items.length} alimentos agregados`);
    onClose();
  };

  const tot = items?.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat }), { kcal: 0, p: 0, c: 0, f: 0 });

  return (
    <Sheet full title="Registrar con IA" onClose={onClose}>
      {!hasKey && (
        <div className="card live-banner small">
          <b>Falta tu clave de IA.</b> Agrégala en Perfil → Inteligencia artificial. Mientras tanto puedes usar la búsqueda, el código de barras o crear alimentos a mano.
        </div>
      )}
      {items === null ? (
        <>
          <div className="seg">
            <button className={mode === 'foto' ? 'on' : ''} onClick={() => setMode('foto')}>📷 Foto</button>
            <button className={mode === 'voz' ? 'on' : ''} onClick={() => setMode('voz')}>🎙️ Voz</button>
            <button className={mode === 'texto' ? 'on' : ''} onClick={() => setMode('texto')}>💬 Texto</button>
          </div>

          {mode === 'foto' && (
            <div className="card center">
              {photo ? <img src={photo.dataUrl} alt="Tu comida" style={{ width: '100%', borderRadius: 14, maxHeight: 320, objectFit: 'cover' }} /> : <div style={{ fontSize: 54, padding: 20 }}>📷</div>}
              <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>{photo ? 'Cambiar foto' : 'Tomar o elegir foto'}</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try { setPhoto(await fileToImage(f)); } catch { setErr('No se pudo leer la imagen.'); }
              }} />
            </div>
          )}

          {mode === 'voz' && (
            <div className="card center">
              <button className="tap" onClick={listening ? stopVoice : startVoice} aria-label={listening ? 'Detener dictado' : 'Dictar'}
                style={{ width: 96, height: 96, borderRadius: '50%', background: listening ? 'var(--danger)' : 'var(--accent)', color: '#fff', fontSize: 40, boxShadow: listening ? '0 0 0 10px rgba(255,90,95,.2)' : undefined }}>
                {listening ? '■' : '🎙️'}
              </button>
              <div className="muted small" style={{ marginTop: 10 }}>{listening ? 'Escuchando… di lo que comiste' : 'Toca y di, por ejemplo: «dos huevos revueltos, una arepa y un café con leche»'}</div>
            </div>
          )}

          <label className="small muted">{mode === 'foto' ? 'Detalles opcionales (ayudan a la IA)' : '¿Qué comiste?'}</label>
          <textarea rows={mode === 'foto' ? 2 : 4} value={text} onChange={(e) => setText(e.target.value)} style={{ marginTop: 6 }}
            placeholder={mode === 'foto' ? 'Ej.: el arroz era con aceite, el jugo sin azúcar' : 'Ej.: 2 huevos revueltos, una arepa con queso y un café con leche'} />

          {err && <div className="card small" style={{ color: 'var(--danger)', marginTop: 10 }}>{err}</div>}

          <button className="btn" style={{ marginTop: 14 }} disabled={busy || !hasKey || (mode === 'foto' ? !photo : !text.trim())} onClick={analyze}>
            {busy ? 'Analizando…' : '✨ Analizar'}
          </button>
          <p className="note">Solo se envía {mode === 'foto' ? 'la foto (reducida) y el texto' : 'el texto'} a la IA. Los resultados son estimaciones: revísalos antes de guardar.</p>
        </>
      ) : (
        <>
          {photo && <img src={photo.dataUrl} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: 180, objectFit: 'cover', marginBottom: 10 }} />}
          <div className="card row" style={{ justifyContent: 'space-around' }}>
            <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{tot!.kcal}</b><span>kcal</span></div>
            <div className="kpi"><b className="num" style={{ color: 'var(--prot)' }}>{Math.round(tot!.p)} g</b><span>Proteína</span></div>
            <div className="kpi"><b className="num" style={{ color: 'var(--carb)' }}>{Math.round(tot!.c)} g</b><span>Carbos</span></div>
            <div className="kpi"><b className="num" style={{ color: 'var(--fat)' }}>{Math.round(tot!.f)} g</b><span>Grasa</span></div>
          </div>
          {note && <div className="muted small" style={{ margin: '0 4px 10px' }}>💡 {note}</div>}
          <div className="section-title">Revisa y ajusta</div>
          <div className="list">
            {items.map((it, i) => (
              <div className="item" key={`${i}-${items.length}`} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <input value={it.name} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} style={{ padding: '6px 8px', marginBottom: 6 }} />
                  <div className="row small">
                    <input inputMode="decimal" className="num" defaultValue={it.grams} onBlur={(e) => setGrams(i, parseFloat(e.target.value.replace(',', '.')) || it.grams)} style={{ width: 80, padding: '6px 8px', textAlign: 'center' }} aria-label="Gramos" />
                    <span className="muted">g · {fmtNum(it.quantity, 1)} {it.unit}</span>
                  </div>
                  <div className="tiny muted num" style={{ marginTop: 4 }}>{it.kcal} kcal · P {Math.round(it.protein)} · C {Math.round(it.carbs)} · G {Math.round(it.fat)}</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Quitar" onClick={() => setItems(items.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
          </div>
          <label className="small muted">Comida</label>
          <div className="chips" style={{ margin: '6px 0 14px' }}>
            {MEALS.map((m) => <button key={m.key} className={'chip' + (meal === m.key ? ' on' : '')} onClick={() => setMeal(m.key)}>{m.icon} {m.label}</button>)}
          </div>
          <button className="btn" disabled={!items.length} onClick={save}>Guardar {items.length} alimentos</button>
          <button className="btn ghost" onClick={() => setItems(null)}>‹ Volver a intentar</button>
          <p className="note">Cambia los gramos y los nutrientes se recalculan. Valores aproximados.</p>
        </>
      )}
    </Sheet>
  );
}
