import { useState } from 'react'
import Icon from '../componentes/comuns/Icon'
import StatCard from '../componentes/comuns/StatCard'
import LoanTable from '../componentes/emprestimos/LoanTable'

export default function DashboardPage({ onNavigate, loans, devices, onReturn, canReturn, funcionario }) {
  const primeiroNome = funcionario?.nome?.split(' ')[0] || 'funcionário'
  const emprestimosAtivos = loans.filter(loan => ['Em uso', 'Atrasado'].includes(loan.status))
  const quantidadeTotal = devices.reduce((total, aparelho) => total + aparelho.total, 0)
  const notebooks = devices.filter(aparelho => aparelho.type === 'Notebook')
  const celulares = devices.filter(aparelho => aparelho.type === 'Celular')
  const notebooksDisponiveis = notebooks.reduce((total, aparelho) => total + aparelho.available, 0)
  const celularesDisponiveis = celulares.reduce((total, aparelho) => total + aparelho.available, 0)
  const notebooksTotais = notebooks.reduce((total, aparelho) => total + aparelho.total, 0)
  const celularesTotais = celulares.reduce((total, aparelho) => total + aparelho.total, 0)

  const [hoje] = useState(() => new Date());
  const saudacao = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(hoje).toUpperCase();

  return (
    <div className="page-content">
      <section className="welcome">
        <div>
          <span className="eyebrow">{dataFormatada}</span>
          <h2>{saudacao}, {primeiroNome} <span>✦</span></h2>
          <p>Acompanhe os empréstimos registrados e encontre aparelhos disponíveis para sua rotina.</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate('devices')}>
          <Icon>+</Icon> Encontrar aparelho
        </button>
      </section>

      <section className="getting-started" aria-labelledby="getting-started-title">
        <div className="getting-started-heading">
          <div>
            <span className="eyebrow">SIMPLES E RÁPIDO</span>
            <h2 id="getting-started-title">Como fazer um empréstimo</h2>
            <p>Você registra o empréstimo diretamente, sem aguardar aprovação.</p>
          </div>
          <span className="getting-started-badge">3 passos</span>
        </div>
        <div className="quick-links">
          <button className="quick-link-card" onClick={() => onNavigate('devices')}>
            <span className="quick-link-number">01</span>
            <span className="quick-link-icon">⌕</span>
            <strong>Escolha um aparelho</strong>
            <small>Veja modelos e disponibilidade em LMT e Maker.</small>
            <span className="quick-link-action">Abrir catálogo <span aria-hidden="true">→</span></span>
          </button>
          <div className="quick-link-card quick-link-static">
            <span className="quick-link-number">02</span>
            <span className="quick-link-icon">↗</span>
            <strong>Informe os detalhes</strong>
            <small>Escolha a quantidade, a sala de aula e o horário de devolução.</small>
            <span className="quick-link-action">Feito na hora do registro</span>
          </div>
          <button className="quick-link-card" onClick={() => onNavigate('loans')}>
            <span className="quick-link-number">03</span>
            <span className="quick-link-icon">◷</span>
            <strong>Acompanhe a devolução</strong>
            <small>Consulte seus empréstimos e prazos em um só lugar.</small>
            <span className="quick-link-action">Ver meus empréstimos <span aria-hidden="true">→</span></span>
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Total de aparelhos" value={quantidadeTotal} detail="no acervo" icon="▦" tone="red" />
        <StatCard label="Notebooks disponíveis" value={notebooksDisponiveis} detail={`de ${notebooksTotais} aparelhos`} icon="▣" tone="blue" />
        <StatCard label="Celulares disponíveis" value={celularesDisponiveis} detail={`de ${celularesTotais} aparelhos`} icon="▯" tone="green" />
        <StatCard label="Empréstimos ativos" value={String(emprestimosAtivos.length).padStart(2, '0')} detail="registrados automaticamente" icon="↔" tone="orange" />
      </section>

      <div className="section-heading">
        <div><h2>Empréstimos recentes</h2><p>Acompanhe os aparelhos em uso e seus prazos de devolução.</p></div>
        <button className="text-button" onClick={() => onNavigate('loans')}>Ver todos <span>→</span></button>
      </div>

      <LoanTable rows={loans} compact onReturn={onReturn} canReturn={canReturn} />

      <div className="dashboard-bottom">
        <section className="notice-card">
          <div className="notice-title"><span>!</span><strong>Lembrete importante</strong></div>
          <p>Devolva os aparelhos no horário combinado para evitar atrasos e manter o acervo disponível.</p>
        </section>
      </div>
    </div>
  )
}
