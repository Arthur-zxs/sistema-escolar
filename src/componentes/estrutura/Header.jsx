export default function Header({
  title,
  subtitle,
  funcionario,
  onMenu,
  onProfile,
  menuOpen,
}) {
  const nome = funcionario?.nome || 'Funcionário'
  const registro = funcionario?.registro || 'Sem registro'
  const iniciais = nome
    .split(' ')
    .map(parte => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="header">
      <button
        className="mobile-menu"
        onClick={onMenu}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
      >
        {menuOpen ? "×" : "☰"}
      </button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        <button className="user-chip" onClick={onProfile}>
          <span className="avatar">
            {funcionario?.foto ? (
              <img src={funcionario.foto} alt="" />
            ) : (
              iniciais
            )}
          </span>
          <span className="user-details">
            <strong>{nome}</strong>
            <small>RM {registro}</small>
          </span>
          <span className="chevron">⌄</span>
        </button>
      </div>
    </header>
  )
}
