export const aparelhos = [
  { id: 1, name: 'Dell Latitude 5420', type: 'Notebook', brand: 'Dell', total: 12, available: 12, tone: 'blue', icon: '▣', location: 'Maker' },
  { id: 2, name: 'Lenovo ThinkPad E14', type: 'Notebook', brand: 'Lenovo', total: 10, available: 10, tone: 'red', icon: '▣', location: 'LMT' },
  { id: 3, name: 'Samsung Book 2', type: 'Notebook', brand: 'Samsung', total: 8, available: 8, tone: 'dark', icon: '▣', location: 'Maker' },
  { id: 4, name: 'Samsung Galaxy A54', type: 'Celular', brand: 'Samsung', total: 18, available: 18, tone: 'green', icon: '▯', location: 'LMT' },
  { id: 5, name: 'Motorola Moto G84', type: 'Celular', brand: 'Motorola', total: 14, available: 14, tone: 'purple', icon: '▯', location: 'Maker' },
  { id: 6, name: 'Samsung Galaxy S23 FE', type: 'Celular', brand: 'Samsung', total: 6, available: 6, tone: 'orange', icon: '▯', location: 'LMT' },
]

export const emprestimosAtuais = []

export const historicoEmprestimos = []

const salasLegadas = [
  'lab-01',
  'lab-02',
  'lab-03',
  'lab-04',
  'sala-08',
  'sala-12',
  'biblioteca',
  'auditorio',
]

export const salas = Array.from({ length: 24 }, (_value, index) => {
  const block = index < 12 ? 'A' : 'B'
  const number = (index % 12) + 1
  return {
    id: salasLegadas[index] || `sala-${block.toLowerCase()}-${String(number).padStart(2, '0')}`,
    name: `Sala ${String(number).padStart(2, '0')} - Bloco ${block}`,
    kind: 'Sala de aula',
    block,
    devices: ['Livre'],
  }
})

export const itensNavegacao = [
  ['home', 'Home', '⌂'], ['devices', 'Aparelhos', '▣'], ['loans', 'Empréstimos', '↔'],
  ['map', 'Mapa da escola', '⌆'], ['history', 'Histórico', '◷'], ['profile', 'Meu perfil', '♙'],
  ['admin', 'Administração', '▤'],
]

export const funcoesComAcessoAdmin = [
  'Diretoria',
  'Secretaria',
  'Orientador de Educação Digital',
]

export const dadosPaginas = {
  home: ['Visão geral', 'Tenha uma visão completa dos seus aparelhos e empréstimos.'],
  devices: ['Aparelhos', 'Consulte a disponibilidade do acervo escolar.'],
  loans: ['Empréstimos', 'Gerencie seus aparelhos em uso.'],
  map: ['Mapa da escola', 'Encontre salas e aparelhos em utilização.'],
  history: ['Histórico', 'Consulte suas movimentações anteriores.'],
  profile: ['Meu perfil', 'Seus dados e empréstimos em um só lugar.'],
  admin: ['Administração', 'Visão geral do acervo e dos empréstimos da escola.'],
}
