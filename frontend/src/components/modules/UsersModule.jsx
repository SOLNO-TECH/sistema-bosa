import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import { useCatalog } from '../../hooks/useCatalog';
import { roleLabelFromCatalog, roleBadgeClass } from '../../utils/catalog';
import { DepartmentModal, RoleModal } from './CatalogModals';
import BosaGoldButton from '../BosaGoldButton';

export default function UsersModule() {
  const { departments, roles, refresh: refreshCatalog } = useCatalog();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newRoleForm, setNewRoleForm] = useState({ label: '', permission_level: 'manager' });
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({});
  const [passwordData, setPasswordData] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/api/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const isEdit = !!editingUser;
    try {
      if (isEdit) {
        await axios.put(`/api/users/${editingUser.id}`, formData);
      } else {
        await axios.post('/api/users', formData);
      }
      setIsFormOpen(false);
      fetchUsers();
      const fullName = `${formData.name || ''} ${formData.apellido || ''}`.trim() || 'Usuario';
      if (isEdit) PushEvents.userUpdated(fullName); else PushEvents.userCreated(fullName);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message;
      console.error('Error:', err);
      alert(`Error al guardar usuario: ${msg}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar permanentemente este usuario? Se borrarán también sus tickets, tareas, reuniones, minutas, mensajes de foro, avisos y notificaciones vinculados. Los datos de otros usuarios no se modificarán.')) return;
    try {
      const target = users.find(u => u.id === id);
      await axios.delete(`/api/users/${id}`);
      fetchUsers();
      PushEvents.userDeleted(target ? `${target.name} ${target.apellido || ''}`.trim() : `ID ${id}`);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Error eliminando usuario: ${msg}`);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/users/${editingUser.id}/password`, { password: passwordData });
      setIsPasswordOpen(false);
      setPasswordData('');
      alert('Contraseña actualizada exitosamente');
      PushEvents.passwordChanged();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message;
      console.error('Error:', err);
      alert(`Error cambiando contraseña: ${msg}`);
    }
  };

  const closeUserForm = () => setIsFormOpen(false);

  const closePasswordModal = () => {
    setIsPasswordOpen(false);
    setPasswordData('');
  };

  const submitNewDepartment = async (e) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;
    setCatalogSaving(true);
    try {
      await axios.post('/api/catalog/departments', { name });
      setNewDeptName('');
      setIsDeptModalOpen(false);
      await refreshCatalog();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo crear el departamento');
    } finally {
      setCatalogSaving(false);
    }
  };

  const submitNewRole = async (e) => {
    e.preventDefault();
    const label = newRoleForm.label.trim();
    if (!label) return;
    setCatalogSaving(true);
    try {
      await axios.post('/api/catalog/roles', {
        label,
        permission_level: newRoleForm.permission_level,
      });
      setNewRoleForm({ label: '', permission_level: 'manager' });
      setIsRoleModalOpen(false);
      await refreshCatalog();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo crear el rol');
    } finally {
      setCatalogSaving(false);
    }
  };

  const roleMeta = (slug) => roles.find((r) => r.slug === slug);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display font-medium text-navy-950 text-xl sm:text-2xl">Gestión de Usuarios</h3>
          <p className="font-sans text-navy-600 text-sm mt-1">Administra los accesos y roles del sistema operativo BOSA.</p>
        </div>
        <BosaGoldButton
          icon="user"
          onClick={() => { setEditingUser(null); setFormData({}); setIsFormOpen(true); }}
          className="self-end sm:!w-auto sm:self-auto"
          aria-label="Nuevo usuario"
        >
          <span className="sm:hidden">Nuevo</span>
          <span className="hidden sm:inline">Nuevo usuario</span>
        </BosaGoldButton>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo o puesto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 transition-all bg-gray-50 hover:bg-white shadow-inner"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsDeptModalOpen(true)}
            className="px-3 py-2.5 rounded-lg border border-gold/40 bg-gold/10 text-[10px] font-bold uppercase tracking-wide text-navy-950 hover:bg-gold/20 transition-all"
          >
            + Departamento
          </button>
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="px-3 py-2.5 rounded-lg border border-navy-200 bg-navy-50 text-[10px] font-bold uppercase tracking-wide text-navy-900 hover:bg-navy-100 transition-all"
          >
            + Rol
          </button>
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none"
          >
            <option value="">Todos los roles</option>
            {roles.map((r) => (
              <option key={r.slug} value={r.slug}>{r.label}</option>
            ))}
          </select>
          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none"
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* VISTA ESCRITORIO: tabla */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Usuario</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Contacto</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Posición</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Rol</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-10 text-center text-navy-500 font-medium">Cargando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-10 text-center text-navy-500 font-medium">No hay usuarios registrados</td></tr>
              ) : (
                users.filter(u => {
                  const matchesSearch = (u.name + ' ' + u.apellido + ' ' + u.email + ' ' + u.puesto).toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesRole = filterRole ? u.role === filterRole : true;
                  const matchesDept = filterDept ? u.departamento === filterDept : true;
                  return matchesSearch && matchesRole && matchesDept;
                }).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-navy-950">{u.name} {u.apellido}</p>
                      <p className="text-navy-500 text-xs mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-6 py-4"><p className="text-navy-700 font-medium">{u.telefono || '—'}</p></td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-navy-800">{u.departamento || '—'}</p>
                      <p className="text-navy-500 text-xs mt-0.5 font-medium">{u.puesto || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`role-badge ${roleBadgeClass(u.role, roleMeta(u.role)?.permission_level)}`}>
                        {roleLabelFromCatalog(u.role, roles)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditingUser(u); setIsPasswordOpen(true); }} className="px-3 py-1.5 rounded-sm bg-white border border-gray-200 text-navy-600 hover:border-gold hover:text-gold transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                          Clave
                        </button>
                        <button onClick={() => { setEditingUser(u); setFormData(u); setIsFormOpen(true); }} className="px-3 py-1.5 rounded-sm bg-white border border-gray-200 text-navy-600 hover:border-gold hover:text-gold transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                          Editar
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="px-3 py-1.5 rounded-sm bg-white border border-gray-200 text-red-500 hover:border-red-600 hover:bg-red-50 transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* VISTA MÓVIL: tarjetas */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <p className="p-6 text-center text-navy-500 font-medium">Cargando...</p>
          ) : users.filter(u => {
            const matchesSearch = (u.name + ' ' + u.apellido + ' ' + u.email + ' ' + u.puesto).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole ? u.role === filterRole : true;
            const matchesDept = filterDept ? u.departamento === filterDept : true;
            return matchesSearch && matchesRole && matchesDept;
          }).map(u => (
            <div key={u.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold border-2 border-gold/30 flex-shrink-0">
                    {u.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-navy-950 truncate">{u.name} {u.apellido}</p>
                    <p className="text-navy-500 text-xs truncate">{u.email}</p>
                  </div>
                </div>
                <span className={`role-badge flex-shrink-0 ${roleBadgeClass(u.role, roleMeta(u.role)?.permission_level)}`}>
                  {roleLabelFromCatalog(u.role, roles)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Departamento</p>
                  <p className="font-bold text-navy-800">{u.departamento || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Puesto</p>
                  <p className="font-bold text-navy-800">{u.puesto || '—'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingUser(u); setIsPasswordOpen(true); }} className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-navy-600 hover:border-gold hover:text-gold transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm">
                  Clave
                </button>
                <button onClick={() => { setEditingUser(u); setFormData(u); setIsFormOpen(true); }} className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-navy-600 hover:border-gold hover:text-gold transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm">
                  Editar
                </button>
                <button onClick={() => handleDelete(u.id)} className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:border-red-600 hover:bg-red-50 transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm">
                  Borrar
                </button>
              </div>
            </div>
          ))}
          <div className="h-32 md:hidden" />
        </div>
      </div>

      {/* Form Modal */}
      {isFormOpen &&
        createPortal(
          <div className="meeting-sheet-overlay z-[120] animate-fade-in" onClick={closeUserForm} role="presentation">
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-form-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Accesos BOSA</span>
                    <h3 id="user-form-title" className="meeting-sheet__hero-title mt-2">
                      {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      {editingUser
                        ? 'Actualiza datos de contacto, área y rol.'
                        : 'Alta de colaborador con correo de acceso y contraseña inicial.'}
                    </p>
                  </div>
                  <button type="button" onClick={closeUserForm} className="meeting-sheet__close" aria-label="Cerrar">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave} autoComplete="off">
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                  <p className="meeting-sheet__section-label">Datos personales</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Nombre</label>
                      <input
                        required
                        type="text"
                        autoComplete="off"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="meeting-sheet__input font-semibold"
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Apellido</label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={formData.apellido || ''}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        className="meeting-sheet__input"
                        placeholder="Apellido(s)"
                      />
                    </div>
                  </div>

                  <p className="meeting-sheet__section-label">Contacto</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Correo (inicio de sesión)</label>
                      <input
                        required
                        type="email"
                        autoComplete="off"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="meeting-sheet__input"
                        placeholder="correo@empresa.com"
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Teléfono</label>
                      <input
                        type="tel"
                        autoComplete="off"
                        value={formData.telefono || ''}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className="meeting-sheet__input"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <p className="meeting-sheet__section-label">Organización y rol</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Departamento</label>
                      <select
                        required
                        value={formData.departamento || ''}
                        onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                        className="meeting-sheet__select"
                      >
                        <option value="" disabled>
                          Seleccione departamento…
                        </option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Puesto</label>
                      <select
                        value={formData.puesto || ''}
                        onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                        className="meeting-sheet__select"
                      >
                        <option value="">Seleccione un puesto</option>
                        <option value="Gerente">Gerente</option>
                        <option value="Sub-Gerente">Sub-Gerente</option>
                        <option value="Coordinador">Coordinador</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Auxiliar">Auxiliar</option>
                        <option value="Asistente">Asistente</option>
                        <option value="Analista">Analista</option>
                        <option value="Técnico">Técnico</option>
                        <option value="Operativo">Operativo</option>
                      </select>
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Rol</label>
                      <select
                        required
                        value={formData.role || ''}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="meeting-sheet__select"
                      >
                        <option value="" disabled>
                          Seleccione un rol…
                        </option>
                        {roles.map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.label}
                            {r.permission_level === 'manager' ? ' (coordina departamento)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!editingUser && (
                    <>
                      <p className="meeting-sheet__section-label">Contraseña inicial</p>
                      <div className="meeting-sheet__group">
                        <div className="meeting-sheet__cell meeting-sheet__cell--field">
                          <label className="meeting-sheet__cell-label">Contraseña</label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              required
                              type="text"
                              autoComplete="new-password"
                              value={formData.password || ''}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="meeting-sheet__input min-w-0 flex-1 font-mono text-[14px]"
                              placeholder="Mínimo recomendado: 12 caracteres"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, password: generatePassword() })}
                              className="meeting-sheet__btn meeting-sheet__btn--secondary shrink-0 px-4 py-2.5 text-[14px] sm:self-stretch"
                            >
                              Generar
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                    <button
                      type="button"
                      onClick={closeUserForm}
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
                    <button type="submit" className="voice-minute-footer__btn voice-minute-footer__btn--primary">
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
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Password Modal */}
      {isPasswordOpen &&
        createPortal(
          <div className="meeting-sheet-overlay z-[125] animate-fade-in" onClick={closePasswordModal} role="presentation">
            <div
              className="meeting-sheet meeting-sheet--form animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-password-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Seguridad</span>
                    <h3 id="user-password-title" className="meeting-sheet__hero-title mt-2">
                      Cambiar contraseña
                    </h3>
                    <p className="meeting-sheet__hero-subtitle truncate" title={editingUser?.email}>
                      {editingUser?.email}
                    </p>
                  </div>
                  <button type="button" onClick={closePasswordModal} className="meeting-sheet__close" aria-label="Cerrar">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleChangePassword} autoComplete="off">
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Nueva contraseña</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          required
                          type="text"
                          autoComplete="new-password"
                          value={passwordData}
                          onChange={(e) => setPasswordData(e.target.value)}
                          className="meeting-sheet__input min-w-0 flex-1 font-mono text-[14px]"
                          placeholder="Nueva clave"
                        />
                        <button
                          type="button"
                          onClick={() => setPasswordData(generatePassword())}
                          className="meeting-sheet__btn meeting-sheet__btn--secondary shrink-0 px-4 py-2.5 text-[14px]"
                        >
                          Generar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="meeting-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions">
                    <button type="button" onClick={closePasswordModal} className="meeting-sheet__btn meeting-sheet__btn--secondary">
                      Cancelar
                    </button>
                    <button type="submit" className="meeting-sheet__btn meeting-sheet__btn--primary">
                      Actualizar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      <DepartmentModal
        open={isDeptModalOpen}
        name={newDeptName}
        saving={catalogSaving}
        onClose={() => setIsDeptModalOpen(false)}
        onChange={setNewDeptName}
        onSubmit={submitNewDepartment}
      />
      <RoleModal
        open={isRoleModalOpen}
        form={newRoleForm}
        saving={catalogSaving}
        onClose={() => setIsRoleModalOpen(false)}
        onChange={setNewRoleForm}
        onSubmit={submitNewRole}
      />
    </div>
  );
}
