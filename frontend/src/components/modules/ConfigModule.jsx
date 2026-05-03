import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

export default function ConfigModule() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [notis, setNotis] = useState({ emailAlerts: true, systemAlerts: true, newLogins: false, weeklyReports: true });
  const [prefs, setPrefs] = useState({ language: 'es', timezone: 'America/Mexico_City', dateFormat: 'DD/MM/YYYY' });
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  const handleToggle = (key) => setNotis({ ...notis, [key]: !notis[key] });

  const runEmailTest = async () => {
    setTestLoading(true);
    setTestMsg(null);
    try {
      const res = await axios.post('/api/auth/test-email', { email: 'sistemas@bosa.mx' });
      setTestMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setTestMsg({ type: 'error', text: err.response?.data?.error || 'Error al conectar con SMTP' });
    } finally {
      setTestLoading(false);
    }
  };

  const tabs = [
    {
      id: 'profile', label: 'Perfil Personal',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
    },
    {
      id: 'notifications', label: 'Notificaciones',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
    },
    {
      id: 'preferences', label: 'Preferencias',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Configuración</h2>
        <p className="text-sm text-navy-600 mt-1">Administra tu perfil, preferencias y seguridad del sistema</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── MENÚ LATERAL ── */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Categorías</p>
            </div>
            <nav className="p-2 space-y-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-gold/10 text-gold'
                      : 'text-navy-600 hover:bg-gray-50 hover:text-navy-900'
                  }`}
                >
                  <span className={activeTab === tab.id ? 'text-gold' : 'text-gray-400'}>{tab.icon}</span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <svg className="w-4 h-4 ml-auto text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Sub-header */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gold">
              {tabs.find(t => t.id === activeTab)?.icon}
            </div>
            <div>
              <h3 className="font-display font-medium text-navy-950 text-lg">{tabs.find(t => t.id === activeTab)?.label}</h3>
              <p className="text-xs text-navy-500 font-medium">Gestiona tu configuración personal</p>
            </div>
          </div>

          <div className="p-6">

            {/* ── TAB PERFIL ── */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-6 animate-fade-in">
                {/* Avatar */}
                <div className="flex items-center gap-5 p-5 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-16 h-16 rounded-full bg-navy-900 text-white flex items-center justify-center text-2xl font-display shadow-md border-2 border-gold/30 flex-shrink-0">
                    {user?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-navy-950 text-sm">{user?.name}</p>
                    <p className="text-navy-500 text-xs mb-2">{user?.email}</p>
                    <button className="px-4 py-1.5 rounded-lg border border-gray-300 text-navy-600 hover:border-gold hover:text-gold transition-all text-xs font-bold uppercase tracking-wide">
                      Cambiar Fotografía
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Nombre Completo</label>
                    <input type="text" defaultValue={user?.name} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Correo Electrónico</label>
                    <input type="email" defaultValue={user?.email} className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Teléfono</label>
                    <input type="tel" placeholder="+52 55 0000 0000" className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Rol Actual</label>
                    <input type="text" disabled defaultValue={user?.role === 'superadmin' ? 'Super Administrador' : 'Administrador'} className="w-full border-2 border-gray-100 rounded-lg px-4 py-2.5 text-gray-400 bg-gray-50 cursor-not-allowed" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button className="btn-gold shadow-md">Guardar Cambios</button>
                </div>
              </div>
            )}

            {/* ── TAB NOTIFICACIONES ── */}
            {activeTab === 'notifications' && (
              <div className="max-w-2xl space-y-3 animate-fade-in">
                {[
                  { key: 'emailAlerts', title: 'Alertas por Correo', desc: 'Recibe resúmenes de actividad y alertas críticas en tu buzón.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg> },
                  { key: 'systemAlerts', title: 'Notificaciones del Sistema', desc: 'Muestra notificaciones push dentro del panel de control.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
                  { key: 'newLogins', title: 'Avisos de Inicio de Sesión', desc: 'Te avisaremos si tu cuenta se usa desde un dispositivo nuevo.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg> },
                  { key: 'weeklyReports', title: 'Reportes Semanales', desc: 'Resumen automatizado de operaciones enviado cada lunes.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-gold/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${notis[n.key] ? 'bg-gold/10 text-gold' : 'bg-gray-100 text-gray-400'}`}>
                        {n.icon}
                      </div>
                      <div>
                        <h4 className="text-navy-900 font-bold text-sm">{n.title}</h4>
                        <p className="text-navy-500 text-xs mt-0.5">{n.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => handleToggle(n.key)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${notis[n.key] ? 'bg-gold' : 'bg-gray-200'}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${notis[n.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB PREFERENCIAS ── */}
            {activeTab === 'preferences' && (
              <div className="max-w-2xl space-y-5 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Idioma del Sistema</label>
                  <select value={prefs.language} onChange={e => setPrefs({...prefs, language: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white">
                    <option value="es">Español (México)</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Zona Horaria</label>
                  <select value={prefs.timezone} onChange={e => setPrefs({...prefs, timezone: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white">
                    <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                    <option value="America/Tijuana">Tijuana (GMT-8)</option>
                    <option value="America/Cancun">Cancún (GMT-5)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Formato de Fecha</label>
                  <select value={prefs.dateFormat} onChange={e => setPrefs({...prefs, dateFormat: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="flex justify-end pt-2">
                  <button className="btn-gold shadow-md">Guardar Preferencias</button>
                </div>

                <div className="mt-10 p-5 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                  <h4 className="text-navy-900 font-bold text-sm mb-2">Prueba de Conectividad</h4>
                  <p className="text-navy-500 text-xs mb-4">Envía un correo de prueba a <strong>sistemas@bosa.mx</strong> para validar la configuración SMTP.</p>
                  <button 
                    onClick={runEmailTest}
                    disabled={testLoading}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${testLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-navy-900 text-white hover:bg-navy-800'}`}
                  >
                    {testLoading ? 'Enviando...' : 'Probar Correo'}
                  </button>
                  {testMsg && (
                    <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${testMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {testMsg.text}
                    </div>
                  )}
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
