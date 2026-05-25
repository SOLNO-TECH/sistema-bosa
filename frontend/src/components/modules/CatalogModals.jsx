import { createPortal } from 'react-dom';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-navy-950 placeholder:text-slate-400 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 transition-colors';

const PERMISSION_LEVEL_OPTIONS = [
  { value: 'administrator', label: 'Administrador (acceso amplio)' },
  { value: 'manager', label: 'Gerente (coordina su departamento)' },
  { value: 'user', label: 'Usuario básico (acceso limitado)' },
];

export function DepartmentModal({ open, name, saving, onClose, onChange, onSubmit }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[106] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-navy-950 px-5 py-4">
          <h3 className="text-lg font-display text-white">Nuevo departamento</h3>
          <p className="text-xs text-white/60 mt-1">Aparecerá en usuarios, tickets, tareas y avisos.</p>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre *</span>
            <input required value={name} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="Ej. Logística" />
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-navy-700">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-gold text-[10px] py-2.5 px-5 uppercase font-bold">{saving ? 'Guardando…' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function RoleModal({ open, form, saving, onClose, onChange, onSubmit }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[106] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-navy-950 px-5 py-4">
          <h3 className="text-lg font-display text-white">Nuevo rol</h3>
          <p className="text-xs text-white/60 mt-1">Define permisos base; los usuarios existentes no se modifican.</p>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre del rol *</span>
            <input
              required
              value={form.label}
              onChange={(e) => onChange({ ...form, label: e.target.value })}
              className={inputClass}
              placeholder="Ej. Coordinador de obra"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nivel de permiso *</span>
            <select
              value={form.permission_level}
              onChange={(e) => onChange({ ...form, permission_level: e.target.value })}
              className={`${inputClass} h-[46px] cursor-pointer`}
            >
              {PERMISSION_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-navy-700">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-gold text-[10px] py-2.5 px-5 uppercase font-bold">{saving ? 'Guardando…' : 'Crear rol'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
