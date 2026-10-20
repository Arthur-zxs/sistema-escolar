import Icon from "../comuns/Icon";
import { itensNavegacao } from '../../dados/mockData'

export default function Sidebar({ active, onNavigate, onLogout, canAccessAdmin }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">+</div>
        <div>
          <strong>Sesi</strong>
          <span>Cerquilho</span>
        </div>
      </div>
      <div className="menu-label">MENU PRINCIPAL</div>
      <nav id="primary-navigation" aria-label="Navegação principal">
        {itensNavegacao
          .filter(([id]) => id !== 'admin' || canAccessAdmin)
          .map(([id, label]) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-current={active === id ? "page" : undefined}
          >
            <Icon name={id} />
            <span>{label}</span>
            {active === id && <i />}
          </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-box">
          <span className="help-icon">?</span>
          <div>
            <strong>Precisa de ajuda?</strong>
            <small>Fale com a secretaria</small>
          </div>
        </div>
        <button className="nav-item logout" onClick={onLogout}>
          <Icon name="logout" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
