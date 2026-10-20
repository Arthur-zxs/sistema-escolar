import { useState } from 'react'
import Badge from '../componentes/comuns/Badge'

async function prepararFoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Escolha uma foto JPG, PNG ou WebP.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 5 MB antes da otimização.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    if (image.width > 8_000 || image.height > 8_000 || image.width * image.height > 40_000_000) {
      throw new Error('Escolha uma imagem com dimensões menores.')
    }

    for (const size of [512, 384, 256]) {
      const scale = Math.min(1, size / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar esta imagem.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      for (const quality of [0.82, 0.68, 0.54]) {
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => result ? resolve(result) : reject(new Error('Não foi possível preparar esta imagem.')),
            'image/jpeg',
            quality,
          )
        })
        if (blob.size > 180 * 1024) continue
        return await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Não foi possível ler a foto selecionada.'))
          reader.readAsDataURL(blob)
        })
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  throw new Error('Não foi possível reduzir a foto. Escolha uma imagem menor.')
}

export default function ProfilePage({ loans, funcionario, onSave }) {
  const emprestimosAtivos = loans.filter((loan) => ['Em uso', 'Atrasado'].includes(loan.status));
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [nomeEditado, setNomeEditado] = useState(funcionario?.nome || '')
  const [fotoEditada, setFotoEditada] = useState(funcionario?.foto || null)
  const nome = funcionario?.nome || 'Funcionário'
  const registro = funcionario?.registro || 'Sem registro'
  const funcao = funcionario?.funcao || 'Não informada'
  const email = funcionario?.email || 'Não informado'
  const iniciais = nome.split(' ').map(parte => parte[0]).slice(0, 2).join('').toUpperCase()

  async function salvarPerfil(event) {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      await onSave({ nome: nomeEditado, foto: fotoEditada })
      setEditando(false)
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">CONTA DO FUNCIONÁRIO</span>
          <h2>Meu perfil</h2>
          <p>Visualize seus dados e acompanhe seus empréstimos.</p>
        </div>
        <button
          className="outline-button"
          onClick={() => {
            setNomeEditado(nome)
            setFotoEditada(funcionario?.foto || null)
            setEditando(value => !value)
            setErro('')
          }}
        >
          {editando ? 'Cancelar edição' : 'Editar perfil'}
        </button>
      </div>

      <div className="profile-layout">
        <section className="profile-card">
          <div className="profile-top">
            <div className="profile-avatar">
              {funcionario?.foto ? <img src={funcionario.foto} alt="" /> : iniciais}
            </div>
            <div><h3>{nome}</h3><p>{funcao}</p></div>
          </div>

          {editando ? (
            <form className="profile-fields" onSubmit={salvarPerfil}>
              <div className="profile-photo-editor">
                <div className="profile-avatar profile-avatar-large">
                  {fotoEditada ? <img src={fotoEditada} alt="Prévia da foto de perfil" /> : iniciais}
                </div>
                <div>
                  <strong>Foto de perfil</strong>
                  <p>JPG, PNG ou WebP. Otimizada automaticamente até 180 KB.</p>
                  <label className="profile-upload-button" htmlFor="profile-photo-input">
                    Escolher foto
                  </label>
                  {fotoEditada && (
                    <button
                      className="profile-remove-photo"
                      type="button"
                      onClick={() => setFotoEditada(null)}
                    >
                      Remover foto
                    </button>
                  )}
                  <input
                    id="profile-photo-input"
                    className="profile-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      setErro('')
                      try {
                        setFotoEditada(await prepararFoto(file))
                      } catch (error) {
                        setErro(error.message)
                      }
                    }}
                  />
                </div>
              </div>
              <label>
                Nome completo
                <input required value={nomeEditado} onChange={event => setNomeEditado(event.target.value)} />
              </label>
              <div><span>E-mail institucional</span><strong>{email}</strong></div>
              <div><span>Registro de matrícula</span><strong>RM {registro}</strong></div>
              <div><span>Função</span><strong>{funcao}</strong></div>
              <button className="primary-button" type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar perfil'}
              </button>
              {erro && <p className="form-error" role="alert">{erro}</p>}
            </form>
          ) : (
          <div className="profile-fields">
            <div><span>Nome completo</span><strong>{nome}</strong></div>
            <div><span>Registro de Matricula</span><strong>RM {registro}</strong></div>
            <div><span>Função</span><strong>{funcao}</strong></div>
            <div><span>E-mail institucional</span><strong>{email}</strong></div>
          </div>
          )}
        </section>

        <section className="profile-loans">
          <div className="section-heading">
            <div><h2>Meus empréstimos</h2><p>Resumo atual</p></div>
            <Badge tone="blue">{String(emprestimosAtivos.length).padStart(2, '0')} ativos</Badge>
          </div>

          <div className="profile-loan-list">
            {loans.map(loan => (
              <div className="profile-loan" key={loan.id}>
                <span className="mini-device">{loan.device.includes('Galaxy') ? '▯' : '▣'}</span>
                <div><strong>{loan.device}</strong><small>{loan.qty} unidade(s) · {loan.room}</small></div>
                <Badge tone={loan.statusTone}>{loan.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
