import { useState, useEffect } from 'react';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum'
];

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-medium text-navy-950 text-2xl">Gestión de Usuarios</h3>
          <p className="font-sans text-navy-600 text-sm mt-1">Administra los accesos y roles del sistema operativo BOSA.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setFormData({}); setIsFormOpen(true); }}
          className="btn-gold"
        >
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
                      <span className={`role-badge ${u.role === 'superadmin' ? 'border-gold text-gold font-bold' : 'border-gray-200 text-navy-700 font-bold'}`}>
                        {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
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
                <span className={`role-badge flex-shrink-0 ${u.role === 'superadmin' ? 'border-gold text-gold font-bold' : 'border-gray-200 text-navy-700 font-bold'}`}>
                  {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
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
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="bg-white rounded-sm w-full max-w-2xl shadow-card-lg overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-display font-medium text-navy-950 text-xl">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5" autoComplete="off">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Nombre *</label>
                  <input required type="text" autoComplete="off" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Apellido</label>
                  <input type="text" autoComplete="off" value={formData.apellido || ''} onChange={e => setFormData({...formData, apellido: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Correo (Login) *</label>
                  <input required type="email" autoComplete="off" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Teléfono</label>
                  <input type="tel" autoComplete="off" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Departamento *</label>
                  <select required value={formData.departamento || ''} onChange={e => setFormData({...formData, departamento: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm h-[46px]">
                    <option value="" disabled>Seleccione departamento...</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Puesto</label>
                  <select value={formData.puesto || ''} onChange={e => setFormData({...formData, puesto: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm appearance-none">
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

                <div className="space-y-1.5 col-span-2">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Rol *</label>
                  <select required value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm h-[46px]">
                    <option value="" disabled>Seleccione un rol...</option>
                    <option value="administrator">Administrador</option>
                    <option value="superadmin">Super Administrador</option>
                  </select>
                </div>
                {!editingUser && (
                  <div className="space-y-1.5 col-span-2">
                    <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Contraseña Inicial *</label>
                    <div className="flex gap-2">
                      <input required type="text" autoComplete="new-password" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm flex-1" />
                      <button type="button" onClick={() => setFormData({...formData, password: generatePassword()})} className="btn-outline !px-4 !text-gold !border-gold hover:!bg-gold/10">Generar</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} className="btn-outline !px-6 !text-navy-700 !border-gray-300 hover:!bg-gray-50">Cancelar</button>
                <button type="submit" className="btn-gold !px-8">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="bg-white rounded-sm w-full max-w-md shadow-card-lg overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-display font-medium text-navy-950 text-xl">Cambiar Contraseña</h3>
                <p className="text-navy-600 text-xs mt-1">Usuario: {editingUser?.email}</p>
              </div>
              <button onClick={() => setIsPasswordOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-5" autoComplete="off">
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Nueva Contraseña *</label>
                <div className="flex gap-2">
                  <input required type="text" autoComplete="new-password" value={passwordData} onChange={e => setPasswordData(e.target.value)} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm flex-1" />
                  <button type="button" onClick={() => setPasswordData(generatePassword())} className="btn-outline !px-4 !text-gold !border-gold hover:!bg-gold/10">Generar</button>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsPasswordOpen(false)} className="btn-outline !px-6 !text-navy-700 !border-gray-300 hover:!bg-gray-50">Cancelar</button>
                <button type="submit" className="btn-gold !px-6">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
