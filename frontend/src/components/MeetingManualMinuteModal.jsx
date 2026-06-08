import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  MEETING_LOCATION_OPTIONS,
  meetingPlaceLabelForType,
  addMinutesToTime,
} from '../utils/meetingSchedule';
import BosaGoldButton from './BosaGoldButton';

const BULLET_ROWS = 6;

function emptyBullets(count = BULLET_ROWS) {
  return Array.from({ length: count }, () => '');
}

function bulletsFromRecord(list) {
  const items = Array.isArray(list) ? list.filter(Boolean) : [];
  const rows = [...items];
  while (rows.length < BULLET_ROWS) rows.push('');
  return rows;
}

function cleanBullets(rows) {
  return rows.map((s) => String(s).trim()).filter(Boolean);
}

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim();
}

function sortUsersByName(users) {
  return [...users].sort((a, b) =>
    userFullName(a).localeCompare(userFullName(b), 'es', { sensitivity: 'base' }),
  );
}

function isoToDateInput(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function isoToTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function meetingPlaceLabel(meeting) {
  if (!meeting) return '';
  return meetingPlaceLabelForType(meeting.location_type === 'virtual' ? 'virtual' : 'sala_juntas');
}

function NextMeetingLocationIcon({ type, className = 'h-6 w-6' }) {
  if (type === 'virtual') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
    </svg>
  );
}

function formatDisplayDate(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function buildFormFromMeeting(meeting, dbUsers) {
  const attendees = sortUsersByName(
    (meeting?.attendees || [])
      .map((id) => dbUsers.find((u) => Number(u.id) === Number(id)))
      .filter(Boolean),
  ).map((u) => ({
    nombre: userFullName(u),
    cargo: [u.puesto, u.departamento].filter(Boolean).join(' · ') || '',
    asistencia: 'Presente',
  }));

  return {
    lugar: meetingPlaceLabel(meeting),
    fecha: isoToDateInput(meeting?.start_time),
    hora_inicio: isoToTimeInput(meeting?.start_time),
    hora_cierre: isoToTimeInput(meeting?.end_time),
    tema: meeting?.title || '',
    attendees,
    tema_principal: emptyBullets(),
    desarrollo: emptyBullets(),
    acuerdos: emptyBullets(),
    next_meeting_planned: 'no',
    next_meeting_fecha: '',
    next_meeting_hora: '',
    next_meeting_hora_fin: '',
    next_meeting_location_type: meeting?.location_type === 'virtual' ? 'virtual' : 'sala_juntas',
    next_meeting_lugar: '',
    next_meeting_scheduled_id: null,
  };
}

function buildFormFromMinute(data) {
  return {
    lugar: data.lugar || '',
    fecha: data.fecha || '',
    hora_inicio: data.hora_inicio || '',
    hora_cierre: data.hora_cierre || '',
    tema: data.tema || '',
    attendees: Array.isArray(data.attendees) ? data.attendees : [],
    tema_principal: bulletsFromRecord(data.tema_principal),
    desarrollo: bulletsFromRecord(data.desarrollo),
    acuerdos: bulletsFromRecord(data.acuerdos),
    next_meeting_planned:
      data.next_meeting_planned === 'yes' || String(data.next_meeting_fecha ?? '').trim() ? 'yes' : 'no',
    next_meeting_fecha: data.next_meeting_fecha || '',
    next_meeting_hora: data.next_meeting_hora || '',
    next_meeting_hora_fin: data.next_meeting_hora_fin || '',
    next_meeting_location_type: data.next_meeting_location_type === 'virtual' ? 'virtual' : 'sala_juntas',
    next_meeting_lugar:
      data.next_meeting_lugar
      || meetingPlaceLabelForType(data.next_meeting_location_type === 'virtual' ? 'virtual' : 'sala_juntas'),
    next_meeting_scheduled_id: data.next_meeting_scheduled_id ?? null,
  };
}

function BulletSection({ title, hint, rows, onChange, onAdd }) {
  return (
    <div className="meeting-sheet__group mb-3">
      <div className="meeting-sheet__cell meeting-sheet__cell--field">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="meeting-sheet__cell-label mb-0">{title}</label>
          <button type="button" onClick={onAdd} className="text-[13px] font-semibold text-gold">
            Añadir punto
          </button>
        </div>
        {hint ? <p className="meeting-sheet__hint mb-3">{hint}</p> : null}
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-3 text-slate-400 text-sm shrink-0" aria-hidden>
                –
              </span>
              <input
                className="meeting-sheet__input flex-1"
                value={row}
                onChange={(e) => onChange(idx, e.target.value)}
                placeholder={`Punto ${idx + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MeetingManualMinuteModal({
  open,
  meeting,
  dbUsers = [],
  existingMinute = null,
  onClose,
  onSaved,
  onMeetingScheduled,
}) {
  const [form, setForm] = useState(() => buildFormFromMeeting(meeting, dbUsers));
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [minuteId, setMinuteId] = useState(null);

  const isEdit = Boolean(minuteId);

  useEffect(() => {
    if (!open || !meeting) return;
    if (existingMinute?.id) {
      setMinuteId(existingMinute.id);
      setForm(buildFormFromMinute(existingMinute));
      return;
    }
    setMinuteId(null);
    setForm(buildFormFromMeeting(meeting, dbUsers));
  }, [open, meeting, existingMinute, dbUsers]);

  const attendeeNames = useMemo(
    () => form.attendees.map((a) => a.nombre).filter(Boolean).join(', '),
    [form.attendees],
  );

  const followUpTitle = useMemo(() => {
    const base = (form.tema || meeting?.title || 'Reunión').trim();
    return base.includes('Seguimiento') ? base : `${base} · Seguimiento`;
  }, [form.tema, meeting?.title]);

  const setNextMeetingPlanned = (planned) => {
    if (planned === 'no') {
      setForm((f) => ({
        ...f,
        next_meeting_planned: 'no',
        next_meeting_fecha: '',
        next_meeting_hora: '',
        next_meeting_hora_fin: '',
        next_meeting_lugar: '',
        next_meeting_scheduled_id: null,
      }));
      return;
    }
    const loc = meeting?.location_type === 'virtual' ? 'virtual' : 'sala_juntas';
    setForm((f) => ({
      ...f,
      next_meeting_planned: 'yes',
      next_meeting_location_type: f.next_meeting_location_type || loc,
      next_meeting_lugar: meetingPlaceLabelForType(f.next_meeting_location_type || loc),
    }));
  };

  const setNextLocationType = (locationType) => {
    setForm((f) => ({
      ...f,
      next_meeting_location_type: locationType,
      next_meeting_lugar: meetingPlaceLabelForType(locationType),
      next_meeting_scheduled_id: null,
    }));
  };

  const handleScheduleFollowUp = async () => {
    if (form.next_meeting_planned !== 'yes') return;
    if (!form.next_meeting_fecha || !form.next_meeting_hora) {
      alert('Indica la fecha y hora de inicio de la reunión de seguimiento.');
      return;
    }
    const endTime = form.next_meeting_hora_fin || addMinutesToTime(form.next_meeting_hora, 60);
    if (!endTime || endTime <= form.next_meeting_hora) {
      alert('Indica una hora de fin válida (posterior al inicio).');
      return;
    }

    setScheduling(true);
    try {
      const { data } = await axios.post('/api/meetings', {
        title: followUpTitle,
        description: `Continuación acordada en la minuta del ${formatDisplayDate(form.fecha)}.`,
        start_time: `${form.next_meeting_fecha}T${form.next_meeting_hora}`,
        end_time: `${form.next_meeting_fecha}T${endTime}`,
        attendees: meeting?.attendees || [],
        location_type: form.next_meeting_location_type,
      });
      setForm((f) => ({
        ...f,
        next_meeting_hora_fin: endTime,
        next_meeting_lugar: meetingPlaceLabelForType(f.next_meeting_location_type),
        next_meeting_scheduled_id: data.id,
      }));
      onMeetingScheduled?.();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || e.response?.data?.message || 'No se pudo agendar la reunión.');
    } finally {
      setScheduling(false);
    }
  };

  const setBullets = (field, idx, value) => {
    setForm((f) => {
      const list = [...f[field]];
      list[idx] = value;
      return { ...f, [field]: list };
    });
  };

  const addBullet = (field) => {
    setForm((f) => ({ ...f, [field]: [...f[field], ''] }));
  };

  const handleSave = async () => {
    if (!form.fecha) {
      alert('La fecha de la reunión es obligatoria.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        lugar: form.lugar,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_cierre: form.hora_cierre,
        tema: form.tema,
        attendees: form.attendees,
        meeting_id: meeting?.id,
        tema_principal: cleanBullets(form.tema_principal),
        desarrollo: cleanBullets(form.desarrollo),
        acuerdos: cleanBullets(form.acuerdos),
        next_meeting_planned: form.next_meeting_planned,
        next_meeting_fecha: form.next_meeting_planned === 'yes' ? form.next_meeting_fecha : '',
        next_meeting_hora: form.next_meeting_planned === 'yes' ? form.next_meeting_hora : '',
        next_meeting_hora_fin: form.next_meeting_planned === 'yes' ? form.next_meeting_hora_fin : '',
        next_meeting_lugar: form.next_meeting_planned === 'yes' ? form.next_meeting_lugar : '',
        next_meeting_location_type: form.next_meeting_planned === 'yes' ? form.next_meeting_location_type : 'sala_juntas',
        next_meeting_scheduled_id: form.next_meeting_planned === 'yes' ? form.next_meeting_scheduled_id : null,
        topics: [
          { titulo: 'Tema principal', descripcion: cleanBullets(form.tema_principal).join('\n'), comentarios: '' },
          { titulo: 'Desarrollo', descripcion: cleanBullets(form.desarrollo).join('\n'), comentarios: '' },
          { titulo: 'Acuerdos', descripcion: cleanBullets(form.acuerdos).join('\n'), comentarios: '' },
        ],
      };

      if (isEdit) {
        await axios.put(`/api/minutes/${minuteId}`, payload);
      } else {
        const { data } = await axios.post('/api/minutes', payload);
        setMinuteId(data.id);
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'No se pudo guardar la minuta.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !meeting) return null;

  return createPortal(
    <div className="meeting-sheet-overlay z-[130] animate-fade-in" onClick={onClose} role="presentation">
      <div
        className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up flex min-h-0 flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-minute-title"
      >
        <div className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="meeting-sheet__pill meeting-sheet__pill--gold">Minuta de reunión</span>
              <h3 id="manual-minute-title" className="meeting-sheet__hero-title mt-2">
                {isEdit ? 'Editar minuta' : 'Crear minuta'}
              </h3>
              <p className="meeting-sheet__hero-subtitle">
                {form.tema || meeting.title} · los datos de la reunión se cargan automáticamente
              </p>
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
            <p className="meeting-sheet__section-label">Encabezado</p>
            <div className="meeting-sheet__group">
              <div className="meeting-sheet__cell">
                <p className="meeting-sheet__cell-label">Título</p>
                <input
                  className="meeting-sheet__input font-semibold"
                  value={form.tema}
                  onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                  placeholder="Minuta · nombre del proyecto o reunión"
                />
              </div>
              <div className="meeting-sheet__cell meeting-sheet__cell--readonly-grid">
                <div>
                  <p className="meeting-sheet__cell-label">Fecha</p>
                  <p className="meeting-sheet__cell-value tabular-nums">{formatDisplayDate(form.fecha)}</p>
                </div>
                <div>
                  <p className="meeting-sheet__cell-label">Horario</p>
                  <p className="meeting-sheet__cell-value tabular-nums">
                    {form.hora_inicio || '—'}
                    {form.hora_cierre ? ` – ${form.hora_cierre}` : ''}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="meeting-sheet__cell-label">Lugar</p>
                  <p className="meeting-sheet__cell-value">{form.lugar || '—'}</p>
                </div>
              </div>
              <div className="meeting-sheet__cell">
                <p className="meeting-sheet__cell-label">Asistentes</p>
                <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body">
                  {attendeeNames || 'Sin participantes registrados en la reunión'}
                </p>
              </div>
            </div>

            <BulletSection
              title="Tema principal"
              hint="Objetivos o temas centrales de la reunión."
              rows={form.tema_principal}
              onChange={(idx, value) => setBullets('tema_principal', idx, value)}
              onAdd={() => addBullet('tema_principal')}
            />

            <BulletSection
              title="Desarrollo de la reunión"
              hint="Resumen de lo tratado, acuerdos parciales y comentarios clave."
              rows={form.desarrollo}
              onChange={(idx, value) => setBullets('desarrollo', idx, value)}
              onAdd={() => addBullet('desarrollo')}
            />

            <BulletSection
              title="Acuerdos"
              hint="Compromisos, responsables y fechas acordadas."
              rows={form.acuerdos}
              onChange={(idx, value) => setBullets('acuerdos', idx, value)}
              onAdd={() => addBullet('acuerdos')}
            />

            <p className="meeting-sheet__section-label">Próxima reunión</p>
            <p className="meeting-sheet__cell-note px-4 mb-2">
              Indica si habrá reunión de seguimiento. Los participantes y el título se toman de esta junta.
            </p>
            <div className="meeting-sheet__group" role="radiogroup" aria-label="Reunión de seguimiento">
              {[
                { value: 'no', label: 'No hay reunión de seguimiento' },
                { value: 'yes', label: 'Sí, agendar continuación' },
              ].map((opt) => {
                const selected = form.next_meeting_planned === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNextMeetingPlanned(opt.value)}
                    className={`meeting-sheet__radio-row${selected ? ' meeting-sheet__radio-row--selected' : ''}`}
                  >
                    <span className="meeting-sheet__modality-text">
                      <span className="meeting-sheet__modality-label">{opt.label}</span>
                    </span>
                    <span className="meeting-sheet__modality-check" aria-hidden>
                      {selected ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {form.next_meeting_planned === 'yes' && (
              <>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Título de seguimiento</p>
                    <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body">{followUpTitle}</p>
                  </div>
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Participantes</p>
                    <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body">
                      {attendeeNames || 'Los mismos de esta reunión'}
                    </p>
                  </div>
                </div>

                <p className="meeting-sheet__section-label">Modalidad</p>
                <div className="meeting-sheet__group" role="radiogroup" aria-label="Modalidad de seguimiento">
                  {MEETING_LOCATION_OPTIONS.map((opt) => {
                    const selected = form.next_meeting_location_type === opt.value;
                    const isVirtual = opt.value === 'virtual';
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setNextLocationType(opt.value)}
                        className={`meeting-sheet__radio-row${selected ? ' meeting-sheet__radio-row--selected' : ''}`}
                      >
                        <span
                          className={`meeting-sheet__modality-icon${isVirtual ? ' meeting-sheet__modality-icon--virtual' : ''}`}
                          aria-hidden
                        >
                          <NextMeetingLocationIcon type={opt.value} />
                        </span>
                        <span className="meeting-sheet__modality-text">
                          <span className="meeting-sheet__modality-label">{opt.label}</span>
                        </span>
                        <span className="meeting-sheet__modality-check" aria-hidden>
                          {selected ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="meeting-sheet__section-label">Horario de seguimiento</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Fecha</label>
                    <input
                      type="date"
                      className="meeting-sheet__input tabular-nums"
                      value={form.next_meeting_fecha}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          next_meeting_fecha: e.target.value,
                          next_meeting_scheduled_id: null,
                        }))
                      }
                    />
                  </div>
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Hora inicio</label>
                    <input
                      type="time"
                      className="meeting-sheet__input tabular-nums"
                      value={form.next_meeting_hora}
                      onChange={(e) => {
                        const hora = e.target.value;
                        setForm((f) => ({
                          ...f,
                          next_meeting_hora: hora,
                          next_meeting_hora_fin: hora ? addMinutesToTime(hora, 60) : '',
                          next_meeting_scheduled_id: null,
                        }));
                      }}
                    />
                  </div>
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Hora fin</label>
                    <input
                      type="time"
                      className="meeting-sheet__input tabular-nums"
                      value={form.next_meeting_hora_fin}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          next_meeting_hora_fin: e.target.value,
                          next_meeting_scheduled_id: null,
                        }))
                      }
                    />
                  </div>
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Lugar</p>
                    <p className="meeting-sheet__cell-value">
                      {meetingPlaceLabelForType(form.next_meeting_location_type)}
                    </p>
                  </div>
                </div>

                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    {form.next_meeting_scheduled_id ? (
                      <p className="meeting-sheet__hint meeting-sheet__hint--info mb-3">
                        Reunión de seguimiento agendada en el calendario (#{form.next_meeting_scheduled_id}).
                        Si cambias fecha u horario aquí, vuelve a agendar.
                      </p>
                    ) : (
                      <p className="meeting-sheet__cell-note mb-3">
                        Al agendar, se crea la reunión en el calendario con los mismos participantes.
                        Si la eliminaste del calendario, puedes volver a agendarla aquí.
                      </p>
                    )}
                    <BosaGoldButton
                      icon="schedule"
                      onClick={handleScheduleFollowUp}
                      disabled={scheduling || saving}
                      className="w-full !flex-none"
                    >
                      {scheduling
                        ? 'Agendando…'
                        : form.next_meeting_scheduled_id
                          ? 'Volver a agendar'
                          : 'Agendar en calendario'}
                    </BosaGoldButton>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="meeting-sheet__footer shrink-0">
            <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="voice-minute-footer__btn voice-minute-footer__btn--secondary disabled:opacity-50"
              >
                <svg
                  className="voice-minute-footer__icon voice-minute-footer__icon--close"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className="voice-minute-footer__icon voice-minute-footer__icon--save"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                  <path d="M15 4v3h3" />
                  <path d="M9 14l2 2 4-4.5" />
                </svg>
                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar minuta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
