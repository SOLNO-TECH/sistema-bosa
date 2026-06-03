/**
 * Marca tipográfica Saya AI — variante hero (oscuro) o compact (ficha reunión).
 */
export default function SayaBrandMark({ variant = 'hero', className = '', id }) {
  const variantClass =
    variant === 'compact' ? 'saya-brand--compact' : variant === 'inline' ? 'saya-brand--inline' : 'saya-brand--hero';

  const Tag = variant === 'hero' ? 'h1' : 'p';

  return (
    <Tag id={id} className={`saya-brand ${variantClass} ${className}`.trim()} aria-label="Saya AI">
      <span className="saya-brand__word">Saya</span>
      <span className="saya-brand__ai">AI</span>
    </Tag>
  );
}
