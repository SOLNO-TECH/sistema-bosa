import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoldRule } from '../components/Illustrations';
import { SolnoLoginFooter } from '../components/SolnoBrandMark';
import AppVersionBadge from '../components/AppVersionBadge';

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

function IconMail() {
  return (
    <svg className="login-input-wrap__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="login-input-wrap__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
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
    <div
      className="login-page flex min-h-[100dvh] flex-col lg:flex-row"
      style={{ background: 'linear-gradient(160deg, #071221 0%, #050D1A 100%)' }}
    >

      {/* ── Panel izquierdo — foto de fondo (desktop) ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden">

        {/* Foto de fondo */}
        <img
          src="/fondo.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(1.12) saturate(1.15) contrast(1.03)' }}
        />

        {/* Overlay suave — un poco más de contraste para logo y texto */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(170deg, rgba(5,13,26,0.22) 0%, rgba(7,18,33,0.28) 45%, rgba(5,13,26,0.52) 100%)'
        }} />

        {/* Línea dorada derecha */}
        <div className="absolute right-0 top-0 bottom-0 w-px pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(203,172,128,0.3) 25%, rgba(203,172,128,0.3) 75%, transparent 100%)' }} />

        {/* Contenido sobre la foto */}
        <div className={`relative z-10 flex flex-col h-full px-14 py-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Logo */}
          <div className="flex items-start">
            <img
              src="/bosahublogo-02.svg"
              alt="BOSA Hub"
              className="w-64 h-auto drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.55)) drop-shadow(0 8px 24px rgba(0,0,0,0.45))' }}
            />
          </div>

          {/* Propuesta de valor — pegado debajo del logo */}
          <div className="login-hero__body max-w-sm">
            <GoldRule className="w-36 mb-5" />

            <p className="login-hero__lead font-sans text-sm leading-relaxed" style={{ color: 'rgba(226,236,248,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.4)' }}>
              Plataforma integral para la administración de operaciones hoteleras y residenciales.
            </p>

            <div className="mt-7">
              <div
                className="inline-flex flex-col items-center justify-center rounded-sm px-6 py-3 transition-all duration-300 hover:bg-white/10"
                style={{ background: 'rgba(5,13,26,0.28)', backdropFilter: 'blur(8px)', border: '1px solid rgba(203,172,128,0.28)' }}
              >
                <svg className="mb-2 h-5 w-5 text-gold/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                </svg>
                <p className="font-label text-[9px] tracking-widest uppercase" style={{ color: 'rgba(226,236,248,0.88)' }}>
                  Corporativo
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-4" aria-hidden />

          {/* Footer */}
          <p className="font-label text-[10px] tracking-widest" style={{ color: 'rgba(200,215,235,0.72)', textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
            © 2026 BOSA MX · Todos los derechos reservados
          </p>
        </div>
      </div>

      {/* ── Hero móvil / tablet — solo logo, compacto ── */}
      <div className="relative overflow-hidden lg:hidden">
        <img
          src="/fondo.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'brightness(1.1) saturate(1.12) contrast(1.02)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,13,26,0.2) 0%, rgba(5,13,26,0.38) 55%, rgba(5,13,26,0.82) 100%)',
          }}
        />
        <div className="relative z-10 flex min-h-[6.5rem] items-center justify-center px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:min-h-[7rem]">
          <img
            src="/bosahublogo-02.svg"
            alt="BOSA Hub"
            className="mx-auto h-auto w-44 drop-shadow-xl sm:w-48"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5)) drop-shadow(0 6px 16px rgba(0,0,0,0.4))' }}
          />
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="relative flex flex-1 items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:items-center lg:py-12 pb-[max(1rem,env(safe-area-inset-bottom))]">

        {/* Destello dorado muy sutil */}
        <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 10%, rgba(203,172,128,0.04) 0%, transparent 60%)' }} />

        <div className={`login-form-wrap w-full max-w-[400px] transition-all duration-600 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Encabezado del form — solo desktop (logo va en hero móvil) */}
          <div className="mb-4 sm:mb-8">
            <p className="font-label text-gold text-[10px] tracking-[0.28em] uppercase mb-2 sm:text-xs sm:tracking-[0.35em]">
              Acceso al sistema
            </p>
            <h2 className="font-display font-light text-slate-text text-2xl sm:text-3xl">Iniciar Sesión</h2>
          </div>

          {/* Card del formulario */}
          <div
            className="login-form-card rounded-sm shadow-card-lg border border-surface p-5 sm:p-8"
            style={{ background: 'rgba(10,25,46,0.7)', backdropFilter: 'blur(16px)' }}
          >

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

              <div className="space-y-1.5">
                <label htmlFor="login-email" className="font-label text-slate-subtle text-xs tracking-[0.2em] uppercase block">
                  Correo electrónico
                </label>
                <div className="login-input-wrap">
                  <IconMail />
                  <input
                    id="login-email"
                    type="email"
                    className="input-corporate login-input login-input--icon"
                    placeholder="superadmin@bosa.mx"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="font-label text-slate-subtle text-xs tracking-[0.2em] uppercase block">
                  Contraseña
                </label>
                <div className="login-input-wrap">
                  <IconLock />
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    className="input-corporate login-input login-input--icon login-input--icon-right"
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
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="login-input-wrap__action"
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
              <div className="pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="voice-minute-footer__btn voice-minute-footer__btn--primary login-submit w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span
                        className="h-[1.625rem] w-[1.625rem] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                        aria-hidden
                      />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <svg
                        className="voice-minute-footer__icon voice-minute-footer__icon--ticket"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      Ingresar al Sistema
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <AppVersionBadge className="mb-3" />
          <SolnoLoginFooter className="px-1" />

          <p className="mt-4 text-center font-label text-[9px] tracking-widest text-slate-muted/60 lg:hidden">
            © 2026 BOSA MX · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
