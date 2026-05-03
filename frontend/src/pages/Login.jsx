import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BuildingIllustration, GoldRule } from '../components/Illustrations';

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(160deg, #071221 0%, #050D1A 100%)' }}>

      {/* ── Panel izquierdo — identidad corporativa ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A1930 0%, #071221 60%, #050D1A 100%)' }}
      >
        {/* Líneas geométricas de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Línea vertical derecha */}
          <div className="absolute right-0 top-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(203,172,128,0.25) 30%, rgba(203,172,128,0.25) 70%, transparent 100%)' }} />

          {/* Rectángulo decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(203,172,128,0.4), transparent)' }} />

          {/* Grid sutil */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `
                   linear-gradient(rgba(203,172,128,1) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(203,172,128,1) 1px, transparent 1px)
                 `,
              backgroundSize: '60px 60px',
            }} />

          {/* Círculo decorativo grande */}
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(203,172,128,0.04) 0%, transparent 70%)' }} />
        </div>

        {/* Contenido */}
        <div className={`relative z-10 flex flex-col h-full px-14 py-12 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Logo / marca */}
          <div className="flex items-start">
            <img src="/logo.png" alt="BOSA Logo" className="w-64 drop-shadow-2xl" style={{ filter: 'drop-shadow(0px 8px 12px rgba(0, 0, 0, 0.4))' }} />
          </div>

          {/* Centro — propuesta de valor */}
          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <GoldRule className="w-36 mb-8" />

            {/* Título principal — Neogrotesk Small Caps Light */}
            <h1 className="font-display font-light text-slate-text leading-tight" style={{ fontSize: '2.75rem' }}>
              Sistema de<br />
              <span className="text-gold-shimmer">Gestión</span><br />
              Corporativa
            </h1>

            <p className="font-sans text-slate-subtle text-sm leading-relaxed mt-6">
              Plataforma integral para la administración de operaciones hoteleras y residenciales.
            </p>

            {/* Pilares */}
            <div className="grid grid-cols-3 gap-3 mt-12">
              {[
                {
                  label: 'Hotel',
                  icon: (
                    <svg className="w-5 h-5 mx-auto mb-2 text-gold/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                  )
                },
                {
                  label: 'Condominios',
                  icon: (
                    <svg className="w-5 h-5 mx-auto mb-2 text-gold/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m8.25-3v-6.375m0 0l-1.5-1.125M22.5 18l-1.5-1.125M12 2.25l-10.5 7.875m10.5-7.875l10.5 7.875M12 2.25l-1.5 1.125M12 2.25l1.5 1.125M3 18v-6.375M3 18l1.5-1.125" />
                    </svg>
                  )
                },
                {
                  label: 'Operaciones',
                  icon: (
                    <svg className="w-5 h-5 mx-auto mb-2 text-gold/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )
                }
              ].map((item) => (
                <div key={item.label} className="border border-surface rounded-sm px-2 py-3 text-center flex flex-col items-center justify-center transition-all duration-300 hover:border-gold/30 hover:bg-gold/5"
                  style={{ background: 'rgba(240,244,250,0.02)' }}>
                  {item.icon}
                  <p className="font-label text-slate-muted text-[9px] tracking-widest uppercase">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="font-label text-slate-muted text-[10px] tracking-widest">
            © 2024 BOSA Hospitality Group · Todos los derechos reservados
          </p>
        </div>

        {/* Ilustración arquitectónica — fondo del panel */}
        <BuildingIllustration className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] max-w-[480px] opacity-[0.28] pointer-events-none select-none" />
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">

        {/* Destello dorado muy sutil */}
        <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 10%, rgba(203,172,128,0.04) 0%, transparent 60%)' }} />

        <div className={`w-full max-w-[400px] transition-all duration-600 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Logo móvil */}
          <div className="lg:hidden flex items-center justify-center mb-10">
            <img src="/logo.png" alt="BOSA Logo" className="w-56 drop-shadow-xl" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.4))' }} />
          </div>

          {/* Encabezado del form */}
          <div className="mb-8">
            {/* Eyebrow — PODIUM Sharp */}
            <p className="font-label text-gold text-xs tracking-[0.35em] uppercase mb-2">Acceso al sistema</p>
            {/* Título — Neogrotesk SC */}
            <h2 className="font-display font-light text-slate-text text-3xl">Iniciar Sesión</h2>
          </div>

          {/* Card del formulario */}
          <div className="rounded-sm shadow-card-lg border border-surface p-8"
            style={{ background: 'rgba(10,25,46,0.7)', backdropFilter: 'blur(16px)' }}>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="font-label text-slate-subtle text-xs tracking-[0.2em] uppercase block">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  className="input-corporate"
                  placeholder="superadmin@bosa.mx"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label className="font-label text-slate-subtle text-xs tracking-[0.2em] uppercase block">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input-corporate pr-11"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted hover:text-gold transition-colors"
                  >
                    <EyeIcon open={showPwd} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-sm border border-red-800/40"
                  style={{ background: 'rgba(127,29,29,0.15)' }}>
                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="font-sans text-red-400 text-xs">{error}</p>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn-gold w-full">
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-navy-950/40 border-t-navy-950 rounded-full animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Ingresar al Sistema
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Nota de seguridad */}
          <div className="mt-5 flex items-center justify-center gap-2">
            <svg className="w-3 h-3 text-slate-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="font-sans text-slate-muted text-[10px] tracking-[0.2em] uppercase">
              Acceso restringido · Solo personal autorizado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
