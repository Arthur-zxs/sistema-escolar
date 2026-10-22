import Badge from "../componentes/comuns/Badge";
import Icon from "../componentes/comuns/Icon";
import exportarEmprestimos from "../utilitarios/exportarEmprestimos";

export default function HistoryPage({ history, canClearHistory = false, onClearHistory }) {
  function handleClearHistory() {
    const confirmed = window.confirm(
      `Apagar os ${history.length} registros de empréstimos devolvidos? Essa ação não pode ser desfeita. Empréstimos em andamento serão mantidos.`,
    );
    if (confirmed) onClearHistory();
  }

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{canClearHistory ? "HISTÓRICO GERAL" : "SEU HISTÓRICO"}</span>
          <h2>Histórico de empréstimos</h2>
          <p>
            {canClearHistory
              ? "Consulte os empréstimos devolvidos de todos os usuários."
              : "Confira todos os aparelhos que você já utilizou."}
          </p>
        </div>
        <div className="history-actions">
          {canClearHistory && (
            <button
              className="outline-button history-clear-button"
              type="button"
              disabled={history.length === 0}
              onClick={handleClearHistory}
            >
              Apagar histórico
            </button>
          )}
          <button
            className="outline-button"
            type="button"
            disabled={history.length === 0}
            onClick={() => exportarEmprestimos(history, "historico-emprestimos-agenda-lmt.csv")}
          >
            <Icon>⇩</Icon> Exportar lista
          </button>
        </div>
      </div>
      <div className="table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>Aparelho</th>
              <th>Qtd.</th>
              <th>Sala de aula</th>
              <th>Retirada</th>
              <th>Devolução</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  Nenhum empréstimo concluído no histórico.
                </td>
              </tr>
            ) : history.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="device-cell">
                    <span className="mini-device">▣</span>
                    <strong>{item.device}</strong>
                  </div>
                </td>
                <td>{item.qty}</td>
                <td>{item.room}</td>
                <td>{item.date}</td>
                <td>{item.returned}</td>
                <td>
                  <Badge tone="green">{item.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
