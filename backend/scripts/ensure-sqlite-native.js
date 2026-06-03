/**
 * Verifica que better-sqlite3 cargue con la versión actual de Node.
 * Si falla, indica cómo recompilar.
 */
try {
  // eslint-disable-next-line global-require
  require('better-sqlite3')(':memory:');
} catch (err) {
  console.error('\n[bosa-backend] better-sqlite3 no coincide con Node', process.version);
  console.error('Ejecuta en backend/:  npm rebuild better-sqlite3');
  console.error('Si sigue fallando, cierra npm run dev y vuelve a intentar.\n');
  process.exit(1);
}
