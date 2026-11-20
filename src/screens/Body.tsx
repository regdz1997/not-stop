import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dataURLToBlob, db, type Measurement, type Photo } from '../db';
import { useApp } from '../ctx';
import { isoDate } from '../lib/calc';
import { bodyFatCategory, navyBodyFat } from '../lib/insights';
import { fileToImage } from '../lib/ai';
import { Empty, fmtDate, fmtNum, haptic, Sheet, toast, Ico } from '../components/ui';
import { LineChart } from '../components/Charts';

const FIELDS: { k: keyof Measurement; label: string }[] = [
  { k: 'waist', label: 'Cintura' },
  { k: 'neck', label: 'Cuello' },
  { k: 'hip', label: 'Cadera' },
  { k: 'chest', label: 'Pecho' },
  { k: 'arm', label: 'Brazo' },
  { k: 'thigh', label: 'Muslo' },
];

export function MeasureSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const last = useLiveQuery(() => db.measurements.orderBy('date').last(), []);
  const [date, setDate] = useState(isoDate());
  const [v, setV] = useState<Record<string, string>>({});
  const n = (k: string) => {
    const x = parseFloat((v[k] ?? '').replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const bf = navyBodyFat(profile.sex, profile.heightCm, n('waist') ?? 0, n('neck') ?? 0, n('hip'));
  const any = FIELDS.some((f) => n(f.k));

  const save = async () => {
    const m: Measurement = { date, bodyFat: bf ?? undefined };
    for (const f of FIELDS) {
      const x = n(f.k);
      if (x) (m as unknown as Record<string, number>)[f.k] = x;
    }
    const existing = await db.measurements.where('date').equals(date).first();
    if (existing?.id) await db.measurements.update(existing.id, m);
    else await db.measurements.add(m);
    haptic();
    toast('📏 Medidas guardadas');
    onClose();
  };

  return (
    <Sheet title="Medidas corporales" onClose={onClose}>
      <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.k}>
            <label className="small muted">{f.label} (cm){(f.k === 'waist' || f.k === 'neck' || (f.k === 'hip' && profile.sex === 'm')) ? ' *' : ''}</label>
            <input inputMode="decimal" value={v[f.k] ?? ''} placeholder={last?.[f.k] ? String(last[f.k]) : ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} style={{ marginTop: 4 }} />
          </div>
        ))}
      </div>
      <div className="card center" style={{ marginTop: 12 }}>
        <div className="muted small">Grasa corporal estimada (método Marina EE. UU.)</div>
        <div className="big num" style={{ color: bf ? 'var(--accent)' : 'var(--muted)' }}>{bf ? `${fmtNum(bf, 1)} %` : '—'}</div>
        <div className="small muted">{bf ? bodyFatCategory(profile.sex, bf) : `Necesita cintura y cuello${profile.sex === 'm' ? ' y cadera' : ''} (* ) y tu estatura del perfil.`}</div>
      </div>
      <button className="btn" disabled={!any} onClick={save}>Guardar</button>
      <p className="note">Mide la cintura a la altura del ombligo y el cuello bajo la nuez, relajado. Estimación con un margen de ±3–4 %.</p>
    </Sheet>
  );
}

export function BodyTab() {
  const { profile } = useApp();
  const ms = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [], []);
  const [open, setOpen] = useState(false);
  const first = ms[0];
  const last = ms[ms.length - 1];
  const bfPts = ms.filter((m) => m.bodyFat).map((m) => ({ label: fmtDate(m.date, { day: 'numeric', month: 'short' }), v: m.bodyFat! }));
  const lean = last?.bodyFat ? profile.weightKg * (1 - last.bodyFat / 100) : null;

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} style={{ marginBottom: 12 }}><Ico name="ruler" />Registrar medidas</button>
      {ms.length === 0 ? (
        <Empty icon="📏" title="Sin medidas todavía" text="Con cintura y cuello calculamos tu % de grasa automáticamente." />
      ) : (
        <>
          {last?.bodyFat && (
            <div className="card row" style={{ justifyContent: 'space-around' }}>
              <div className="kpi"><b className="num" style={{ color: 'var(--accent)' }}>{fmtNum(last.bodyFat, 1)} %</b><span>Grasa · {bodyFatCategory(profile.sex, last.bodyFat)}</span></div>
              <div className="kpi"><b className="num">{lean ? fmtNum(lean, 1) : '–'} kg</b><span>Masa magra</span></div>
              <div className="kpi"><b className="num">{lean ? fmtNum(profile.weightKg - lean, 1) : '–'} kg</b><span>Masa grasa</span></div>
            </div>
          )}
          {bfPts.length > 1 && (
            <div className="card"><h3>% de grasa</h3><LineChart points={bfPts} trend={bfPts.map((p) => p.v)} unit=" %" /></div>
          )}
          <div className="list">
            {FIELDS.map((f) => {
              const lv = last?.[f.k] as number | undefined;
              const fv = ms.find((m) => m[f.k])?.[f.k] as number | undefined;
              if (!lv) return null;
              const d = fv !== undefined && first !== last ? lv - fv : 0;
              return (
                <div className="item" key={f.k}>
                  <div className="grow">{f.label}</div>
                  <b className="num">{fmtNum(lv, 1)} cm</b>
                  <span className="small num" style={{ width: 70, textAlign: 'right', color: d < 0 ? 'var(--ok)' : d > 0 ? 'var(--carb)' : 'var(--muted)' }}>{d ? `${d > 0 ? '+' : ''}${fmtNum(d, 1)}` : '—'}</span>
                </div>
              );
            })}
          </div>
          <div className="section-title">Historial</div>
          <div className="list">
            {[...ms].reverse().map((m) => (
              <div className="item small" key={m.id}>
                <div className="grow">{fmtDate(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}<div className="tiny muted">{FIELDS.filter((f) => m[f.k]).map((f) => `${f.label} ${m[f.k]}`).join(' · ')}</div></div>
                {m.bodyFat && <b className="num">{fmtNum(m.bodyFat, 1)} %</b>}
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Borrar" onClick={async () => { if (confirm('¿Borrar estas medidas?')) await db.measurements.delete(m.id!); }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
      {open && <MeasureSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function usePhotoURLs(photos: Photo[]) {
  const urls = useMemo(() => new Map(photos.map((p) => [p.id!, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function PhotosTab() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), [], []);
  const urls = usePhotoURLs(photos);
  const [pose, setPose] = useState('Frente');
  const [compare, setCompare] = useState(false);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [split, setSplit] = useState(50);
  const [view, setView] = useState<Photo | null>(null);

  const add = async (file: File) => {
    const img = await fileToImage(file, 1600);
    await db.photos.add({ date: isoDate(), blob: dataURLToBlob(img.dataUrl), pose });
    haptic();
    toast('📸 Foto guardada solo en este teléfono');
  };

  const pa = photos.find((p) => p.id === (a ?? photos[0]?.id));
  const pb = photos.find((p) => p.id === (b ?? photos[photos.length - 1]?.id));

  return (
    <>
      <div className="chips" style={{ marginBottom: 10 }}>
        {['Frente', 'Perfil', 'Espalda'].map((p) => <button key={p} className={'chip' + (pose === p ? ' on' : '')} onClick={() => setPose(p)}>{p}</button>)}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="btn">
          📸 Agregar foto ({pose})
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) add(f); }} />
        </label>
        <button className="btn secondary" disabled={photos.length < 2} onClick={() => setCompare(true)}>↔️ Comparar</button>
      </div>
      {photos.length === 0 ? (
        <Empty icon="📸" title="Sin fotos" text="Se guardan solo en tu teléfono (y en tu copia de seguridad)." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[...photos].reverse().map((p) => (
            <button key={p.id} onClick={() => setView(p)} style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
              <img src={urls.get(p.id!)} alt={`Foto ${p.date}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span className="tiny" style={{ position: 'absolute', left: 4, bottom: 4, background: 'rgba(0,0,0,.6)', padding: '2px 6px', borderRadius: 6 }}>{fmtDate(p.date, { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
        </div>
      )}

      {view && (
        <Sheet title={`${view.pose ?? ''} · ${fmtDate(view.date, { day: 'numeric', month: 'long', year: 'numeric' })}`} onClose={() => setView(null)}>
          <img src={urls.get(view.id!)} alt="" style={{ width: '100%', borderRadius: 14 }} />
          <button className="btn danger" style={{ marginTop: 12 }} onClick={async () => { if (confirm('¿Borrar esta foto?')) { await db.photos.delete(view.id!); setView(null); } }}>Borrar foto</button>
        </Sheet>
      )}

      {compare && pa && pb && (
        <Sheet full title="Antes y después" onClose={() => setCompare(false)}>
          <div style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
            <img src={urls.get(pb.id!)} alt="Después" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - split}% 0 0)` }}>
              <img src={urls.get(pa.id!)} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${split}%`, width: 3, background: '#fff', transform: 'translateX(-1px)' }} />
            <span className="tiny" style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,.6)', padding: '3px 8px', borderRadius: 6 }}>Antes · {fmtDate(pa.date, { day: 'numeric', month: 'short' })}</span>
            <span className="tiny" style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(0,0,0,.6)', padding: '3px 8px', borderRadius: 6 }}>Después · {fmtDate(pb.date, { day: 'numeric', month: 'short' })}</span>
          </div>
          <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} style={{ padding: 0, background: 'none', border: 0, accentColor: 'var(--accent)', marginTop: 12 }} aria-label="Deslizar comparación" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {(['Antes', 'Después'] as const).map((lbl, i) => (
              <div key={lbl}>
                <label className="small muted">{lbl}</label>
                <select value={(i === 0 ? pa : pb).id} onChange={(e) => (i === 0 ? setA : setB)(Number(e.target.value))} style={{ marginTop: 4 }}>
                  {photos.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.date, { day: 'numeric', month: 'short', year: '2-digit' })} · {p.pose}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
