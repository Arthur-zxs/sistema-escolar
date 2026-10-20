# Sistema de empréstimo de aparelhos

Aplicação React/Vite com API Express e banco SQLite para o acervo e empréstimos escolares.

## Primeira execução

Requer Node.js 22.14 ou superior.

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env`.
3. Preencha `BOOTSTRAP_ADMIN_RM`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. O RM deve ter exatamente 7 dígitos, o e-mail deve terminar em `@senaisp.edu.br` e a senha deve ter pelo menos 12 caracteres (limite de 72 bytes). A função inicial pode ser `Diretoria`, `Secretaria` ou `Orientador de Educação Digital`. Em desenvolvimento local, também é possível configurar `DEV_ADMIN_RM`, entrar como desenvolvedor e criar a primeira conta administrativa pela página **Administração**.
4. Execute `npm run dev` e abra o endereço Vite exibido no terminal.
5. Entre com o RM e a senha definidos no `.env`. Cadastre usuários pela página **Administração**. Cadastros públicos precisam confirmar o e-mail institucional; solicitações de função administrativa continuam dependendo de aprovação.

Na primeira inicialização, o servidor cria o banco `data/sesi.db`, as salas e os aparelhos iniciais. O banco e as credenciais do `.env` são locais e não devem ser enviados ao repositório. A conta de bootstrap só é criada quando o banco ainda não tem usuários.

## Acesso local para desenvolvedores

Opcionalmente, em desenvolvimento local, preencha `DEV_ADMIN_RM` com o RM de exatamente 4 dígitos. O formulário de desenvolvedor pede somente esse RM. A API só habilita essa entrada fora de produção e aceita a autenticação apenas por conexão local (loopback); o RM dev não aparece na lista administrativa de usuários. Não configure essa variável em produção.

## Comandos

- `npm run dev`: inicia a API local na porta 3003 e o Vite na porta 5173 (ou na próxima disponível). O proxy do Vite usa a porta definida em `PORT`, se configurada.
- `npm run dev:api`: inicia apenas a API.
- `npm run build`: gera os arquivos estáticos do frontend.
- `npm start`: inicia a API e serve os arquivos de `dist/`; execute o build antes.

## API

Os endpoints ficam sob `/api`. O navegador usa uma sessão opaca aleatória em cookie `HttpOnly`, `SameSite=Lax`, armazenada como hash no SQLite. Senhas são armazenadas com bcrypt. Rotas administrativas verificam o cargo novamente no servidor. Login e cadastro têm limite de tentativas, e operações mutáveis verificam origem e cabeçalho de requisição.

Funcionalidades persistidas:

- cadastro público limitado a e-mails `@senaisp.edu.br`, com confirmação de posse por código de seis dígitos enviado por e-mail (validade de 15 minutos); solicitações de cargos administrativos também dependem de aprovação;
- criação/desativação de contas pela administração, edição do próprio nome/e-mail e troca de senha pela tela de login após confirmar RM e senha atual;
- consulta do acervo, disponibilidade e mapa de salas;
- registro imediato e transacional de empréstimos, com atualização de disponibilidade e data/hora de devolução;
- histórico de devoluções, exportação CSV e registro de atividades administrativas;
- cadastro/edição/remoção de aparelhos nos acervos LMT e Maker e gerenciamento de salas de aula, respeitando referências do histórico;
- atualização do perfil limitada a nome e foto, com imagem otimizada e persistida;
- bloqueio de sessões de contas desativadas.

## Segurança e implantação

O banco SQLite local é adequado para desenvolvimento e implantação simples em um único servidor com disco persistente. Para disponibilização pública, configure HTTPS, `NODE_ENV=production`, SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` e, quando exigidos pelo provedor, `SMTP_USER` e `SMTP_PASSWORD`), mantenha `.env` e `data/` fora do controle de versão, proteja e faça backup do volume do banco e use um proxy HTTPS. `SMTP_SECURE=true` habilita TLS direto; a porta 465 também o habilita automaticamente. O servidor não inicia em produção sem os parâmetros SMTP obrigatórios. Em desenvolvimento local sem SMTP, o código fica disponível na interface quando o servidor está vinculado ao loopback; `EXPOSE_EMAIL_VERIFICATION_CODE=true` permite esse recurso explicitamente em outros hosts locais. Não habilite essa opção em produção. Para múltiplas instâncias, armazenamento efêmero, alta disponibilidade ou entrega de e-mail/SMS, use banco/armazenamento e serviços externos apropriados.

O primeiro administrador precisa ser provisionado por configuração de ambiente antes que o cadastro público seja habilitado. Não use credenciais de exemplo em produção. Cadastros administrativos posteriores devem ser criados por uma conta autorizada. Senhas novas devem ter no mínimo 12 caracteres e no máximo 72 bytes (limite do bcrypt), sem restrição a números ou composição fixa. Na primeira inicialização após esta atualização, contas existentes sem data de troca de senha serão obrigadas a atualizar a senha antes de acessar o sistema; a sessão anterior é invalidada. Contas públicas novas não entram até confirmar o código enviado ao e-mail. A confirmação comprova acesso à caixa postal, mas não verifica por si só a identidade civil nem a correspondência do RM; para isso, use provisionamento por administradores ou uma integração institucional.

Empréstimos são registrados sem aprovação administrativa. A disponibilidade é verificada e atualizada no momento do registro; no cadastro informa-se apenas o horário previsto de devolução, considerando o próximo horário futuro (hoje ou amanhã). Datas e horários são tratados e exibidos no fuso `America/Sao_Paulo`, independente do fuso configurado no servidor. O mapa apresenta LMT e Maker como locais de acervo, organiza as 24 salas de aula em dois blocos, A e B, com 12 salas por bloco, e lista os empréstimos ativos na sala escolhida. Após dez tentativas falhas de login, o bloqueio dura 30 segundos.
