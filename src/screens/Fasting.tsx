import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Fast } from '../db';
import { isoDate } from '../lib/calc';
import { FAST_PROTOCOLS, fastPhase, fastStreak } from '../lib/insights';
import { buildICS } from '../lib/ics';
import { download, Empty, fmtDate, fmtNum, haptic, Ring, Sheet, toast, Ico } from '../components/ui';

const fmtHM = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const hhmm = (t: number) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const localInput = (t: number) => {
  const d = new Date(t - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function useActiveFast() {
  return useLiveQuery(() => db.fasts.filter((f) => !f.end).first(), []);
}

export function FastMini({ onOpen }: { onOpen: () => void }) {
  const active = useActiveFast();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  const el = now - active.start;
  const pct = Math.min(1, el / (active.targetH * 3600000));
  return (
    <button className="card row tap live-banner" style={{ width: '100%', textAlign: 'left' }} onClick={onOpen}>
      <span className="emoji">⏳</span>
      <div className="grow">
        <div className="bold">Ayuno {active.protocol} · {fastPhase(el / 3600000).name}</div>
        <div className="small muted num">{fmtHM(el)} de {active.targetH} h · {Math.round(pct * 100)} %</div>
      </div>
      <span style={{ color: 'var(--accent)' }}>›</span>
    </button>
  );
}

export default function Fasting({ onClose }: { onClose: () => void }) {
  const active = useActiveFast();
  const history = useLiveQuery(() => db.fasts.orderBy('start').reverse().filter((f) => !!f.end).limit(30).toArray(), [], []);
  const all = useLiveQuery(() => db.fasts.toArray(), [], []);
  const [proto, setProto] = useState('16:8');
  const [customH, setCustomH] = useState('16');
  const [startAt, setStartAt] = useState(localInput(Date.now()));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const targetH = proto === 'custom' ? Math.min(72, Math.max(1, parseFloat(customH) || 16)) : FAST_PROTOCOLS.find((p) => p.id === proto)!.h;
  const streak = fastStreak(all, isoDate());

  const start = async () => {
    const t = new Date(startAt).getTime();
    const startMs = Number.isFinite(t) && t <= Date.now() ? t : Date.now();
    await db.fasts.add({ start: startMs, targetH, protocol: proto === 'custom' ? `${targetH} h` : proto });
    haptic();
    toast('⏳ Ayuno iniciado');
  };
  const finish = async (f: Fast) => {
    await db.fasts.update(f.id!, { end: Date.now() });
    const h = (Date.now() - f.start) / 3600000;
    haptic();
    toast(h >= f.targetH * 0.95 ? `🎉 ¡Ayuno completado! ${fmtNum(h, 1)} h` : `Ayuno terminado: ${fmtNum(h, 1)} h`);
  };
  const calendar = (f: Fast) => {
    const end = new Date(f.start + f.targetH * 3600000);
    const time = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    download('fin-de-ayuno.ics', buildICS([{ title: '⏳ Fin de tu ayuno – Not Stop', time, date: end, once: true, minutes: 5 }]), 'text/calendar');
  };

  const el = active ? now - active.start : 0;
  const phase = fastPhase(el / 3600000);

  return (
    <Sheet full title="Ayuno intermitente" onClose={onClose}>
      {active ? (
        <>
          <div className="card center">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Ring value={el} max={active.targetH * 3600000} size={220} stroke={16}>
                <div>
                  <div className="muted small">{el >= active.targetH * 3600000 ? '¡Meta cumplida!' : 'Transcurrido'}</div>
                  <div className="big num">{fmtHM(el)}</div>
                  <div className="muted small">meta {active.targetH} h</div>
                </div>
              </Ring>
            </div>
            <div className="bold" style={{ marginTop: 12 }}>{phase.name}</div>
            <div className="small muted">{phase.desc}</div>
            <div className="row" style={{ justifyContent: 'space-around', marginTop: 14 }}>
              <div className="kpi"><b className="num">{hhmm(active.start)}</b><span>Inicio</span></div>
              <div className="kpi"><b className="num">{hhmm(active.start + active.targetH * 3600000)}</b><span>Fin</span></div>
              <div className="kpi"><b className="num">{fmtHM(Math.max(0, active.start + active.targetH * 3600000 - now))}</b><span>Falta</span></div>
            </div>
          </div>
          <button className="btn" onClick={() => finish(active)}>Terminar ayuno</button>
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => calendar(active)}><Ico name="bell" />Avisarme al terminar (Calendario)</button>
          <button className="btn ghost" onClick={async () => { if (confirm('¿Cancelar este ayuno sin guardarlo?')) await db.fasts.delete(active.id!); }}>Cancelar ayuno</button>
        </>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>Protocolo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FAST_PROTOCOLS.map((p) => (
              <button key={p.id} className={'opt' + (proto === p.id ? ' on' : '')} style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => setProto(p.id)}>
                <b style={{ fontSize: 20 }}>{p.id}</b>
                <span className="tiny muted">{p.desc}</span>
              </button>
            ))}
            <button className={'opt' + (proto === 'custom' ? ' on' : '')} style={{ margin: 0, gridColumn: 'span 2' }} onClick={() => setProto('custom')}>
              <b>Personalizado</b>
              {proto === 'custom' && <input inputMode="decimal" value={customH} onChange={(e) => setCustomH(e.target.value)} style={{ width: 80, marginLeft: 'auto', textAlign: 'center' }} onClick={(e) => e.stopPropagation()} />}
              {proto === 'custom' && <span className="small muted">horas</span>}
            </button>
          </div>
          <label className="small muted" style={{ display: 'block', marginTop: 14 }}>Empezó (puedes indicar tu última comida)</label>
          <input type="datetime-local" value={startAt} max={localInput(Date.now())} onChange={(e) => setStartAt(e.target.value)} style={{ marginTop: 6 }} />
          <button className="btn" style={{ marginTop: 14 }} onClick={start}>Empezar ayuno de {fmtNum(targetH, 1)} h</button>
        </>
      )}

      <div className="card row" style={{ justifyContent: 'space-around', marginTop: 16 }}>
        <div className="kpi"><b className="num">🔥 {streak}</b><span>días de racha</span></div>
        <div className="kpi"><b className="num">{history.length}</b><span>ayunos</span></div>
        <div className="kpi"><b className="num">{history.length ? fmtNum(history.reduce((a, f) => a + (f.end! - f.start) / 3600000, 0) / history.length, 1) : '–'}</b><span>h promedio</span></div>
      </div>
      <div className="section-title">Historial</div>
      {history.length === 0 ? (
        <Empty icon="⏳" title="Sin ayunos todavía" />
      ) : (
        <div className="list">
          {history.map((f) => {
            const h = (f.end! - f.start) / 3600000;
            const ok = h >= f.targetH * 0.95;
            return (
              <div className="item" key={f.id}>
                <span className="emoji">{ok ? '✅' : '⏹️'}</span>
                <div className="grow">
                  <div className="bold num">{fmtNum(h, 1)} h <span className="muted small">/ {f.targetH} h</span></div>
                  <div className="muted small">{fmtDate(isoDate(new Date(f.start)), { weekday: 'short', day: 'numeric', month: 'short' })} · {hhmm(f.start)} → {hhmm(f.end!)}</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Borrar" onClick={async () => { if (confirm('¿Borrar este ayuno?')) await db.fasts.delete(f.id!); }}>×</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">Las fases son orientativas. Si tienes diabetes, estás embarazada o tomas medicación, consulta a un profesional antes de ayunar.</p>
    </Sheet>
  );
}
