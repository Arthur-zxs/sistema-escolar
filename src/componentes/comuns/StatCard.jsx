import Icon from './Icon'

export default function StatCard({ label, value, detail, icon, tone }) {
  return <article className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon>{icon}</Icon></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}
