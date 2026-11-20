import React, { useEffect, useId, useState, type ReactNode } from 'react';

/** Respuesta táctil. iOS Safari no tiene navigator.vibrate; desde iOS 18
 *  un <input switch> produce un toque háptico al cambiar, así que lo usamos. */
let hapticEl: HTMLLabelElement | null = null;
export function haptic() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(10);
      return;
    }
    if (!hapticEl) {
      hapticEl = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      hapticEl.appendChild(input);
      hapticEl.style.display = 'none';
      document.body.appendChild(hapticEl);
    }
    hapticEl.click();
  } catch {
    /* sin háptica */
  }
}

// ---------- Toast ----------
let toastSet: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSet?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div className="toast">{msg}</div> : null;
}

// ---------- Hoja modal ----------
export function Sheet({ title, onClose, children, full, right }: { title?: ReactNode; onClose: () => void; children: ReactNode; full?: boolean; right?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <>
      {!full && <div className="backdrop" onClick={onClose} />}
      <div className={'sheet' + (full ? ' full' : '')} role="dialog">
        {!full && <div className="grabber" />}
        <div className="sheet-head">
          {full ? (
            <button className="btn ghost sm" onClick={onClose} style={{ paddingLeft: 0, gap: 2 }}>
              <Ico name="back" size={22} /> Volver
            </button>
          ) : (
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, background: 'var(--s2)' }}>
              <Ico name="close" size={16} stroke={2.2} />
            </button>
          )}
          <h2 className="grow center ellipsis">{title}</h2>
          <div style={{ minWidth: full ? 76 : 32, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

// ---------- Anillo ----------
export function Ring({ value, max, size = 168, stroke = 14, color, gradient, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; gradient?: boolean; children?: ReactNode }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max * 1.02;
  const strokeCol = over ? 'var(--danger)' : gradient || !color ? `url(#g${id})` : color;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }} aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4d8dff" />
            <stop offset="100%" stopColor="#8a6bff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={strokeCol} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={pct > 0 && (gradient || !color) && !over ? { filter: `drop-shadow(0 0 ${Math.round(stroke * 0.6)}px rgba(77,141,255,0.35))` } : undefined} />
      </svg>
      <div className="inner">{children}</div>
    </div>
  );
}

export function MacroRings({ p, c, f, tp, tc, tf }: { p: number; c: number; f: number; tp: number; tc: number; tf: number }) {
  const items = [
    { l: 'Proteína', v: p, t: tp, col: 'var(--prot)' },
    { l: 'Carbos', v: c, t: tc, col: 'var(--carb)' },
    { l: 'Grasa', v: f, t: tf, col: 'var(--fat)' },
  ];
  return (
    <div className="macro-rings">
      {items.map((m) => {
        const left = Math.round(m.t - m.v);
        return (
          <div className="macro-ring" key={m.l}>
            <Ring value={m.v} max={m.t} size={62} stroke={6} color={m.col}>
              <b className="num" style={{ fontSize: 15 }}>{Math.round(m.v)}</b>
            </Ring>
            <span className="lbl">{m.l}</span>
            <span className="left">{left >= 0 ? `quedan ${left} g` : `+${-left} g`}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Burbuja de color con el emoji del alimento. */
export function FoodBubble({ emoji, hue, size }: { emoji: string; hue: string; size?: 'lg' }) {
  return <span className={'bubble' + (size ? ' ' + size : '')} style={{ ['--hue' as string]: hue }} aria-hidden="true">{emoji}</span>;
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar">
      <i style={{ width: pct + '%', background: value > max * 1.05 ? 'var(--danger)' : color }} />
    </div>
  );
}

export function MacroBars({ p, c, f, tp, tc, tf }: { p: number; c: number; f: number; tp: number; tc: number; tf: number }) {
  const items = [
    { l: 'Proteína', v: p, t: tp, col: 'var(--prot)' },
    { l: 'Carbohidratos', v: c, t: tc, col: 'var(--carb)' },
    { l: 'Grasa', v: f, t: tf, col: 'var(--fat)' },
  ];
  return (
    <div className="macros">
      {items.map((m) => (
        <div className="macro" key={m.l}>
          <div className="label">{m.l}</div>
          <Bar value={m.v} max={m.t} color={m.col} />
          <div className="val num">
            <b>{Math.round(m.v)}</b>
            <span className="muted"> / {m.t} g</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Íconos (trazo fino, 24×24) ----------
const P: Record<string, string> = {
  diary: 'M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5zM9 8h6M9 12h6M9 16h3',
  plan: 'M4 11h16M6 11c0 4.4 2.7 8 6 8s6-3.6 6-8M9 7.5c0-1.5 1-2 1-3.5M13 7.5c0-1.5 1-2 1-3.5',
  plus: 'M12 5v14M5 12h14',
  train: 'M3 10v4M6.5 7v10M17.5 7v10M21 10v4M6.5 12h11',
  progress: 'M4 19V5M4 19h16M8 15l3.5-4 3 2.5L20 7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.6-3.6 4.4-5.5 7.5-5.5s5.9 1.9 7.5 5.5',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 9.5h8M8 12.5h5',
  barcode: 'M4 6v12M7 6v12M10 6v12M14 6v12M16.5 6v12M20 6v12',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  water: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z',
  scale: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9a4.5 4.5 0 0 1 7 0M12 9l1.5-2',
  ruler: 'M4 15.5 15.5 4l4.5 4.5L8.5 20zM8 12l1.5 1.5M10.5 9.5 12 11M13 7l1.5 1.5',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9.5 2.5h5',
  dumbbell: 'M3 10v4M6.5 7v10M17.5 7v10M21 10v4M6.5 12h11',
  run: 'M14 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 21l3.5-5.5 3 2.5V22M13 8l-3 1.5-2 3.5M13 8l2 4 4 1M10.5 14.5 12 10',
  compare: 'M7 4v16M17 4v16M3 8h8M13 16h8M5 12l2-4 2 4M15 20l2-4 2 4',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
  cart: 'M3 4h2l2.4 11h11L21 8H6.2M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19',
  bot: 'M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 4v4M9 13h.01M15 13h.01M10 16.5h4',
  flame: 'M12 21c3.9 0 7-2.9 7-6.8 0-3.6-2.6-6-4.3-8.2-.4 2-1.4 3.4-2.7 4C12 7.5 10.6 5 8.5 3.5 8.7 7 5 9.5 5 14.2 5 18.1 8.1 21 12 21z',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z',
  trash: 'M5 7h14M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  photo: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01',
  chart: 'M5 20V11M10 20V5M15 20v-7M20 20V9',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  download: 'M12 4v12M8 12l4 4 4-4M5 20h14',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  pdf: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  steps: 'M8 13c-1.7 0-3-1.8-3-4.5S6 3 8 3s3 2.8 3 5.5S9.7 13 8 13zM6 16.5a2 2 0 0 0 4 0M16 21c-1.7 0-3-1.8-3-4.5S14 11 16 11s3 2.8 3 5.5-1.3 4.5-3 4.5zM14 8a2 2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.1z',
  bolt: 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12z',
};
export type IconName = keyof typeof P;
export function Ico({ name, size = 22, stroke = 1.8, style }: { name: IconName; size?: number; stroke?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
/** Compatibilidad con el código anterior. */
export const Icon = {
  diary: () => <Ico name="diary" />,
  plan: () => <Ico name="plan" />,
  plus: () => <Ico name="plus" stroke={2.4} />,
  train: () => <Ico name="train" />,
  progress: () => <Ico name="progress" />,
  user: () => <Ico name="user" size={20} />,
};

/** Burbuja con ícono de interfaz (no de comida). */
export function IconBubble({ name, hue, size }: { name: IconName; hue: string; size?: 'lg' }) {
  return <span className={'bubble' + (size ? ' ' + size : '')} style={{ ['--hue' as string]: hue }} aria-hidden="true"><Ico name={name} /></span>;
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="center" style={{ padding: '30px 16px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--s2)', display: 'grid', placeItems: 'center', fontSize: 30, margin: '0 auto' }}>{icon}</div>
      <div className="bold" style={{ marginTop: 12, fontSize: 17 }}>{title}</div>
      {text && <div className="muted small" style={{ marginTop: 4, maxWidth: 300, marginInline: 'auto' }}>{text}</div>}
    </div>
  );
}

export function NumberField({ value, onChange, step = 1, min = 0, max = 9999, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const set = (v: number) => {
    const n = Math.min(max, Math.max(min, Math.round(v * 100) / 100));
    onChange(n);
  };
  return (
    <>
      <div className="stepper">
        <button className="tap" onClick={() => { haptic(); set(value - step); }}>−</button>
        <input
          className="num"
          inputMode="decimal"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = parseFloat(e.target.value.replace(',', '.'));
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <button className="tap" onClick={() => { haptic(); set(value + step); }}>+</button>
      </div>
      {suffix && <div className="unit-label">{suffix}</div>}
    </>
  );
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString('es', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fmtNum = (n: number, dec = 0) => n.toLocaleString('es', { maximumFractionDigits: dec, minimumFractionDigits: 0 });

export function download(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
