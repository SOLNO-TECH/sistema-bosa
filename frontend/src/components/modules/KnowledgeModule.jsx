import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { isSuperadminUser } from '../../utils/permissions';
import { KnowledgeIconSvg, KNOWLEDGE_ICONS } from '../../utils/knowledgeIcons';
import {
  DEFAULT_KNOWLEDGE_COLORS,
  KNOWLEDGE_COLOR_PRESETS,
  colorsFromPreset,
  formColorsFromItem,
} from '../../utils/knowledgeColorPresets';

function isImageMime(mimetype) {
  return /^image\//i.test(mimetype || '');
}

function isVideoMime(mimetype) {
  return /^video\//i.test(mimetype || '');
}

function isPdfMime(mimetype) {
  return String(mimetype || '').toLowerCase() === 'application/pdf';
}

function emptyForm() {
  return {
    title: '',
    subtitle: '',
    href: '',
    contentType: 'link',
    comingSoon: false,
    mediaPath: '',
    mediaFilename: '',
    mediaMimetype: '',
    mediaUrl: '',
    mediaFile: null,
    preset: 'navy',
    ...DEFAULT_KNOWLEDGE_COLORS,
  };
}

function itemToForm(item) {
  if (!item) return emptyForm();
  const colors = formColorsFromItem(item);
  return {
    title: item.title || '',
    subtitle: item.subtitle || '',
    href: item.href || '',
    contentType: item.contentType === 'media' ? 'media' : 'link',
    comingSoon: Boolean(item.comingSoon),
    mediaPath: item.mediaPath || '',
    mediaFilename: item.mediaFilename || '',
    mediaMimetype: item.mediaMimetype || '',
    mediaUrl: item.mediaUrl || '',
    mediaFile: null,
    preset: colors.preset,
    icon: colors.icon,
    bg_color: colors.bg_color,
    bg_color_end: colors.bg_color_end,
    text_color: colors.text_color,
    subtext_color: colors.subtext_color,
    icon_color: colors.icon_color,
    badge_bg: colors.badge_bg,
    badge_text: colors.badge_text,
  };
}

function cardStyleVars(item) {
  return {
    '--kh-bg': item.bg_color,
    '--kh-bg-end': item.bg_color_end,
    '--kh-text': item.text_color,
    '--kh-subtext': item.subtext_color,
    '--kh-icon': item.icon_color,
    '--kh-badge-bg': item.badge_bg,
    '--kh-badge-text': item.badge_text,
  };
}

function buildPayload(form) {
  return {
    title: form.title,
    subtitle: form.subtitle,
    href: form.comingSoon || form.contentType === 'media' ? '' : form.href,
    contentType: form.comingSoon ? 'link' : form.contentType,
    comingSoon: form.comingSoon,
    media_path: form.comingSoon || form.contentType !== 'media' ? '' : form.mediaPath,
    media_filename: form.comingSoon || form.contentType !== 'media' ? '' : form.mediaFilename,
    media_mimetype: form.comingSoon || form.contentType !== 'media' ? '' : form.mediaMimetype,
    theme: form.preset === 'custom' ? 'custom' : form.preset,
    icon: form.icon,
    bg_color: form.bg_color,
    bg_color_end: form.bg_color_end,
    text_color: form.text_color,
    subtext_color: form.subtext_color,
    icon_color: form.icon_color,
    badge_bg: form.badge_bg,
    badge_text: form.badge_text,
  };
}

function KnowledgeCardContent({ item, preview = false, onOpenMedia }) {
  const isLink = !preview && item.available && item.contentType !== 'media' && item.href;
  const isMedia = !preview && item.available && item.contentType === 'media' && item.mediaUrl;
  const isInteractive = isLink || isMedia;

  const badgeLabel = item.comingSoon
    ? 'Próximamente'
    : item.contentType === 'media'
      ? 'Multimedia'
      : 'Acceso directo';

  const inner = (
    <>
      <div className="knowledge-hub__card-bg" aria-hidden />
      <KnowledgeIconSvg id={item.icon} className="knowledge-hub__card-icon" />
      <div className="knowledge-hub__card-body">
        {item.comingSoon ? (
          <span className="knowledge-hub__badge">{badgeLabel}</span>
        ) : (
          <span className="knowledge-hub__badge knowledge-hub__badge--live">{badgeLabel}</span>
        )}
        <h3 className="knowledge-hub__card-title">{item.title || 'Título'}</h3>
        <p className="knowledge-hub__card-subtitle">{item.subtitle || 'Subtítulo'}</p>
      </div>
      {isLink ? (
        <span className="knowledge-hub__card-action" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </span>
      ) : null}
      {isMedia ? (
        <span className="knowledge-hub__card-action" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </span>
      ) : null}
    </>
  );

  const className = `knowledge-hub__card knowledge-hub__card--custom${!isInteractive && !preview ? ' knowledge-hub__card--disabled' : ''}${isMedia ? ' knowledge-hub__card--media' : ''}`;
  const style = cardStyleVars(item);

  if (isLink) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {inner}
      </a>
    );
  }

  if (isMedia) {
    return (
      <button type="button" onClick={() => onOpenMedia?.(item)} className={className} style={style}>
        {inner}
      </button>
    );
  }

  return (
    <div className={className} style={style} aria-disabled={!preview}>
      {inner}
    </div>
  );
}

function KnowledgeMediaViewer({ item, onClose }) {
  if (!item?.mediaUrl) return null;

  const title = item.title || item.mediaFilename || 'Contenido multimedia';
  const mimetype = item.mediaMimetype || '';

  return createPortal(
    <div className="knowledge-hub-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="knowledge-hub-modal knowledge-hub-media-viewer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-media-title"
      >
        <header className="knowledge-hub-modal__head">
          <div className="min-w-0">
            <h2 id="knowledge-media-title" className="knowledge-hub-modal__title truncate">
              {title}
            </h2>
            {item.mediaFilename ? (
              <p className="knowledge-hub-media-viewer__filename">{item.mediaFilename}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="knowledge-hub-modal__close" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="knowledge-hub-media-viewer__body">
          {isImageMime(mimetype) ? (
            <img src={item.mediaUrl} alt={title} className="knowledge-hub-media-viewer__image" />
          ) : isVideoMime(mimetype) ? (
            <video
              src={item.mediaUrl}
              controls
              playsInline
              className="knowledge-hub-media-viewer__video"
            >
              Tu navegador no puede reproducir este video.
            </video>
          ) : isPdfMime(mimetype) ? (
            <iframe
              src={item.mediaUrl}
              title={title}
              className="knowledge-hub-media-viewer__iframe"
            />
          ) : (
            <div className="knowledge-hub-media-viewer__fallback">
              <p>Vista previa no disponible para este formato.</p>
              <a
                href={item.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="knowledge-hub-modal__btn knowledge-hub-modal__btn--primary"
              >
                Abrir o descargar archivo
              </a>
            </div>
          )}
        </div>
        <div className="knowledge-hub-media-viewer__footer">
          <a
            href={item.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="knowledge-hub-modal__btn knowledge-hub-modal__btn--secondary"
          >
            Abrir en pestaña nueva
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function KnowledgeFormModal({ open, mode, initialItem, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' ? itemToForm(initialItem) : emptyForm());
      setError('');
    }
  }, [open, mode, initialItem]);

  const previewItem = useMemo(
    () => ({
      title: form.title || 'Título de ejemplo',
      subtitle: form.subtitle || 'Descripción del acceso',
      href: form.comingSoon || form.contentType === 'media' ? null : form.href || 'https://',
      contentType: form.comingSoon ? 'link' : form.contentType,
      mediaUrl: form.comingSoon || form.contentType !== 'media' ? null : form.mediaUrl || '/api/uploads/preview',
      available: !form.comingSoon,
      comingSoon: form.comingSoon,
      icon: form.icon,
      bg_color: form.bg_color,
      bg_color_end: form.bg_color_end,
      text_color: form.text_color,
      subtext_color: form.subtext_color,
      icon_color: form.icon_color,
      badge_bg: form.badge_bg,
      badge_text: form.badge_text,
    }),
    [form],
  );

  if (!open) return null;

  const applyPreset = (presetId) => {
    const preset = colorsFromPreset(presetId);
    setForm((f) => ({
      ...f,
      preset: presetId,
      icon: preset.icon,
      bg_color: preset.bg_color,
      bg_color_end: preset.bg_color_end,
      text_color: preset.text_color,
      subtext_color: preset.subtext_color,
      icon_color: preset.icon_color,
      badge_bg: preset.badge_bg,
      badge_text: preset.badge_text,
    }));
  };

  const handleMediaSelect = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm((f) => ({
      ...f,
      contentType: 'media',
      comingSoon: false,
      mediaFile: file,
      mediaFilename: file.name,
      mediaMimetype: file.type,
      mediaPath: '',
      mediaUrl: previewUrl,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let mediaPath = form.mediaPath;
      let mediaFilename = form.mediaFilename;
      let mediaMimetype = form.mediaMimetype;

      if (!form.comingSoon && form.contentType === 'media') {
        if (form.mediaFile) {
          const fd = new FormData();
          fd.append('file', form.mediaFile);
          const { data } = await axios.post('/api/knowledge/media', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          mediaPath = data.media_path;
          mediaFilename = data.media_filename;
          mediaMimetype = data.media_mimetype;
        } else if (!mediaPath) {
          setError('Sube un archivo, imagen o video.');
          setSaving(false);
          return;
        }
      }

      const payload = buildPayload({
        ...form,
        mediaPath,
        mediaFilename,
        mediaMimetype,
      });

      if (mode === 'edit' && initialItem?.dbId) {
        await axios.put(`/api/knowledge/${initialItem.dbId}`, payload);
      } else {
        await axios.post('/api/knowledge', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo guardar el acceso.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="knowledge-hub-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="knowledge-hub-modal knowledge-hub-modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-form-title"
      >
        <header className="knowledge-hub-modal__head">
          <h2 id="knowledge-form-title" className="knowledge-hub-modal__title">
            {mode === 'edit' ? 'Editar acceso directo' : 'Nuevo acceso directo'}
          </h2>
          <button type="button" onClick={onClose} className="knowledge-hub-modal__close" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form className="knowledge-hub-modal__body" onSubmit={handleSubmit}>
          <div className="knowledge-hub-modal__preview-wrap">
            <p className="knowledge-hub-modal__section-label">Vista previa</p>
            <KnowledgeCardContent item={previewItem} preview />
          </div>

          <label className="knowledge-hub-modal__field">
            <span>Título</span>
            <input
              type="text"
              required
              maxLength={80}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej. Proyectos BOSA"
            />
          </label>

          <label className="knowledge-hub-modal__field">
            <span>Subtítulo</span>
            <input
              type="text"
              required
              maxLength={120}
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              placeholder="Ej. Carpeta compartida · documentos"
            />
          </label>

          <div className="knowledge-hub-modal__section">
            <p className="knowledge-hub-modal__section-label">Icono</p>
            <div className="knowledge-hub-icon-picker" role="listbox" aria-label="Elegir icono">
              {KNOWLEDGE_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  role="option"
                  aria-selected={form.icon === icon.id}
                  title={icon.label}
                  className={`knowledge-hub-icon-picker__btn${form.icon === icon.id ? ' knowledge-hub-icon-picker__btn--active' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, icon: icon.id }))}
                >
                  <KnowledgeIconSvg id={icon.id} className="knowledge-hub-icon-picker__svg" />
                  <span className="knowledge-hub-icon-picker__label">{icon.label.split(' / ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="knowledge-hub-modal__section">
            <p className="knowledge-hub-modal__section-label">Paleta rápida</p>
            <div className="knowledge-hub-preset-picker">
              {KNOWLEDGE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  className={`knowledge-hub-preset-picker__btn${form.preset === preset.id ? ' knowledge-hub-preset-picker__btn--active' : ''}`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <span
                    className="knowledge-hub-preset-picker__swatch"
                    style={{ background: `linear-gradient(135deg, ${preset.bg_color_end}, ${preset.bg_color})` }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="knowledge-hub-modal__section">
            <p className="knowledge-hub-modal__section-label">Colores personalizados</p>
            <div className="knowledge-hub-color-grid">
              {[
                { key: 'bg_color_end', label: 'Fondo claro' },
                { key: 'bg_color', label: 'Fondo oscuro' },
                { key: 'text_color', label: 'Título' },
                { key: 'subtext_color', label: 'Subtítulo' },
                { key: 'icon_color', label: 'Icono decorativo' },
                { key: 'badge_bg', label: 'Fondo etiqueta' },
                { key: 'badge_text', label: 'Texto etiqueta' },
              ].map(({ key, label }) => (
                <label key={key} className="knowledge-hub-color-field">
                  <span>{label}</span>
                  <div className="knowledge-hub-color-field__row">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(form[key]) ? form[key] : '#071221'}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value, preset: 'custom' }))}
                      className="knowledge-hub-color-field__picker"
                    />
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value, preset: 'custom' }))}
                      className="knowledge-hub-color-field__text"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="knowledge-hub-modal__section">
            <p className="knowledge-hub-modal__section-label">Tipo de acceso</p>
            <div className="knowledge-hub-type-picker" role="radiogroup" aria-label="Tipo de acceso">
              {[
                { value: 'link', label: 'Enlace externo', hint: 'Abre una URL en nueva pestaña' },
                { value: 'media', label: 'Archivo o multimedia', hint: 'Imagen, video o documento alojado en BOSA Hub' },
              ].map((opt) => {
                const selected = !form.comingSoon && form.contentType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={form.comingSoon}
                    className={`knowledge-hub-type-picker__btn${selected ? ' knowledge-hub-type-picker__btn--active' : ''}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        comingSoon: false,
                        contentType: opt.value,
                      }))
                    }
                  >
                    <span className="knowledge-hub-type-picker__label">{opt.label}</span>
                    <span className="knowledge-hub-type-picker__hint">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="knowledge-hub-modal__check">
            <input
              type="checkbox"
              checked={form.comingSoon}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  comingSoon: e.target.checked,
                  contentType: 'link',
                }))
              }
            />
            <span>Marcar como próximamente (sin contenido aún)</span>
          </label>

          {!form.comingSoon && form.contentType === 'link' ? (
            <label className="knowledge-hub-modal__field">
              <span>URL del enlace</span>
              <input
                type="url"
                required
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="https://..."
              />
            </label>
          ) : null}

          {!form.comingSoon && form.contentType === 'media' ? (
            <div className="knowledge-hub-modal__section">
              <p className="knowledge-hub-modal__section-label">Archivo multimedia</p>
              <label className="knowledge-hub-media-upload">
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  className="hidden"
                  onChange={(e) => {
                    handleMediaSelect(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <span className="knowledge-hub-media-upload__btn">Elegir archivo</span>
                <span className="knowledge-hub-media-upload__hint">
                  Imágenes, videos, PDF y documentos · máx. 80 MB
                </span>
              </label>
              {form.mediaFilename ? (
                <p className="knowledge-hub-media-upload__name">
                  {form.mediaFile ? 'Nuevo: ' : 'Actual: '}
                  {form.mediaFilename}
                </p>
              ) : null}
              {form.mediaUrl && isImageMime(form.mediaMimetype) ? (
                <img src={form.mediaUrl} alt="" className="knowledge-hub-media-upload__preview" />
              ) : null}
              {form.mediaUrl && isVideoMime(form.mediaMimetype) ? (
                <video src={form.mediaUrl} controls className="knowledge-hub-media-upload__preview" />
              ) : null}
            </div>
          ) : null}

          {error ? <p className="knowledge-hub-modal__error">{error}</p> : null}

          <div className="knowledge-hub-modal__actions">
            <button type="button" onClick={onClose} className="knowledge-hub-modal__btn knowledge-hub-modal__btn--secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="knowledge-hub-modal__btn knowledge-hub-modal__btn--primary">
              {saving ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Crear acceso'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function KnowledgeCardWrap({ item, isSuperadmin, onEdit, onDelete, onOpenMedia }) {
  return (
    <div className="knowledge-hub__card-wrap">
      {isSuperadmin ? (
        <div className="knowledge-hub__card-admin">
          <button type="button" onClick={() => onEdit(item)} className="knowledge-hub__card-admin-btn" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button type="button" onClick={() => onDelete(item)} className="knowledge-hub__card-admin-btn knowledge-hub__card-admin-btn--danger" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      ) : null}
      <KnowledgeCardContent item={item} onOpenMedia={onOpenMedia} />
    </div>
  );
}

export default function KnowledgeModule() {
  const { user } = useAuth();
  const isSuperadmin = isSuperadminUser(user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingItem, setEditingItem] = useState(null);
  const [mediaViewerItem, setMediaViewerItem] = useState(null);

  const fetchItems = async () => {
    try {
      const { data } = await axios.get('/api/knowledge');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setFormMode('create');
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setFormMode('edit');
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleDelete = async (item) => {
    if (!item?.dbId) return;
    if (!confirm(`¿Eliminar "${item.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/knowledge/${item.dbId}`);
      await fetchItems();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo eliminar el acceso.');
    }
  };

  return (
    <div className="knowledge-hub">
      <header className="knowledge-hub__header">
        <div className="knowledge-hub__header-row">
          <div>
            <p className="knowledge-hub__eyebrow">Centro de recursos</p>
            <h1 className="knowledge-hub__title">Knowledge</h1>
          </div>
          {isSuperadmin ? (
            <button type="button" onClick={openCreate} className="knowledge-hub__add-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar acceso
            </button>
          ) : null}
        </div>
        <p className="knowledge-hub__intro">
          Accesos rápidos a herramientas y materiales de BOSA. Abre enlaces externos o visualiza archivos e imágenes alojados aquí.
        </p>
      </header>

      {loading ? (
        <p className="knowledge-hub__loading">Cargando accesos…</p>
      ) : (
        <div className="knowledge-hub__grid">
          {items.map((item) => (
            <KnowledgeCardWrap
              key={item.dbId || item.id}
              item={item}
              isSuperadmin={isSuperadmin}
              onEdit={openEdit}
              onDelete={handleDelete}
              onOpenMedia={setMediaViewerItem}
            />
          ))}
        </div>
      )}

      <KnowledgeFormModal
        open={formOpen}
        mode={formMode}
        initialItem={editingItem}
        onClose={() => setFormOpen(false)}
        onSaved={fetchItems}
      />

      <KnowledgeMediaViewer item={mediaViewerItem} onClose={() => setMediaViewerItem(null)} />
    </div>
  );
}
