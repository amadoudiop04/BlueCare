const STYLES = {
  loading: 'bg-slate-100 text-slate-600',
  ok: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

function StatusBadge({ status, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        STYLES[status] ?? STYLES.loading
      }`}
    >
      {children}
    </span>
  )
}

export default StatusBadge
