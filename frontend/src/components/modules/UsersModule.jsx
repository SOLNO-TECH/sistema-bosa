import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum'
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-navy-950 placeholder:text-slate-400 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 transition-colors';

const sectionTitle = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400';

function userRoleLabel(role) {
  if (role === 'superadmin') return 'Super Admin';
  if (role === 'manager') return 'Gerente';
  return 'Administrador';
}

function userRoleBadgeClass(role) {
  if (role === 'superadmin') return 'border-gold text-gold font-bold';
  if (role === 'manager') return 'border-navy-400 text-navy-800 font-bold';
  return 'border-gray-200 text-navy-700 font-bold';
}

export default function UsersModule() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
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
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este usuario?')) return;
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-medium text-navy-950 text-2xl">Gestión de Usuarios</h3>
          <p className="font-sans text-navy-600 text-sm mt-1">Administra los accesos y roles del sistema operativo BOSA.</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setFormData({}); setIsFormOpen(true); }}
          className="btn-gold flex items-center gap-2 shadow-md"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Usuario
        </button>
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
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none"
          >
            <option value="">Todos los roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="administrator">Administrador</option>
            <option value="manager">Gerente</option>
          </select>
          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none"
          >
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
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
                      <span className={`role-badge ${userRoleBadgeClass(u.role)}`}>
                        {userRoleLabel(u.role)}
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
                <span className={`role-badge flex-shrink-0 ${userRoleBadgeClass(u.role)}`}>
                  {userRoleLabel(u.role)}
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
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={closeUserForm}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-form-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                    <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Accesos BOSA</p>
                      <h2 id="user-form-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                        {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
                      </h2>
                      <p className="mt-1.5 text-sm text-white/55">
                        {editingUser ? 'Actualiza datos de contacto, área y rol.' : 'Alta de colaborador con correo de acceso y contraseña inicial.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeUserForm}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave} autoComplete="off">
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
                  <section>
                    <h3 className={sectionTitle}>Datos personales</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre *</span>
                        <input
                          required
                          type="text"
                          autoComplete="off"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={inputClass}
                          placeholder="Nombre"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Apellido</span>
                        <input
                          type="text"
                          autoComplete="off"
                          value={formData.apellido || ''}
                          onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                          className={inputClass}
                          placeholder="Apellido(s)"
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h3 className={sectionTitle}>Contacto</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Correo (inicio de sesión) *</span>
                        <input
                          required
                          type="email"
                          autoComplete="off"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={inputClass}
                          placeholder="correo@empresa.com"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Teléfono</span>
                        <input
                          type="tel"
                          autoComplete="off"
                          value={formData.telefono || ''}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          className={inputClass}
                          placeholder="Opcional"
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h3 className={sectionTitle}>Organización y rol</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Departamento *</span>
                        <select
                          required
                          value={formData.departamento || ''}
                          onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                          className={`${inputClass} h-[46px] cursor-pointer`}
                        >
                          <option value="" disabled>
                            Seleccione departamento…
                          </option>
                          {DEPARTAMENTOS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Puesto</span>
                        <select
                          value={formData.puesto || ''}
                          onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                          className={`${inputClass} h-[46px] cursor-pointer`}
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
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Rol *</span>
                        <select
                          required
                          value={formData.role || ''}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className={`${inputClass} h-[46px] cursor-pointer`}
                        >
                          <option value="" disabled>
                            Seleccione un rol…
                          </option>
                          <option value="administrator">Administrador</option>
                          <option value="manager">Gerente (coordina tickets de su departamento)</option>
                          <option value="superadmin">Super Administrador</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  {!editingUser && (
                    <section>
                      <h3 className={sectionTitle}>Contraseña inicial</h3>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Contraseña *</span>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            required
                            type="text"
                            autoComplete="new-password"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
                            placeholder="Mínimo recomendado: 12 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, password: generatePassword() })}
                            className="shrink-0 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/15 sm:self-stretch"
                          >
                            Generar
                          </button>
                        </div>
                      </label>
                    </section>
                  )}
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                  <button
                    type="button"
                    onClick={closeUserForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 sm:min-w-[10rem]"
                  >
                    {!editingUser && (
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Password Modal */}
      {isPasswordOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={closePasswordModal}
            role="presentation"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-password-title"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-5 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Seguridad</p>
                    <h2 id="user-password-title" className="mt-1.5 font-display text-lg font-medium text-white sm:text-xl">
                      Cambiar contraseña
                    </h2>
                    <p className="mt-1 truncate text-sm text-white/50" title={editingUser?.email}>
                      {editingUser?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <form className="p-6 sm:p-8" onSubmit={handleChangePassword} autoComplete="off">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nueva contraseña *</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      required
                      type="text"
                      autoComplete="new-password"
                      value={passwordData}
                      onChange={(e) => setPasswordData(e.target.value)}
                      className={`${inputClass} min-w-0 flex-1 font-mono text-sm`}
                      placeholder="Nueva clave"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordData(generatePassword())}
                      className="shrink-0 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/15"
                    >
                      Generar
                    </button>
                  </div>
                </label>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 sm:min-w-[9rem]"
                  >
                    Actualizar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
