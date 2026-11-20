// Recordatorios fiables en iPhone: un archivo de calendario (.ics) con eventos
// diarios y alerta. iOS lo importa en Calendario y avisa aunque la app esté cerrada.

export interface DailyReminder { title: string; time: string; minutes?: number; note?: string; date?: Date; once?: boolean }

const pad = (n: number) => String(n).padStart(2, '0');

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildICS(reminders: DailyReminder[], startDate: Date = new Date()): string {
  const y = startDate.getFullYear();
  const m = pad(startDate.getMonth() + 1);
  const d = pad(startDate.getDate());
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Not Stop//Recordatorios//ES', 'CALSCALE:GREGORIAN'];
  reminders.forEach((r, i) => {
    const [hh, mm] = r.time.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
    const dur = r.minutes ?? 15;
    const day = r.date ?? startDate;
    const ymd = `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:notstop-${i}-${hh}${mm}-${y}${m}${d}@notstop.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${pad(hh)}${pad(mm)}00`,
      `DURATION:PT${dur}M`,
      ...(r.once ? [] : ['RRULE:FREQ=DAILY']),
      `SUMMARY:${esc(r.title)}`,
      ...(r.note ? [`DESCRIPTION:${esc(r.note)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
