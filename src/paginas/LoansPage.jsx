import LoanTable from "../componentes/emprestimos/LoanTable";

export default function LoansPage({ loans, onReturn, canReturn }) {
  const activeLoans = loans.filter((loan) => ["Em uso", "Atrasado"].includes(loan.status));
  const scheduledLoans = loans.filter((loan) => loan.status === "Pendente").length;

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">PASSO 3 · ACOMPANHE SEUS APARELHOS</span>
          <h2>Empréstimos</h2>
          <p>
            Consulte os aparelhos em uso e acompanhe os prazos de devolução.
          </p>
        </div>
        <div className="catalog-count">
          <strong>{String(activeLoans.length).padStart(2, "0")}</strong>
          <span>
            {scheduledLoans} agendado(s)
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
