import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { db } from '../db';
import { useApp } from '../ctx';
import { mealForHour, MEALS } from '../lib/calc';
import { lookupBarcode } from '../lib/off';
import type { Food } from '../data/foods';
import { haptic, Sheet, toast, Ico } from '../components/ui';
import { PortionSheet } from '../components/Portion';
import { CustomFoodSheet } from './AddFood';

export default function Barcode({ onClose }: { onClose: () => void }) {
  const { date } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'scanning' | 'searching' | 'notfound' | 'error' | 'nocam'>('scanning');
  const [msg, setMsg] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  };

  const start = async () => {
    stop();
    setStatus('scanning');
    try {
      // El lector se descarga solo al abrir el escáner (arranque de la app más rápido).
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      controlsRef.current = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
        if (result) {
          stop();
          haptic();
          search(result.getText());
        }
      });
    } catch {
      setStatus('nocam');
    }
  };

  useEffect(() => {
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (raw: string) => {
    const c = raw.replace(/\D/g, '');
    setCode(c);
    setStatus('searching');
    try {
      const local = await db.foods.get('off-' + c);
      const f = local ?? (await lookupBarcode(c));
      if (!f) {
        setStatus('notfound');
        return;
      }
      await db.foods.put(f);
      setFood(f);
    } catch (e) {
      setStatus('error');
      setMsg(navigator.onLine ? (e instanceof Error ? e.message : 'Error al buscar.') : 'Sin conexión: el código de barras necesita internet la primera vez.');
    }
  };

  return (
    <Sheet full title="Código de barras" onClose={() => { stop(); onClose(); }}>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3', display: status === 'scanning' ? 'block' : 'none' }}>
        <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: '24%', border: '3px solid var(--accent)', borderRadius: 12, boxShadow: '0 0 0 999px rgba(0,0,0,.35)' }} />
        <div className="small center" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, color: '#fff' }}>Apunta al código de barras</div>
      </div>
      {status === 'nocam' && <div className="card small">No se pudo abrir la cámara. Permite el acceso en Ajustes → Safari → Cámara, o escribe el número del código abajo.</div>}
      {status === 'searching' && <div className="card center">🔎 Buscando {code} en Open Food Facts…</div>}
      {status === 'notfound' && (
        <div className="card">
          <div className="bold">No encontré el producto {code}</div>
          <div className="muted small" style={{ margin: '4px 0 10px' }}>Créalo una vez (a mano o con foto de la etiqueta) y la próxima vez lo reconocerá al instante.</div>
          <button className="btn" onClick={() => setCreating(true)}><Ico name="edit" />Crear este producto</button>
        </div>
      )}
      {status === 'error' && <div className="card small" style={{ color: 'var(--danger)' }}>{msg}</div>}

      <label className="small muted" style={{ display: 'block', marginTop: 12 }}>O escribe el número</label>
      <div className="row" style={{ marginTop: 6 }}>
        <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="7701234567890" />
        <button className="btn sm" disabled={code.replace(/\D/g, '').length < 6} onClick={() => { stop(); search(code); }}>Buscar</button>
      </div>
      {status !== 'scanning' && <button className="btn secondary" style={{ marginTop: 12 }} onClick={start}><Ico name="camera" />Escanear otro</button>}
      <p className="note">Datos de Open Food Facts (base abierta y colaborativa). Revisa los valores en el empaque.</p>

      {food && (
        <PortionSheet
          food={food}
          meal={mealForHour(new Date().getHours())}
          confirmLabel="Agregar"
          onClose={() => setFood(null)}
          onConfirm={async (r) => {
            await db.entries.add({ date, meal: r.meal, foodId: food.id, name: food.brand ? `${food.name} (${food.brand})` : food.name, qty: r.qty, servingLabel: r.servingLabel, grams: r.grams, ...r.nutr, createdAt: Date.now() });
            toast(`Agregado a ${MEALS.find((m) => m.key === r.meal)!.label.toLowerCase()}`);
            setFood(null);
            onClose();
          }}
        />
      )}
      {creating && (
        <CustomFoodSheet
          fixedId={'off-' + code}
          onClose={() => setCreating(false)}
          onCreated={(f) => { setCreating(false); setFood(f); setStatus('scanning'); }}
        />
      )}
    </Sheet>
  );
}
