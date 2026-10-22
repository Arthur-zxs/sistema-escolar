# Agenda LMT

Aplicação React/Vite com API Express e banco SQLite para o acervo e empréstimos escolares.

## Primeira execução

Requer Node.js 22.14 ou superior.

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env`.
3. Preencha `BOOTSTRAP_ADMIN_RM`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. O RM deve ter exatamente 7 dígitos, o e-mail deve terminar em `@senaisp.edu.br` e a senha deve ter pelo menos 12 caracteres (limite de 72 bytes). A função inicial pode ser `Diretoria`, `Secretaria` ou `Orientador de Educação Digital`. Em desenvolvimento local, também é possível configurar `DEV_ADMIN_RM`, entrar como desenvolvedor e criar a primeira conta administrativa pela aba **Gerenciar contas** na Home do gestor.
4. Execute `npm run dev` e abra o endereço Vite exibido no terminal.
5. Entre com o RM e a senha definidos no `.env`. Na Home do gestor, use as abas **Gerenciar acervo**, **Gerenciar salas de aula** e **Gerenciar contas** para administrar o sistema. O cadastro público permite acesso imediato; pedidos públicos de função administrativa ficam pendentes até aprovação.

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

- cadastro público limitado a e-mails `@senaisp.edu.br`, sem etapa de confirmação; pedidos de função administrativa permanecem sujeitos à aprovação;
- criação/desativação de contas pela administração, troca de senha autenticada e recuperação de senha por código enviado ao e-mail cadastrado (validade de 15 minutos);
- consulta do acervo, disponibilidade e mapa de salas;
- registro imediato e transacional de empréstimos, com atualização de disponibilidade e data/hora de devolução;
- histórico de devoluções, exportação CSV e registro de atividades administrativas;
- cadastro/edição/remoção de aparelhos nos acervos LMT e Maker e gerenciamento de salas de aula, respeitando referências do histórico;
- atualização do perfil limitada a nome e foto, com imagem otimizada e persistida;
- bloqueio de sessões de contas desativadas.

## Segurança e implantação

O SQLite é adequado para uma primeira implantação em um único servidor Node.js com volume persistente. A aplicação não está preparada para rodar com disco efêmero, múltiplas réplicas ou em hospedagem apenas estática. Firebase Hosting sozinho, por exemplo, não executa esta API Express nem fornece o disco persistente esperado pelo SQLite; escolher Firebase exigiria definir uma hospedagem separada para a API e uma solução de dados compatível. Não habilite tráfego público antes de escolher e testar essa arquitetura.

Para produção, configure `NODE_ENV=production`, `PORT` (se exigido pela plataforma), `DATABASE_PATH` apontando para o volume persistente, HTTPS no domínio e SMTP de um provedor de e-mail transacional. No painel do provedor, obtenha o host e a porta SMTP, autorize o endereço/domínio remetente e crie credenciais SMTP se forem exigidas. Cadastre `SMTP_HOST`, `SMTP_PORT` e `SMTP_FROM`; configure também `SMTP_USER` e `SMTP_PASSWORD` quando o provedor exigir autenticação. `SMTP_SECURE=true` habilita TLS direto (normalmente porta 465); para STARTTLS, normalmente use porta 587 e `SMTP_SECURE=false`. O servidor exige configuração SMTP completa em produção e valida os parâmetros antes de iniciar. Cadastre credenciais no painel seguro da hospedagem, não no repositório nem no chat. Configure as variáveis diretamente no painel da hospedagem; não envie o `.env` da máquina de desenvolvimento, que pode conter configurações locais como `DEV_ADMIN_RM` e faz o servidor recusar a inicialização em produção. Depois de configurar, faça uma implantação de teste e confirme que o e-mail de recuperação chega e que o código permite redefinir a senha. Não configure `DEV_ADMIN_RM` nem `EXPOSE_PASSWORD_RESET_CODE` em produção. O endpoint `GET /api/health` pode ser usado como verificação básica de disponibilidade.

Antes de abrir o acesso público, faça uma implantação de homologação e confirme: build e início com `npm ci`, `npm run build` e `npm start`; HTTPS e cookies de sessão no domínio final; envio e uso do código de recuperação por SMTP; cadastro e aprovação de funções administrativas; empréstimo e devolução; persistência depois de reiniciar o serviço; e restauração de um backup do SQLite. Proteja o volume e os backups, e mantenha `.env` e `data/` fora do controle de versão. Como o SQLite usa modo WAL, faça backups com um procedimento compatível com SQLite ou pare o serviço durante a cópia; não trate apenas a cópia do arquivo principal enquanto o servidor está ativo como backup confiável. Em desenvolvimento local sem SMTP, o código de recuperação pode ser exibido para servidores vinculados ao loopback; `EXPOSE_PASSWORD_RESET_CODE=true` também permite esse recurso explicitamente em outros hosts locais. Não habilite essa opção em produção. Para múltiplas instâncias, armazenamento efêmero ou alta disponibilidade, será necessário mudar a estratégia de banco/armazenamento.

O primeiro administrador precisa ser provisionado por configuração de ambiente antes que o cadastro público seja habilitado. Não use credenciais de exemplo em produção. Cadastros administrativos posteriores devem ser criados por uma conta autorizada. Como o cadastro público não confirma o e-mail nem verifica a identidade associada ao RM, avalie essa política com a instituição antes de liberar o endereço publicamente. Senhas novas devem ter no mínimo 12 caracteres e no máximo 72 bytes (limite do bcrypt), sem restrição a números ou composição fixa. Na primeira inicialização após esta atualização, contas existentes sem data de troca de senha serão obrigadas a atualizar a senha antes de acessar o sistema; a sessão anterior é invalidada. A recuperação da senha exige um código de seis dígitos enviado ao e-mail institucional cadastrado, válido por 15 minutos e com tentativas limitadas.

Empréstimos são registrados sem aprovação administrativa. A disponibilidade é verificada e atualizada no momento do registro; no cadastro informa-se apenas o horário previsto de devolução, considerando o próximo horário futuro (hoje ou amanhã). Datas e horários são tratados e exibidos no fuso `America/Sao_Paulo`, independente do fuso configurado no servidor. O mapa apresenta LMT e Maker como locais de acervo, organiza as 24 salas de aula em dois blocos, A e B, com 12 salas por bloco, e lista os empréstimos ativos na sala escolhida. Após dez tentativas falhas de login, o bloqueio dura 30 segundos.
