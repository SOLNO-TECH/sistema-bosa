import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import MeetingMinuteAudioPlayer from './MeetingMinuteAudioPlayer';
import SayaProLock from './SayaProLock';
import SayaBrandMark from './voice/SayaBrandMark';
import {
  MinutaProLockedBlocks,
  ProAgreementsActionsPlaceholder,
  ProExecutiveSummaryPlaceholder,
  ProStatsPlaceholder,
  ProTopicsPlaceholder,
} from './MinutaProSections';

function formatDisplayDate(iso) {
  if (!iso) return '—';
  try {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function BulletBlock({ items, empty = 'Sin elementos detectados.' }) {
  if (!items?.length) {
    return <p className="voice-minute-empty">{empty}</p>;
  }
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="voice-minute-list-num">
          <span className="voice-minute-list-num__badge">{idx + 1}</span>
          <span>{typeof item === 'string' ? item : item.text}</span>
        </li>
      ))}
    </ol>
  );
}

function MinutePreview({
  form,
  brief,
  transcript,
  transcriptSegments,
  audioUrl,
  audioBlob = null,
  minuteId = null,
  showRecordingSection = false,
}) {
  const filledAttendees = (form.attendees || []).filter((a) => (a.nombre || '').trim());

  return (
    <div className="voice-minute-preview">
      <SayaProLock
        compact
        className="saya-pro-lock--stats"
        title="Métricas de la reunión"
        subtitle="Palabras, acuerdos, compromisos y voces."
      >
        <ProStatsPlaceholder />
      </SayaProLock>

      <div className="voice-minute-card">
        <div className="voice-minute-card__hero">
          <p className="voice-minute-card__eyebrow">Minuta de reunión</p>
          <h3 className="voice-minute-card__title">{form.tema || 'Sin tema'}</h3>
          <p className="voice-minute-card__meta">
            {formatDisplayDate(form.fecha)}
            {form.hora_inicio ? ` · ${form.hora_inicio}` : ''}
            {form.hora_cierre ? ` – ${form.hora_cierre}` : ''}
            {form.lugar ? ` · ${form.lugar}` : ''}
          </p>
        </div>

        <div className="voice-minute-card__grid">
          <div>
            <p className="voice-minute-card__field-label">Lugar</p>
            <p className="voice-minute-card__field-value">{form.lugar || '—'}</p>
          </div>
          <div>
            <p className="voice-minute-card__field-label">Fecha</p>
            <p className="voice-minute-card__field-value">{formatDisplayDate(form.fecha)}</p>
          </div>
          <div>
            <p className="voice-minute-card__field-label">Inicio</p>
            <p className="voice-minute-card__field-value">{form.hora_inicio || '—'}</p>
          </div>
          <div>
            <p className="voice-minute-card__field-label">Cierre</p>
            <p className="voice-minute-card__field-value">{form.hora_cierre || '—'}</p>
          </div>
        </div>

        {filledAttendees.length > 0 && (
          <div className="voice-minute-card__block">
            <p className="meeting-sheet__section-label mt-0 mb-2">Asistentes</p>
            <div className="meeting-sheet__group overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#071221] text-white">
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide">Nombre</th>
                    <th className="hidden px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide sm:table-cell">Cargo</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide">Asist.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filledAttendees.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{row.nombre}</td>
                      <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">{row.cargo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{row.asistencia || 'Presente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SayaProLock title="Resumen ejecutivo" subtitle="Síntesis automática de lo conversado en la reunión.">
        <ProExecutiveSummaryPlaceholder />
      </SayaProLock>

      <SayaProLock title="Acuerdos y compromisos" subtitle="Acuerdos y pendientes con seguimiento sugerido.">
        <ProAgreementsActionsPlaceholder />
      </SayaProLock>

      {brief?.key_points?.length > 0 && (
        <section className="voice-minute-section">
          <h4 className="voice-minute-section__title mb-3">Puntos tratados</h4>
          <BulletBlock items={brief.key_points} />
        </section>
      )}

      {brief?.interventions?.length > 1 && (
        <section className="voice-minute-section">
          <h4 className="voice-minute-section__title mb-3">Intervenciones por participante</h4>
          <div className="space-y-3">
            {brief.interventions.map((seg, idx) => (
              <div key={idx} className="voice-minute-intervention">
                <div className="voice-minute-intervention__avatar">
                  {(seg.speaker || '?')
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">{seg.speaker}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{seg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <SayaProLock
        title="Temas del día · Análisis IA"
        subtitle="Resumen, acuerdos y compromisos estructurados por tema (formato PDF)."
      >
        <ProTopicsPlaceholder />
      </SayaProLock>

      {showRecordingSection ? (
        <section className="voice-minute-card">
          <div className="voice-minute-audio-head">
            <p className="voice-minute-audio-head__label">Audio de la reunión</p>
            <p className="voice-minute-audio-head__sub">Escucha la grabación completa</p>
          </div>
          <div className="voice-minute-audio-body">
            {audioUrl || audioBlob?.size || minuteId ? (
              <MeetingMinuteAudioPlayer
                audioBlob={audioBlob}
                audioUrl={audioUrl}
                minuteId={minuteId}
                variant="plain"
              />
            ) : (
              <p className="voice-minute-empty">
                No se detectó archivo de audio. Vuelve a grabar la reunión para conservar el audio.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {(transcript || transcriptSegments?.length) ? (
        <details className="voice-minute-transcript">
          <summary>Ver transcripción completa</summary>
          <div className="voice-minute-transcript__body">
            {transcriptSegments?.length > 1 ? (
              <div className="space-y-3">
                {transcriptSegments.map((seg, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-bold text-slate-900">[{seg.speaker}]</span>{' '}
                    <span className="text-slate-600">{seg.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{transcript}</p>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function MeetingVoiceMinuteModal({
  open,
  onClose,
  draft: initialDraft,
  minuteBrief: initialBrief,
  transcript,
  transcriptSegments = [],
  meetingId,
  existingMinuteId,
  recordingAudioPath = null,
  recordingAudioUrl = null,
  recordingAudioBlob = null,
  showRecordingSection = false,
  onSaved,
}) {
  const [form, setForm] = useState(null);
  const [brief, setBrief] = useState(null);
  const [tab, setTab] = useState('preview');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialDraft) {
      setForm({
        ...initialDraft,
        attendees: Array.isArray(initialDraft.attendees) ? [...initialDraft.attendees] : [],
        topics: (initialDraft.topics || []).slice(0, 3).map((t) => ({ ...t })),
      });
      setBrief(initialBrief || initialDraft.minute_brief || null);
      setTab('preview');
    }
  }, [open, initialDraft, initialBrief]);

  if (!open || !form) return null;

  const setAttendee = (idx, field, value) => {
    setForm((f) => {
      const attendees = [...f.attendees];
      attendees[idx] = { ...attendees[idx], [field]: value };
      return { ...f, attendees };
    });
  };

  const handleSave = async () => {
    if (!form.fecha) {
      alert('Indica la fecha de la reunión.');
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
        topics: form.topics.slice(0, 3),
        meeting_id: meetingId,
        transcript_text: form.transcript_text || transcript || '',
      };
      if (recordingAudioPath) {
        payload.audio_path = recordingAudioPath;
      } else if (showRecordingSection) {
        const ok = window.confirm(
          'No hay grabación de audio vinculada. ¿Guardar la minuta solo con texto?',
        );
        if (!ok) {
          setSaving(false);
          return;
        }
      }
      if (existingMinuteId) {
        await axios.put(`/api/minutes/${existingMinuteId}`, payload);
      } else {
        await axios.post('/api/minutes', payload);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'No se pudo guardar la minuta.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="voice-minute-overlay animate-fade-in" onClick={onClose} role="presentation">
      <div
        className="voice-minute-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-minute-title"
      >
        <header className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="voice-minute-sheet__brand-row">
                <SayaBrandMark variant="hero" className="voice-minute-sheet__brand" />
                <span className="voice-minute-sheet__brand-tag">· Minuta generada</span>
              </div>
              <p id="voice-minute-title" className="meeting-sheet__hero-subtitle voice-minute-sheet__intro">
                Revisa la minuta estructurada antes de guardar.
              </p>
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="voice-minute-sheet__segmented">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`voice-minute-sheet__segment${tab === 'preview' ? ' voice-minute-sheet__segment--active' : ''}`}
            >
              Vista minuta
            </button>
            <button
              type="button"
              onClick={() => setTab('edit')}
              className={`voice-minute-sheet__segment${tab === 'edit' ? ' voice-minute-sheet__segment--active' : ''}`}
            >
              Editar campos
            </button>
          </div>
        </header>

        <div className="voice-minute-sheet__body">
          {tab === 'preview' ? (
            <MinutePreview
              form={form}
              brief={brief}
              transcript={transcript}
              transcriptSegments={transcriptSegments}
              audioUrl={recordingAudioUrl}
              audioBlob={recordingAudioBlob}
              showRecordingSection={showRecordingSection}
            />
          ) : (
            <div className="voice-minute-edit">
              <section className="voice-minute-edit-grid">
                <label className="voice-minute-field voice-minute-field--wide">
                  <span className="voice-minute-field__label">Tema</span>
                  <input className="voice-minute-input" value={form.tema} onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))} />
                </label>
                <label className="voice-minute-field">
                  <span className="voice-minute-field__label">Fecha *</span>
                  <input type="date" className="voice-minute-input" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
                </label>
                <label className="voice-minute-field">
                  <span className="voice-minute-field__label">Lugar</span>
                  <input className="voice-minute-input" value={form.lugar} onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))} />
                </label>
                <label className="voice-minute-field">
                  <span className="voice-minute-field__label">Inicio</span>
                  <input type="time" className="voice-minute-input" value={form.hora_inicio} onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))} />
                </label>
                <label className="voice-minute-field">
                  <span className="voice-minute-field__label">Cierre</span>
                  <input type="time" className="voice-minute-input" value={form.hora_cierre} onChange={(e) => setForm((f) => ({ ...f, hora_cierre: e.target.value }))} />
                </label>
              </section>

              <section>
                <p className="meeting-sheet__section-label mt-0">Asistentes</p>
                <div className="meeting-sheet__group mt-2 space-y-0">
                  {form.attendees.slice(0, 8).map((row, idx) => (
                    <div key={idx} className="meeting-sheet__cell space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-2">
                      <input className="voice-minute-input" placeholder="Nombre" value={row.nombre} onChange={(e) => setAttendee(idx, 'nombre', e.target.value)} />
                      <input className="voice-minute-input" placeholder="Cargo" value={row.cargo} onChange={(e) => setAttendee(idx, 'cargo', e.target.value)} />
                      <select className="voice-minute-input" value={row.asistencia} onChange={(e) => setAttendee(idx, 'asistencia', e.target.value)}>
                        <option value="Presente">Presente</option>
                        <option value="Ausente">Ausente</option>
                        <option value="Justificado">Justificado</option>
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <MinutaProLockedBlocks />
            </div>
          )}
        </div>

        <footer className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
          <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
            >
              <svg
                className="voice-minute-footer__icon voice-minute-footer__icon--discard"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6h14z" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Descartar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950" aria-hidden />
                  Guardando…
                </>
              ) : (
                <>
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
                  {existingMinuteId ? 'Actualizar minuta' : 'Guardar minuta'}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
