import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import { useCatalog } from '../../hooks/useCatalog';

const MOBILE_MQ = '(max-width: 767px)';
const FORUM_MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const FORUM_LONG_PRESS_MS = 500;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function parseForumMessageContent(content) {
  if (!content) return { text: '', refs: [] };
  const refs = [];
  const refRegex = /\[\[BOSA-REF:(TICKET|MEETING):(\d+)\]\]/g;
  let m;
  while ((m = refRegex.exec(content)) !== null) {
    refs.push({ type: m[1].toLowerCase(), id: parseInt(m[2], 10) });
  }
  return { text: content.replace(/\[\[BOSA-REF:(TICKET|MEETING):\d+\]\]/g, '').trim(), refs };
}

function buildForumMessageContent(text, refs) {
  const refTags = refs.map((r) => `[[BOSA-REF:${r.type.toUpperCase()}:${r.id}]]`);
  return [text.trim(), ...refTags].filter(Boolean).join('\n');
}

function formatReaderName(reader) {
  const full = [reader.user_name, reader.user_apellido].filter(Boolean).join(' ').trim();
  return full || 'Usuario';
}

function ForumMessageTicks({ status }) {
  const label =
    status === 'read' ? 'Leído por todos' : status === 'delivered' ? 'Visto por algunos' : 'Enviado';
  const tickClass =
    status === 'read'
      ? 'foro-msg-ticks--read'
      : status === 'delivered'
        ? 'foro-msg-ticks--delivered'
        : 'foro-msg-ticks--sent';

  if (status === 'sent') {
    return (
      <span className={`foro-msg-ticks ${tickClass}`} title={label} aria-label={label}>
        <svg className="foro-msg-ticks__icon foro-msg-ticks__icon--single" viewBox="0 0 12 11" fill="none" aria-hidden>
          <path
            d="M1.5 5.5L4.5 8.5L10.5 1.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={`foro-msg-ticks ${tickClass}`} title={label} aria-label={label}>
      <svg className="foro-msg-ticks__icon" viewBox="0 0 16 11" fill="none" aria-hidden>
        <path
          d="M1 5.5L4 8.5L9 2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 5.5L9 8.5L15 2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ForumComposerAttachTools({ disabled, variant, onPhoto, onFile, onTicket, onMeeting }) {
  const itemClass =
    variant === 'panel' ? 'foro-composer__attach-item' : 'foro-composer__tool-btn';
  const iconClass = variant === 'panel' ? 'foro-composer__attach-icon' : 'w-5 h-5';

  return (
    <>
      <label
        title="Adjuntar foto"
        className={`${itemClass}${variant === 'panel' ? ' foro-composer__attach-item--photo' : ''}${disabled ? ' foro-composer__tool-btn--disabled' : ''}`}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.[0]) onPhoto(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <span className={iconClass} aria-hidden>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
        {variant === 'panel' && <span className="foro-composer__attach-label">Foto</span>}
      </label>
      <label
        title="Adjuntar archivo"
        className={`${itemClass}${disabled ? ' foro-composer__tool-btn--disabled' : ''}`}
      >
        <input
          type="file"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.[0]) onFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <span className={iconClass} aria-hidden>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </span>
        {variant === 'panel' && <span className="foro-composer__attach-label">Archivo</span>}
      </label>
      <button
        type="button"
        title="Vincular ticket"
        disabled={disabled}
        onClick={onTicket}
        className={`${itemClass}${disabled ? ' foro-composer__tool-btn--disabled' : ''}`}
      >
        <span className={iconClass} aria-hidden>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
        </span>
        {variant === 'panel' && <span className="foro-composer__attach-label">Ticket</span>}
      </button>
      <button
        type="button"
        title="Vincular reunión"
        disabled={disabled}
        onClick={onMeeting}
        className={`${itemClass}${disabled ? ' foro-composer__tool-btn--disabled' : ''}`}
      >
        <span className={iconClass} aria-hidden>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </span>
        {variant === 'panel' && <span className="foro-composer__attach-label">Reunión</span>}
      </button>
    </>
  );
}

function ForumMessageSeenSection({ message }) {
  const readers = message.read_by || [];
  if (!readers.length) {
    return <p className="foro-msg-menu__seen-empty">Nadie ha visto este mensaje aún</p>;
  }
  return (
    <ul className="foro-msg-menu__seen-list">
      {readers.map((r) => (
        <li key={r.user_id} className="foro-msg-menu__seen-item">
          <span className="foro-msg-menu__seen-name">{formatReaderName(r)}</span>
          <span className="foro-msg-menu__seen-time">
            {new Date(r.read_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function canEditForumMessage(message, userId) {
  if (!message || Number(message.user_id) !== Number(userId)) return false;
  const createdMs = new Date(message.created_at).getTime();
  if (Number.isNaN(createdMs) || Date.now() - createdMs > FORUM_MESSAGE_EDIT_WINDOW_MS) return false;
  if (message.file_url) {
    const { text } = parseForumMessageContent(message.content);
    if (!text) return false;
  }
  return true;
}

const FORUM_ACCESS_OPTIONS = [
  { value: 'all', label: 'Todo el equipo', iconWrap: 'bell-all' },
  { value: 'department', label: 'Deptos.', iconWrap: 'depto' },
  { value: 'users', label: 'Usuarios', iconWrap: 'user' },
];

function ForumAccessSegmentIcon({ type }) {
  if (type === 'users') {
    return (
      <>
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </>
    );
  }
  if (type === 'department') {
    return (
      <>
        <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
      </>
    );
  }
  return (
    <>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </>
  );
}

function ForumAccessSegmented({ value, onChange }) {
  return (
    <div className="aviso-destinatario-segmented" role="radiogroup" aria-label="Acceso al foro">
      {FORUM_ACCESS_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`aviso-destinatario-segmented__btn${active ? ' aviso-destinatario-segmented__btn--active' : ''}`}
          >
            <span className={`bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--${opt.iconWrap}`} aria-hidden>
              <svg
                className="bosa-gold-btn__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <ForumAccessSegmentIcon type={opt.value} />
              </svg>
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ForumGroupFormFields({ form, setForm, isEdit, departments, allUsers, toggleAccessList }) {
  const setAccessType = (access_type) => {
    if (isEdit) {
      setForm((f) => ({ ...f, access_type, access_list: [] }));
    } else {
      setForm({ ...form, access_type, access_list: [] });
    }
  };

  return (
    <>
      <p className="meeting-sheet__section-label">Identidad del grupo</p>
      <div className="meeting-sheet__group">
        <div className="meeting-sheet__cell meeting-sheet__cell--field">
          <label className="meeting-sheet__cell-label">Nombre</label>
          <input
            type="text"
            autoFocus
            required
            value={form.name}
            onChange={(e) => setForm(isEdit ? (f) => ({ ...f, name: e.target.value }) : { ...form, name: e.target.value })}
            className="meeting-sheet__input font-semibold"
            placeholder="Ej. Proyecto Alpha"
          />
        </div>
        <div className="meeting-sheet__cell meeting-sheet__cell--field">
          <label className="meeting-sheet__cell-label">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm(isEdit ? (f) => ({ ...f, description: e.target.value }) : { ...form, description: e.target.value })
            }
            className="meeting-sheet__textarea"
            rows={3}
            placeholder="Objetivo del equipo o contexto del foro…"
          />
        </div>
      </div>

      <p className="meeting-sheet__section-label">Acceso al foro</p>
      <div className="px-4 pb-3">
        <ForumAccessSegmented value={form.access_type} onChange={setAccessType} />
      </div>

      {form.access_type === 'department' && (
        <div className="meeting-sheet__group">
          <div className="meeting-sheet__cell meeting-sheet__cell--field">
            <label className="meeting-sheet__cell-label">Departamentos con acceso</label>
            <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {departments.map((d) => {
                const selected = form.access_list.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleAccessList(d, isEdit)}
                    className={`rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                      selected ? 'bg-gold/20 text-navy-950 ring-1 ring-gold/30' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {form.access_type === 'users' && (
        <div className="meeting-sheet__group">
          <div className="meeting-sheet__cell meeting-sheet__cell--field">
            <label className="meeting-sheet__cell-label">Usuarios con acceso</label>
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {allUsers.map((u) => {
                const selected = form.access_list.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleAccessList(u.id, isEdit)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                      selected ? 'bg-gold/20 text-navy-950 ring-1 ring-gold/30' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {u.name} {u.apellido}
                    </span>
                    <span className="shrink-0 text-[12px] text-slate-500">{u.departamento || 'Sin depto.'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ForumMessageBubble({
  message: m,
  isMe,
  canEdit,
  canOpenMenu,
  isMobile,
  getRefData,
  isImage,
  onLightbox,
  onViewRef,
  onLongPressStart,
  onLongPressEnd,
  onContextMenu,
  onOpenMenu,
}) {
  const { text, refs } = parseForumMessageContent(m.content);
  const timeStr = new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const edited = Boolean(m.edited_at);

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 lg:gap-3 max-w-[85%] lg:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMe && (
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
            {m.user_name.charAt(0)}
          </div>
        )}
        <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
          {!isMe && <span className="text-[10px] font-bold text-navy-500 mb-1 ml-1">{m.user_name}</span>}
          <div className={`foro-msg-bubble group relative ${isMe ? 'foro-msg-bubble--me' : 'foro-msg-bubble--them'}`}>
            {isMe && canOpenMenu && !isMobile && (
              <button
                type="button"
                className="foro-msg-bubble__menu-btn"
                aria-label="Opciones del mensaje"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenMenu(m, rect);
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path d="M5.23 7.21l3.47 3.47 3.47-3.47a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06z" />
                </svg>
              </button>
            )}
            <div
              className={`foro-msg-bubble__body px-4 py-3 rounded-2xl shadow-sm ${
                isMe ? 'bg-navy-900 text-white rounded-br-none' : 'bg-white border border-gray-100 text-navy-900 rounded-bl-none'
              }`}
              onTouchStart={canOpenMenu && isMobile ? () => onLongPressStart(m) : undefined}
              onTouchEnd={canOpenMenu && isMobile ? onLongPressEnd : undefined}
              onTouchMove={canOpenMenu && isMobile ? onLongPressEnd : undefined}
              onTouchCancel={canOpenMenu && isMobile ? onLongPressEnd : undefined}
              onContextMenu={
                canOpenMenu
                  ? (e) => {
                      if (isMobile) {
                        e.preventDefault();
                        return;
                      }
                      onContextMenu(e, m);
                    }
                  : undefined
              }
            >
              {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
              {refs.map((ref, idx) => {
                const data = getRefData(ref);
                const isTicket = ref.type === 'ticket';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => data && onViewRef({ type: ref.type, data })}
                    className={`mt-2 first:mt-0 ${text ? 'mt-2' : ''} flex items-stretch gap-3 rounded-lg overflow-hidden text-left min-w-[220px] max-w-[280px] transition hover:opacity-90 ${
                      isMe ? 'bg-navy-800/60 border border-gold/30' : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className={`w-1 flex-shrink-0 ${isTicket ? 'bg-gold' : 'bg-emerald-500'}`} />
                    <div className="flex-1 min-w-0 py-2 pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isTicket ? (
                          <svg className={`w-3 h-3 ${isMe ? 'text-gold' : 'text-navy-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                          </svg>
                        ) : (
                          <svg className={`w-3 h-3 ${isMe ? 'text-emerald-300' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                        )}
                        <span className={`text-[9px] font-bold tracking-widest uppercase ${isMe ? 'text-gold' : 'text-navy-500'}`}>
                          {isTicket ? `Ticket #${ref.id}` : 'Reunión'}
                        </span>
                      </div>
                      {data ? (
                        <>
                          <p className={`text-xs font-bold leading-tight line-clamp-2 ${isMe ? 'text-white' : 'text-navy-950'}`}>
                            {data.title || '—'}
                          </p>
                          <p className={`text-[10px] mt-0.5 truncate ${isMe ? 'text-white/60' : 'text-navy-500'}`}>
                            {isTicket
                              ? `${(data.priority || '').toUpperCase()} · ${(data.status || '').replace('_', ' ').toUpperCase()}`
                              : data.start_time
                                ? `${new Date(data.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()} · ${new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'Sin fecha'}
                          </p>
                        </>
                      ) : (
                        <p className={`text-xs italic ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                          {isTicket ? 'Ticket no disponible' : 'Reunión no disponible'}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
              {m.file_url && (
                <div className={text || refs.length ? 'mt-2' : ''}>
                  {isImage(m.file_url) ? (
                    <button type="button" onClick={() => onLightbox(m.file_url)} className="block group/img">
                      <img
                        src={m.file_url}
                        alt={m.file_name || 'imagen'}
                        className="w-full max-w-[220px] lg:max-w-[280px] max-h-[280px] rounded-lg object-cover cursor-zoom-in border border-black/5 group-hover/img:opacity-90 transition"
                      />
                    </button>
                  ) : (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noreferrer"
                      download={m.file_name}
                      className={`flex items-center gap-3 text-xs font-bold p-2.5 rounded-lg border min-w-[200px] hover:opacity-90 transition ${isMe ? 'bg-navy-800 border-navy-700 text-gold' : 'bg-gray-50 border-gray-200 text-navy-700'}`}
                    >
                      <div className={`w-9 h-9 flex-shrink-0 rounded flex items-center justify-center ${isMe ? 'bg-gold/15' : 'bg-navy-100'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="truncate">{m.file_name || 'Archivo'}</p>
                        <p className={`text-[9px] font-normal ${isMe ? 'text-gold/70' : 'text-navy-400'}`}>Descargar</p>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <span className="foro-msg-meta text-[9px] text-gray-400 mt-1 mx-1">
            <span className="foro-msg-meta__time">
              {timeStr}
              {edited && <span className="foro-msg-bubble__edited"> · editado</span>}
            </span>
            {isMe && <ForumMessageTicks status={m.read_status || 'sent'} />}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ForoModule() {
  const { user } = useAuth();
  const { departments } = useCatalog();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [fileInput, setFileInput] = useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '', access_type: 'all', access_list: [] });
  const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '', access_type: 'all', access_list: [] });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // Vinculación de tickets/reuniones
  const [availableTickets, setAvailableTickets] = useState([]);
  const [availableMeetings, setAvailableMeetings] = useState([]);
  const [pickerType, setPickerType] = useState(null); // 'ticket' | 'meeting' | null
  const [pickerSearch, setPickerSearch] = useState('');
  const [pendingRef, setPendingRef] = useState(null); // { type, id, title }
  const [viewingRef, setViewingRef] = useState(null); // { type, data }
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [editingMessage, setEditingMessage] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [messageActionSheet, setMessageActionSheet] = useState(null);
  const [composerAttachOpen, setComposerAttachOpen] = useState(false);

  const [joinRequests, setJoinRequests] = useState([]);
  const [showJoinRequestsPanel, setShowJoinRequestsPanel] = useState(false);

  // Helper: obtener los usuarios con acceso al grupo seleccionado (incluye aprobados por solicitud)
  const getGroupMembers = (group) => {
    if (!group || allUsers.length === 0) return [];
    let extraIds = [];
    try {
      extraIds =
        typeof group.extra_allowed_user_ids === 'string'
          ? JSON.parse(group.extra_allowed_user_ids || '[]')
          : group.extra_allowed_user_ids || [];
    } catch {
      extraIds = [];
    }
    const extraUsers = allUsers.filter((u) => extraIds.some((id) => Number(id) === Number(u.id)));

    const accessType = group.access_type || 'all';
    let accessList = [];
    try {
      accessList =
        typeof group.access_list === 'string'
          ? JSON.parse(group.access_list || '[]')
          : group.access_list || [];
    } catch {
      accessList = [];
    }

    if (accessType === 'all') {
      const byId = new Map(allUsers.map((u) => [u.id, u]));
      extraUsers.forEach((u) => byId.set(u.id, u));
      return Array.from(byId.values());
    }
    let base = [];
    if (accessType === 'department') {
      base = allUsers.filter((u) => accessList.includes(u.departamento));
    } else if (accessType === 'users') {
      base = allUsers.filter((u) => accessList.some((id) => Number(id) === Number(u.id)));
    }
    const byId = new Map(base.map((u) => [u.id, u]));
    extraUsers.forEach((u) => {
      if (!byId.has(u.id)) byId.set(u.id, u);
    });
    return Array.from(byId.values());
  };
  const accessTypeLabel = (type) => {
    if (type === 'department') return 'Por departamento';
    if (type === 'users') return 'Usuarios seleccionados';
    return 'Todo el equipo';
  };

  // Helper: detectar si una URL es de imagen
  const isImage = (url) => /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(url || '');
  // Helper: formatear tamaño de archivo
  const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  // Helper: obtener datos de una referencia
  const getRefData = (ref) => {
    if (ref.type === 'ticket') return availableTickets.find(t => t.id === ref.id);
    if (ref.type === 'meeting') return availableMeetings.find(m => m.id === ref.id);
    return null;
  };

  // Cargar grupos iniciales + tickets y reuniones para vincular
  useEffect(() => {
    fetchGroups();
    axios.get('/api/tickets').then(r => setAvailableTickets(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get('/api/meetings').then(r => setAvailableMeetings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  // Refrescar lista cuando se abre el selector
  useEffect(() => {
    if (pickerType === 'ticket') {
      axios.get('/api/tickets').then(r => setAvailableTickets(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    } else if (pickerType === 'meeting') {
      axios.get('/api/meetings').then(r => setAvailableMeetings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }
  }, [pickerType]);

  // Cargar todos los usuarios al montar (para mostrar miembros con acceso)
  useEffect(() => {
    axios.get('/api/users').then(res => setAllUsers(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const toggleAccessList = (item, isEdit = false) => {
    if (isEdit) {
      setEditGroupForm(f => ({
        ...f,
        access_list: f.access_list.includes(item) 
          ? f.access_list.filter(i => i !== item)
          : [...f.access_list, item]
      }));
    } else {
      setNewGroupForm(f => ({
        ...f,
        access_list: f.access_list.includes(item) 
          ? f.access_list.filter(i => i !== item)
          : [...f.access_list, item]
      }));
    }
  };

  const cancelMessageEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageInput('');
  }, []);

  const startMessageEdit = useCallback((msg) => {
    const { text, refs } = parseForumMessageContent(msg.content);
    setEditingMessage({ id: msg.id, refs });
    setMessageInput(text);
    setMessageMenu(null);
    setMessageActionSheet(null);
    setFileInput(null);
    setPendingRef(null);
    setTimeout(() => messageInputRef.current?.focus(), 50);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleMessageLongPressStart = useCallback(
    (msg) => {
      if (Number(msg.user_id) !== Number(user?.id)) return;
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        setMessageActionSheet(msg);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      }, FORUM_LONG_PRESS_MS);
    },
    [clearLongPress, user?.id]
  );

  const handleMessageContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    setMessageMenu({ message: msg, x: e.clientX, y: e.clientY });
  }, []);

  const handleMessageOpenMenu = useCallback((msg, rect) => {
    setMessageMenu({ message: msg, x: rect.right - 8, y: rect.bottom + 4 });
  }, []);

  useEffect(() => {
    cancelMessageEdit();
    setMessageMenu(null);
    setMessageActionSheet(null);
    setComposerAttachOpen(false);
  }, [selectedGroup?.id, cancelMessageEdit]);

  useEffect(() => {
    if (editingMessage) setComposerAttachOpen(false);
  }, [editingMessage]);

  const closeComposerAttach = () => setComposerAttachOpen(false);
  const handleComposerPhoto = (file) => {
    setFileInput(file);
    closeComposerAttach();
  };
  const handleComposerFile = (file) => {
    setFileInput(file);
    closeComposerAttach();
  };
  const handleComposerTicket = () => {
    setPickerType('ticket');
    setPickerSearch('');
    closeComposerAttach();
  };
  const handleComposerMeeting = () => {
    setPickerType('meeting');
    setPickerSearch('');
    closeComposerAttach();
  };

  useEffect(() => {
    if (!messageMenu && !messageActionSheet) return undefined;
    const close = () => {
      setMessageMenu(null);
      setMessageActionSheet(null);
    };
    const t = setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('touchstart', close, { passive: true });
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      document.removeEventListener('touchstart', close);
    };
  }, [messageMenu, messageActionSheet]);

  // Polling para mensajes solo si hay acceso al foro
  useEffect(() => {
    setShowMembers(false); // cerrar popover al cambiar de grupo
    if (!selectedGroup) {
      setMessages([]);
      return;
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [selectedGroup]);

  // Solicitudes pendientes (creador / superadmin)
  useEffect(() => {
    if (!selectedGroup?.id) {
      setJoinRequests([]);
      setShowJoinRequestsPanel(false);
      return;
    }
    const isOwner =
      Number(selectedGroup.created_by) === Number(user?.id) || user?.role === 'superadmin';
    if (!isOwner) {
      setJoinRequests([]);
      return;
    }
    const load = () => {
      axios
        .get(`/api/forums/${selectedGroup.id}/join-requests`)
        .then((r) => setJoinRequests(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [selectedGroup?.id, selectedGroup?.created_by, user?.id, user?.role]);

  useEffect(() => {
    if (joinRequests.length === 0) setShowJoinRequestsPanel(false);
  }, [joinRequests.length]);

  // Scroll to bottom cuando hay nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/forums');
      const data = Array.isArray(res.data) ? res.data : [];
      setGroups(data);
      setSelectedGroup((prev) => {
        if (!prev) return prev;
        const up = data.find((g) => g.id === prev.id);
        return up || null;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    try {
      const res = await axios.get(`/api/forums/${selectedGroup.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name) return;
    try {
      const res = await axios.post('/api/forums', {
        name: newGroupForm.name,
        description: newGroupForm.description,
        created_by: user.id,
        access_type: newGroupForm.access_type,
        access_list: newGroupForm.access_list
      });
      const created = { ...res.data, has_access: true, pending_join_request: false };
      setGroups([created, ...groups]);
      setIsCreatingGroup(false);
      setNewGroupForm({ name: '', description: '', access_type: 'all', access_list: [] });
      setSelectedGroup(created);
      PushEvents.forumGroupNew(res.data.name);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroupForm.name) return;
    try {
      const res = await axios.put(`/api/forums/${selectedGroup.id}`, {
        name: editGroupForm.name,
        description: editGroupForm.description,
        access_type: editGroupForm.access_type,
        access_list: editGroupForm.access_list
      });
      const updated = { ...res.data, has_access: true, pending_join_request: false };
      setGroups(groups.map((g) => (g.id === selectedGroup.id ? updated : g)));
      setSelectedGroup(updated);
      setIsEditingGroup(false);
      PushEvents.forumGroupEdit(res.data.name);
      fetchGroups();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el grupo');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${selectedGroup.name}" y todos sus mensajes? Esta acción no se puede deshacer.`)) return;
    try {
      const gName = selectedGroup.name;
      await axios.delete(`/api/forums/${selectedGroup.id}`);
      setGroups(groups.filter(g => g.id !== selectedGroup.id));
      setSelectedGroup(null);
      setIsEditingGroup(false);
      PushEvents.forumGroupDel(gName);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el grupo');
    }
  };

  const handleSaveMessageEdit = async () => {
    if (!editingMessage || !selectedGroup || !messageInput.trim()) return;
    const content = buildForumMessageContent(messageInput, editingMessage.refs);
    try {
      await axios.patch(`/api/forums/${selectedGroup.id}/messages/${editingMessage.id}`, { content });
      cancelMessageEdit();
      fetchMessages();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo editar el mensaje');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (editingMessage) {
      await handleSaveMessageEdit();
      return;
    }
    if (!messageInput.trim() && !fileInput && !pendingRef) return;

    let finalContent = messageInput.trim();
    if (pendingRef) {
      const refTag = `[[BOSA-REF:${pendingRef.type.toUpperCase()}:${pendingRef.id}]]`;
      finalContent = finalContent ? `${finalContent}\n${refTag}` : refTag;
    }

    const formData = new FormData();
    formData.append('user_id', user.id);
    formData.append('content', finalContent);
    if (fileInput) {
      formData.append('file', fileInput);
    }

    try {
      await axios.post(`/api/forums/${selectedGroup.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessageInput('');
      setFileInput(null);
      setPendingRef(null);
      setComposerAttachOpen(false);
      fetchMessages();
      PushEvents.forumMessage(selectedGroup?.name || 'foro');
    } catch (err) {
      console.error(err);
      alert('Error al enviar mensaje');
    }
  };

  const handleSendJoinRequest = async () => {
    if (!selectedGroup) return;
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-request`);
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo enviar la solicitud');
    }
  };

  const handleApproveJoin = async (requestId) => {
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-requests/${requestId}/approve`);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      await fetchGroups();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo aceptar la solicitud');
    }
  };

  const handleRejectJoin = async (requestId) => {
    try {
      await axios.post(`/api/forums/${selectedGroup.id}/join-requests/${requestId}/reject`);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'No se pudo rechazar la solicitud');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-260px)] min-h-[400px] lg:h-[calc(100vh-140px)] lg:min-h-0 lg:gap-6 animate-fade-in">
      {/* Columna Izquierda: Lista de Grupos */}
      <div className={`w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex-col overflow-hidden ${selectedGroup ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 lg:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="font-display font-medium text-navy-950 text-base lg:text-lg">Foro & Equipos</h2>
            <p className="text-xs text-navy-500 mt-0.5">Solo los foros en los que participas</p>
          </div>
          <button
            onClick={() => setIsCreatingGroup(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gold/10 text-gold hover:bg-gold hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {groups.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No hay grupos creados</div>
          ) : (
            groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g)}
                className={`w-full text-left p-3 lg:p-4 rounded-xl transition-all border ${
                  selectedGroup?.id === g.id
                    ? 'bg-navy-900 border-navy-900 shadow-md lg:transform lg:scale-[1.02]'
                    : 'bg-white border-gray-100 hover:border-gold/30 hover:bg-gold/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-display font-bold text-lg ${
                    selectedGroup?.id === g.id ? 'bg-white/10 text-gold' : 'bg-navy-50 text-navy-900'
                  }`}>
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm truncate ${selectedGroup?.id === g.id ? 'text-white' : 'text-navy-950'}`}>
                      <span className="truncate"># {g.name}</span>
                    </h3>
                    <p className={`text-xs truncate mt-0.5 ${selectedGroup?.id === g.id ? 'text-navy-200' : 'text-navy-500'}`}>
                      {g.description || 'Sin descripción'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Columna Derecha: Chat Area */}
      <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex-col overflow-hidden ${selectedGroup ? 'flex' : 'hidden lg:flex'}`}>
        {selectedGroup ? (
          <>
            <div className="p-3 lg:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center gap-2">
              {/* Botón "regresar" — solo móvil */}
              <button
                onClick={() => setSelectedGroup(null)}
                className="lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors"
                title="Volver a la lista de grupos"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {joinRequests.length > 0 &&
                (user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id)) && (
                  <button
                    type="button"
                    onClick={() => setShowJoinRequestsPanel((s) => !s)}
                    className={`lg:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border text-[10px] font-black relative ${
                      showJoinRequestsPanel
                        ? 'bg-gold border-gold text-navy-950'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                    title="Solicitudes de ingreso"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-navy-950 text-gold text-[8px] flex items-center justify-center px-0.5">
                      {joinRequests.length}
                    </span>
                  </button>
                )}
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-navy-950 text-base lg:text-lg flex items-center gap-2 truncate">
                  <span className="text-gold flex-shrink-0">#</span><span className="truncate">{selectedGroup.name}</span>
                </h3>
                <p className="text-xs text-navy-500 mt-0.5 truncate">{selectedGroup.description}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {(() => {
                  const members = getGroupMembers(selectedGroup);
                  const visibleCount = 3;
                  const visible = members.slice(0, visibleCount);
                  const remaining = members.length - visible.length;
                  return (
                    <div className="hidden lg:block relative mr-2">
                      <button
                        type="button"
                        onClick={() => setShowMembers(s => !s)}
                        className="flex -space-x-2 hover:opacity-80 transition-opacity"
                        title="Ver miembros con acceso"
                      >
                        {visible.map((u, i) => (
                          <div
                            key={u.id}
                            title={`${u.name || ''} ${u.apellido || ''}${u.puesto ? ' · ' + u.puesto : ''}`}
                            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 hover:z-10 ${
                              i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-navy-100 text-navy-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                            style={{ zIndex: visibleCount - i }}
                          >
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {remaining > 0 && (
                          <div
                            title={`Y ${remaining} más`}
                            className="w-8 h-8 rounded-full bg-navy-950 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gold"
                          >
                            +{remaining}
                          </div>
                        )}
                        {members.length === 0 && (
                          <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-400">
                            0
                          </div>
                        )}
                      </button>

                      {showMembers && (
                        <>
                          {/* Click-outside backdrop */}
                          <div className="fixed inset-0 z-40" onClick={() => setShowMembers(false)} />
                          {/* Popover */}
                          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                              <div>
                                <h4 className="font-display font-bold text-navy-950 text-sm">Miembros con acceso</h4>
                                <p className="text-[10px] text-navy-600 mt-0.5 font-medium">{accessTypeLabel(selectedGroup.access_type)}</p>
                              </div>
                              <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded">{members.length}</span>
                            </div>
                            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                              {members.length === 0 ? (
                                <p className="text-center text-xs text-navy-500 py-6">Sin miembros con acceso</p>
                              ) : (
                                members.map(u => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gold/5 transition-colors text-left"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-700 flex-shrink-0">
                                      {(u.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-navy-950 truncate">
                                        {u.name} {u.apellido || ''}
                                      </p>
                                      <p className="text-[10px] text-navy-600 truncate">
                                        {u.puesto || u.departamento || u.email || '—'}
                                      </p>
                                    </div>
                                    {u.id === user?.id && (
                                      <span className="text-[8px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0">Tú</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                {joinRequests.length > 0 &&
                  (user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id)) && (
                    <button
                      type="button"
                      onClick={() => setShowJoinRequestsPanel((s) => !s)}
                      className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        showJoinRequestsPanel
                          ? 'bg-gold text-navy-950 border-gold'
                          : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      Solicitudes
                      <span className="min-w-[1.25rem] h-5 rounded-full bg-navy-950 text-gold text-[9px] flex items-center justify-center px-1">
                        {joinRequests.length}
                      </span>
                    </button>
                  )}
                {user?.role === 'superadmin' || Number(selectedGroup.created_by) === Number(user?.id) ? (
                  <button 
                    onClick={() => {
                      setEditGroupForm({
                        name: selectedGroup.name,
                        description: selectedGroup.description,
                        access_type: selectedGroup.access_type || 'all',
                        access_list: selectedGroup.access_list ? JSON.parse(selectedGroup.access_list) : []
                      });
                      setIsEditingGroup(true);
                    }}
                    className="text-gray-400 hover:text-gold transition-colors p-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                ) : null}
              </div>
            </div>

            {showJoinRequestsPanel && joinRequests.length > 0 && (
              <div className="border-b border-amber-200 bg-amber-50/90 px-3 py-3 lg:px-5 max-h-40 overflow-y-auto space-y-2">
                <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Solicitudes de ingreso</p>
                {joinRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-navy-950 truncate">
                        {r.name} {r.apellido || ''}
                      </p>
                      <p className="text-[10px] text-navy-500 truncate">{r.departamento || r.email || '—'}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveJoin(r.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectJoin(r.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-navy-700 text-[10px] font-black uppercase tracking-wide hover:bg-gray-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6 bg-[url('/pattern.png')] bg-repeat opacity-95">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                  <svg className="w-12 h-12 opacity-50 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  <p className="font-medium text-sm">Comienza la conversación en el grupo</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.user_id === user?.id;
                  return (
                    <ForumMessageBubble
                      key={m.id}
                      message={m}
                      isMe={isMe}
                      canOpenMenu={isMe}
                      canEdit={isMe && canEditForumMessage(m, user?.id)}
                      isMobile={isMobile}
                      getRefData={getRefData}
                      isImage={isImage}
                      onLightbox={setLightboxUrl}
                      onViewRef={setViewingRef}
                      onLongPressStart={handleMessageLongPressStart}
                      onLongPressEnd={clearLongPress}
                      onContextMenu={handleMessageContextMenu}
                      onOpenMenu={handleMessageOpenMenu}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {messageMenu &&
              createPortal(
                <div
                  className="foro-msg-menu"
                  style={{ top: messageMenu.y, left: messageMenu.x }}
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEditForumMessage(messageMenu.message, user?.id) && (
                    <button
                      type="button"
                      role="menuitem"
                      className="foro-msg-menu__item"
                      onClick={() => startMessageEdit(messageMenu.message)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar
                    </button>
                  )}
                  <div className="foro-msg-menu__seen" role="group" aria-label="Visto por">
                    <p className="foro-msg-menu__seen-title">Visto por</p>
                    <ForumMessageSeenSection message={messageMenu.message} />
                  </div>
                </div>,
                document.body
              )}

            {messageActionSheet &&
              createPortal(
                <div
                  className="foro-msg-action-overlay"
                  role="presentation"
                  onClick={() => setMessageActionSheet(null)}
                >
                  <div
                    className="foro-msg-action-sheet"
                    role="dialog"
                    aria-label="Opciones del mensaje"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEditForumMessage(messageActionSheet, user?.id) && (
                      <button
                        type="button"
                        className="foro-msg-action-sheet__btn foro-msg-action-sheet__btn--primary"
                        onClick={() => startMessageEdit(messageActionSheet)}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar mensaje
                      </button>
                    )}
                    <div className="foro-msg-action-sheet__seen">
                      <p className="foro-msg-menu__seen-title">Visto por</p>
                      <ForumMessageSeenSection message={messageActionSheet} />
                    </div>
                    <button
                      type="button"
                      className="foro-msg-action-sheet__btn"
                      onClick={() => setMessageActionSheet(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>,
                document.body
              )}

            {/* Input Area */}
            <div className="foro-composer border-t border-gray-100 bg-white">
              <div className="foro-composer__extras">
              {editingMessage && (
                <div className="foro-msg-edit-bar mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-emerald-900">Editando mensaje</span>
                  <button
                    type="button"
                    onClick={cancelMessageEdit}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors"
                    aria-label="Cancelar edición"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {pendingRef && !editingMessage && (
                <div className="mb-3 flex items-center gap-3 bg-navy-50 border border-navy-200 rounded-lg px-3 py-2 w-fit max-w-full">
                  <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${pendingRef.type === 'ticket' ? 'bg-gold/15 text-gold' : 'bg-emerald-100 text-emerald-700'}`}>
                    {pendingRef.type === 'ticket' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-navy-500 tracking-widest uppercase">
                      {pendingRef.type === 'ticket' ? `Ticket #${pendingRef.id} vinculado` : 'Reunión vinculada'}
                    </p>
                    <p className="text-xs font-bold text-navy-900 truncate">{pendingRef.title || '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingRef(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Quitar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {fileInput && !editingMessage && (
                <div className="mb-3 flex items-center gap-3 bg-gold/5 border border-gold/30 rounded-lg px-3 py-2 w-fit max-w-full">
                  {fileInput.type?.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(fileInput)}
                      alt="preview"
                      className="w-12 h-12 rounded object-cover border border-gold/40 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-navy-50 border border-navy-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-navy-900 truncate">{fileInput.name}</p>
                    <p className="text-[10px] font-medium text-navy-500">{formatSize(fileInput.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileInput(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Quitar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              </div>
              <form onSubmit={handleSendMessage} className="foro-composer__form">
                {isMobile && composerAttachOpen && !editingMessage && (
                  <div className="foro-composer__attach-panel" role="toolbar" aria-label="Adjuntar al mensaje">
                    <ForumComposerAttachTools
                      variant="panel"
                      disabled={!!editingMessage}
                      onPhoto={handleComposerPhoto}
                      onFile={handleComposerFile}
                      onTicket={handleComposerTicket}
                      onMeeting={handleComposerMeeting}
                    />
                  </div>
                )}
                <div className="foro-composer__row">
                  {isMobile && !editingMessage && (
                    <button
                      type="button"
                      className={`foro-composer__toggle${composerAttachOpen ? ' foro-composer__toggle--open' : ''}`}
                      aria-label={composerAttachOpen ? 'Ocultar adjuntos' : 'Adjuntar'}
                      aria-expanded={composerAttachOpen}
                      onClick={() => setComposerAttachOpen((o) => !o)}
                    >
                      <svg className="foro-composer__toggle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                        {composerAttachOpen ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        )}
                      </svg>
                    </button>
                  )}
                  <div className="foro-composer__tools hidden lg:flex" role="toolbar" aria-label="Adjuntar al mensaje">
                    <ForumComposerAttachTools
                      variant="inline"
                      disabled={!!editingMessage}
                      onPhoto={handleComposerPhoto}
                      onFile={handleComposerFile}
                      onTicket={handleComposerTicket}
                      onMeeting={handleComposerMeeting}
                    />
                  </div>
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onFocus={() => isMobile && setComposerAttachOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingMessage) {
                        e.preventDefault();
                        cancelMessageEdit();
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={editingMessage ? 'Edita el mensaje…' : 'Mensaje'}
                    rows={1}
                    className={`foro-composer__input${editingMessage ? ' foro-composer__input--edit' : ''}`}
                  />
                  <button
                    type="submit"
                    disabled={editingMessage ? !messageInput.trim() : !messageInput.trim() && !fileInput && !pendingRef}
                    className={`foro-composer__send${editingMessage ? ' foro-composer__send--edit' : ''}`}
                    title={editingMessage ? 'Guardar edición' : 'Enviar'}
                    aria-label={editingMessage ? 'Guardar edición' : 'Enviar mensaje'}
                  >
                    {editingMessage ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px] ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            <p className="font-medium">Selecciona o crea un grupo para comenzar a chatear</p>
          </div>
        )}
      </div>

      {/* Modal Crear Grupo */}
      {isCreatingGroup &&
        createPortal(
          <div
            className="meeting-sheet-overlay z-[120] animate-fade-in"
            onClick={() => setIsCreatingGroup(false)}
            role="presentation"
          >
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="foro-new-group-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Foro colaborativo</span>
                    <h3 id="foro-new-group-title" className="meeting-sheet__hero-title mt-2">
                      Nuevo grupo de trabajo
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      Nombre, descripción y quién puede entrar al chat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="meeting-sheet__close"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateGroup}>
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                  <ForumGroupFormFields
                    form={newGroupForm}
                    setForm={setNewGroupForm}
                    isEdit={false}
                    departments={departments}
                    allUsers={allUsers}
                    toggleAccessList={toggleAccessList}
                  />
                </div>

                <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                    <button
                      type="button"
                      onClick={() => setIsCreatingGroup(false)}
                      className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
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
                      disabled={!newGroupForm.name}
                      className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--notice" aria-hidden>
                        <svg
                          className="bosa-gold-btn__icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                          <path d="M10 12h6M10 16h4" />
                        </svg>
                      </span>
                      Crear grupo
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Editar Grupo */}
      {isEditingGroup &&
        createPortal(
          <div
            className="meeting-sheet-overlay z-[125] animate-fade-in"
            onClick={() => setIsEditingGroup(false)}
            role="presentation"
          >
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="foro-edit-group-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Configuración</span>
                    <h3 id="foro-edit-group-title" className="meeting-sheet__hero-title mt-2">
                      Grupo de trabajo
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      Ajusta nombre, descripción y permisos de acceso.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingGroup(false)}
                    className="meeting-sheet__close"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleUpdateGroup}>
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                  <ForumGroupFormFields
                    form={editGroupForm}
                    setForm={setEditGroupForm}
                    isEdit
                    departments={departments}
                    allUsers={allUsers}
                    toggleAccessList={toggleAccessList}
                  />
                </div>

                <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                    <button
                      type="button"
                      onClick={() => setIsEditingGroup(false)}
                      className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
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
                      disabled={!editGroupForm.name}
                      className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--save" aria-hidden>
                        <svg
                          className="bosa-gold-btn__icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                          <path d="M15 4v3h3" />
                          <path d="M9 14l2 2 4-4.5" />
                        </svg>
                      </span>
                      Guardar
                    </button>
                  </div>
                  <button type="button" onClick={handleDeleteGroup} className="meeting-sheet__btn-destructive">
                    Eliminar grupo
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Selector — Vincular Ticket o Reunión */}
      {pickerType && (() => {
        const isTicket = pickerType === 'ticket';
        const items = isTicket ? availableTickets : availableMeetings;
        const filtered = items.filter(it => {
          const q = pickerSearch.trim().toLowerCase();
          if (!q) return true;
          return (it.title || '').toLowerCase().includes(q) || String(it.id).includes(q);
        });
        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setPickerType(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="font-display font-bold text-navy-950 text-base">
                    Vincular {isTicket ? 'ticket' : 'reunión'}
                  </h3>
                  <p className="text-xs text-navy-500 mt-0.5">Selecciona uno para adjuntarlo al mensaje</p>
                </div>
                <button onClick={() => setPickerType(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 pt-3 pb-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={isTicket ? "Buscar por título o #ID..." : "Buscar por título..."}
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy-900 outline-none focus:border-gold transition-colors"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">
                    {items.length === 0 ? `No hay ${isTicket ? 'tickets' : 'reuniones'} disponibles` : 'Sin resultados'}
                  </div>
                ) : (
                  filtered.map(it => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setPendingRef({ type: pickerType, id: it.id, title: it.title });
                        setPickerType(null);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 bg-white hover:border-gold/40 hover:bg-gold/5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${isTicket ? 'bg-gold/15 text-gold' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isTicket ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-bold tracking-widest uppercase text-navy-400">
                              {isTicket ? `#${it.id}` : new Date(it.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()}
                            </span>
                            {isTicket && it.priority && (
                              <span className="text-[9px] font-bold tracking-wider uppercase text-navy-500">{it.priority}</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-navy-950 leading-tight line-clamp-2">{it.title}</p>
                          <p className="text-[10px] text-navy-500 mt-1 truncate">
                            {isTicket
                              ? (it.category || 'Sin departamento')
                              : (it.start_time ? `${new Date(it.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(it.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '')
                            }
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Detalle — vista de un ticket o reunión vinculados */}
      {viewingRef && (() => {
        const isTicket = viewingRef.type === 'ticket';
        const data = viewingRef.data;
        return (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setViewingRef(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="bg-navy-950 px-6 py-5">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isTicket ? 'text-gold' : 'text-emerald-400'}`}>
                    {isTicket ? `Ticket #${data.id}` : 'Reunión'}
                  </span>
                  <button onClick={() => setViewingRef(null)} className="text-white/40 hover:text-white transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <h3 className="text-lg font-display font-medium text-white leading-tight">{data.title || '—'}</h3>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {data.description && (
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Descripción</p>
                    <p className="text-sm text-navy-800 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                      {data.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {isTicket ? (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Estado</p>
                        <p className="text-xs font-bold text-navy-950 capitalize">{(data.status || '').replace('_',' ')}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Prioridad</p>
                        <p className="text-xs font-bold text-navy-950 capitalize">{data.priority || '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Departamento</p>
                        <p className="text-xs font-bold text-navy-950">{data.category || '—'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Asignado</p>
                        <p className="text-xs font-bold text-navy-950 truncate">{data.assigned_name || 'Sin asignar'}</p>
                      </div>
                      {data.due_date && (
                        <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Fecha límite</p>
                          <p className="text-xs font-bold text-navy-950">
                            {new Date(data.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Fecha</p>
                        <p className="text-xs font-bold text-navy-950">
                          {data.start_time ? new Date(data.start_time).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Horario</p>
                        <p className="text-xs font-bold text-navy-950">
                          {data.start_time ? `${new Date(data.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(data.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                        </p>
                      </div>
                      <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Participantes</p>
                        <p className="text-xs font-bold text-navy-950">{Array.isArray(data.attendees) ? data.attendees.length : 0} asistentes</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setViewingRef(null)}
                  className="px-5 py-2 rounded-lg bg-navy-950 text-gold text-[10px] font-black uppercase tracking-widest hover:bg-navy-900 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox para imágenes */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="vista ampliada"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <a
            href={lightboxUrl}
            download
            onClick={e => e.stopPropagation()}
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Descargar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
