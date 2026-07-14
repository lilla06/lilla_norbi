export default function Monogram({ className = '' }) {
  return (
    <span className={`monogram ${className}`.trim()} aria-label="Lilla és Norbi">
      L <span>&amp;</span> N
    </span>
  )
}
