import { APP_NAME, APP_VERSION_LABEL } from '../appVersion';

/** Etiqueta discreta de versión (resumen general, login, configuración). */
export default function AppVersionBadge({ variant = 'dark', className = '' }) {
  const variantClass =
    variant === 'light' ? 'app-version--light' : variant === 'welcome' ? 'app-version--welcome' : '';

  return (
    <p
      className={`app-version ${variantClass} ${className}`.trim()}
      title={`${APP_NAME} ${APP_VERSION_LABEL}`}
    >
      {APP_NAME} {APP_VERSION_LABEL}
    </p>
  );
}
