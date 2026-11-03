# Integração Infleet GraphQL — JRS Guindastes

## Situação atual
**Servidor publicado na Render:** https://jrs-infleet-api.onrender.com

**Aplicativo JRS existente:** https://jrs-smart-rental.onrender.com → Gestão → Integração Infleet.

O frontend agora acessa um backend real em Render que chama o endpoint **oficial Infleet** `https://api.infleet.com.br/v1/graphql`. Não acessa diretamente a API da Infleet pelo navegador. O backend foi criado em `infleet-backend/server.js`, com testes em `infleet-backend/server.test.js`.

**Importante:** ainda não foi fornecido nem instalado o token Infleet da JRS; o servidor está em funcionamento, mas sem permissão para consultar os veículos reais até configurar duas variáveis privadas na Render.

## Ativação sem expor o token
1. Solicitar à Infleet o **Bearer token da API GraphQL** da conta JRS (e confirmar permissões de consulta de veículos e posições).
2. Entrar com a conta do administrador em https://dashboard.render.com/web/srv-dbkmaq7b9u1s73fqpdsg
3. No menu **Environment**, cadastrar:
   - `INFLEET_API_TOKEN`: token real da Infleet, **somente valor**, sem o prefixo `Bearer`.
   - `JRS_INFLEET_ACCESS_PASSWORD`: uma senha forte de pelo menos **12 caracteres**, criada pela JRS para proteger a integração.
   - `JRS_APP_ORIGIN`: já configurado para `https://jrs-smart-rental.onrender.com`.
4. Salvar as variáveis e aplicar o deploy/restart no Render. **Nunca** colar o token ou a senha no repositório, frontend ou chat.
5. No aplicativo JRS, entrar em **Integração Infleet → Autenticar integração** e informar **somente** a senha `JRS_INFLEET_ACCESS_PASSWORD`. O token Infleet permanece exclusivamente no servidor.
6. Conferir placas/IDs, horários de posição, velocidade e ignição. O frontend não afirma GPS em tempo real: as posições do GraphQL são consultas sob demanda e podem estar ausentes/atrasadas.

## Chamadas disponíveis
Todos os endpoints do backend foram implementados em:

`https://jrs-infleet-api.onrender.com/api/integracoes/infleet`

- `GET /config`: retorna apenas `configured` e metadados não sensíveis.
- `POST /login` com `{"password":"SENHA_ESCOLHIDA_NA_RENDER"}`: autentica com a senha dedicada e entrega sessão temporária (4h).
- `GET /status`: exige sessão por header `Authorization: Bearer <SESSION_TOKEN>` e confirma se o token da Infleet está no servidor.
- `GET /frota`: exige a mesma sessão e consulta a API GraphQL oficial da Infleet.

A JRS recebe apenas os campos normalizados para seu painel (ID de veículo, placa, nome, horímetro, odômetro, posição, data/hora, velocidade, ignição, validade e nome do motorista quando retornado). CPF, CNH e token original nunca saem do servidor. Sessão é temporária em memória, sem armazenamento da senha no navegador.

O backend consulta `listVehicles` e `listVehiclePositions`. Para limitar impacto: até 100 veículos na listagem e posições de até 30 veículos no intervalo da última hora, sob demanda, com cache de 90 segundos. Relatórios incompletos são rotulados como parciais. Para histórico contínuo seria necessária integração separada via webhook Infleet.

**Limitação:** o esquema e as permissões reais da conta JRS só poderão ser validados depois de cadastrar o token. O backend já possui testes com respostas simuladas, mas não foi realizado acesso a dados reais da Infleet.

## Segurança
- As origens de navegador permitidas são restringidas a `JRS_APP_ORIGIN`; endpoints da frota exigem autenticação adicional por senha dedicada e token de sessão temporário.
- O login atual da aplicação JRS é demonstrativo/local e **não é suficiente para proteger rastreamento**. Por isso a senha extra é obrigatória enquanto não existir autenticação empresarial compartilhada no servidor.
- Sem variável de ambiente, o backend nega consultas; ele **não** tenta acessar veículos com dados fictícios.
- Não há sincronização em background, webhook ou migração dos cadastros locais. O módulo utiliza correspondência por placa/ID, não atualiza automaticamente escalas ou disponibilidade de locação.

## Fontes oficiais
- https://docs.api.infleet.com.br/boas-vindas
- https://docs.api.infleet.com.br/queries/listvehiclepositions
- https://help.infleet.com.br/pt-BR/articles/16447926-como-integrar-seus-sistemas-a-infleet-api-graphql-e-webhook
