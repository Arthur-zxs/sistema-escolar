import LoanTable from "../componentes/emprestimos/LoanTable";

export default function LoansPage({ loans, onReturn, canReturn }) {
  const activeLoans = loans.filter((loan) => ["Em uso", "Atrasado"].includes(loan.status));
  const pendingRequests = loans.filter((loan) => loan.status === "Pendente").length;
  const rejectedRequests = loans.filter((loan) => loan.status === "Recusado").length;

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">CONTROLE DE USO</span>
          <h2>Empréstimos</h2>
          <p>
            Consulte os aparelhos em uso e acompanhe os prazos de devolução.
          </p>
        </div>
        <div className="catalog-count">
          <strong>{String(activeLoans.length).padStart(2, "0")}</strong>
          <span>
            {pendingRequests} pendente(s) · {rejectedRequests} recusada(s)
          </span>
        </div>
      </div>
      <LoanTable rows={loans} onReturn={onReturn} canReturn={canReturn} />
      <div className="info-strip">
        <span>i</span>
        <p>
          Os empréstimos são registrados automaticamente. Retire os aparelhos
          no acervo indicado (LMT ou Maker) e informe a sala de aula onde serão usados.
        </p>
      </div>
    </div>
  );
}
