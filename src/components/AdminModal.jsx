import { createPortal } from 'react-dom'

export default function AdminModal({
  title,
  titleId = 'admin-modal-title',
  onClose,
  children,
  actions,
  className = '',
}) {
  return createPortal(
    <div className="budget-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`budget-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <div className="budget-modal-body">{children}</div>
        {actions ? <div className="budget-modal-actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
