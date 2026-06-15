import { createPortal } from 'react-dom';

const PERMISSION_LEVEL_OPTIONS = [
  { value: 'administrator', label: 'Administrador (acceso amplio)' },
  { value: 'manager', label: 'Gerente (coordina su departamento)' },
  { value: 'user', label: 'Usuario básico (acceso limitado)' },
];

function CatalogSheetFooter({ saving, onClose, submitLabel }) {
  return (
    <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
      <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="voice-minute-footer__btn voice-minute-footer__btn--secondary disabled:cursor-not-allowed disabled:opacity-50"
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
          {saving ? (
            <>
              <span
                className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                aria-hidden
              />
              Guardando…
            </>
          ) : (
            <>
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
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function DepartmentModal({ open, name, saving, onClose, onChange, onSubmit }) {
  if (!open) return null;
  return createPortal(
    <div
      className="meeting-sheet-overlay z-[120] animate-fade-in"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dept-modal-title"
      >
        <div className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="meeting-sheet__pill meeting-sheet__pill--gold">Catálogo</span>
              <h3 id="dept-modal-title" className="meeting-sheet__hero-title mt-2">
                Nuevo departamento
              </h3>
              <p className="meeting-sheet__hero-subtitle">
                Aparecerá en usuarios, tickets, tareas y avisos del sistema.
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form className="meeting-sheet__form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={onSubmit}>
          <div className="meeting-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form flex-1 min-h-0">
              <p className="meeting-sheet__section-label">Datos del departamento</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label" htmlFor="catalog-dept-name">
                    Nombre
                  </label>
                  <input
                    id="catalog-dept-name"
                    required
                    value={name}
                    onChange={(e) => onChange(e.target.value)}
                    className="meeting-sheet__input font-semibold"
                    placeholder="Ej. Logística"
                  />
                  <p className="meeting-sheet__cell-note">
                    Usa el nombre oficial del área para mantener consistencia en reportes y filtros.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <CatalogSheetFooter saving={saving} onClose={onClose} submitLabel="Crear departamento" />
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function RoleModal({ open, form, saving, onClose, onChange, onSubmit }) {
  if (!open) return null;
  return createPortal(
    <div
      className="meeting-sheet-overlay z-[120] animate-fade-in"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
      >
        <div className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="meeting-sheet__pill meeting-sheet__pill--gold">Catálogo</span>
              <h3 id="role-modal-title" className="meeting-sheet__hero-title mt-2">
                Nuevo rol
              </h3>
              <p className="meeting-sheet__hero-subtitle">
                Define permisos base para asignar a nuevos usuarios. Los existentes no se modifican.
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form className="meeting-sheet__form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={onSubmit}>
          <div className="meeting-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form flex-1 min-h-0">
              <p className="meeting-sheet__section-label">Datos del rol</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label" htmlFor="catalog-role-name">
                    Nombre del rol
                  </label>
                  <input
                    id="catalog-role-name"
                    required
                    value={form.label}
                    onChange={(e) => onChange({ ...form, label: e.target.value })}
                    className="meeting-sheet__input font-semibold"
                    placeholder="Ej. Coordinador de obra"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label" htmlFor="catalog-role-level">
                    Nivel de permiso
                  </label>
                  <select
                    id="catalog-role-level"
                    value={form.permission_level}
                    onChange={(e) => onChange({ ...form, permission_level: e.target.value })}
                    className="meeting-sheet__select"
                  >
                    {PERMISSION_LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="meeting-sheet__cell-note">
                    El nivel define el alcance general del rol dentro de BOSA Hub.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <CatalogSheetFooter saving={saving} onClose={onClose} submitLabel="Crear rol" />
        </form>
      </div>
    </div>,
    document.body,
  );
}
