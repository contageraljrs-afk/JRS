# Integração Assertiva Análise 360 · JRS Guindastes

## Estado atual
A navegação do aplicativo contém **Consultas · Assertiva**. A página disponibiliza um campo de CPF ou CNPJ, indicadores de **score**, **protestos** e **restrições**, além de acesso ao [painel oficial da Assertiva](https://painel.assertivasolucoes.com.br/).

**A integração por API ainda não está ativa**. O aplicativo atual da JRS é um site estático no Render, com login demonstrativo armazenado no navegador. Não existe servidor com autenticação segura para a consulta de dados financeiros, nem credenciais Assertiva confirmadas. Nenhum score, protesto ou negativação é presumido.

## Requisitos para consultas reais no próprio aplicativo
1. Contrato Assertiva com permissão para a **API Análise 360 — módulo Restritivo**, abrangendo score, protestos e registros de débitos para PF/PJ (cobertura depende do contrato).
2. Credenciais **Client ID** e **Secret** geradas no painel Assertiva por administrador. Não colá-las no HTML, JavaScript do navegador, repositório nem em mensagens. Configurá-las como segredos de um backend seguro no Render.
3. Identidade e sessão **verificadas no servidor**, com autorização por função, auditoria, controle de taxa e finalidade de uso documentada (LGPD). O login local atual do aplicativo não é suficiente.
4. Hospedar serviço web/backend, em vez de depender exclusivamente de hospedagem estática.
5. Ajustar e testar a **normalização do payload** real contratado: reportar desconhecido/indisponível quando o produto não oferecer determinado campo, nunca interpretar ausência de campo como “nome limpo”.

## API Assertiva (oficial)
- Base: `https://api.assertivasolucoes.com.br`
- Token: `POST /oauth2/v3/token` com **HTTP Basic Client ID:Secret**, formulário `grant_type=client_credentials`.
- Consultas PF: `GET /score/v3/pf/credito/{cpf}?idFinalidade=2`
- Consultas PJ: `GET /score/v3/pj/credito/{cnpj}?idFinalidade=2`
- O `idFinalidade=2` é voltado ao **ciclo de crédito**; utilizar apenas quando a finalidade real da JRS corresponder à hipótese autorizada. A Assertiva também documenta `4` (execução de contrato).
- Consultas podem retornar **HTTP 202** e detalhes parciais de protestos. Prever estado de processamento.
- **Não** enviar chaves API nem CPF/CNPJ para provedores intermediários não autorizados.

## Contrato do frontend JRS (para backend futuro)
A página atual verifica a mesma origem do aplicativo em:

`GET /api/consultas-credito/status`

Resposta de prontidão **somente após implantação do backend autenticado**:

```json
{"enabled": true, "provider": "Assertiva", "auth": "server"}
```

A consulta deve utilizar sessão autenticada, `POST /api/consultas-credito`:

```json
{"document":"DOCUMENTO_SEM_PONTUACAO"}
```

O servidor deve entregar **somente dados normalizados do serviço oficial**:

```json
{
  "provider": "Assertiva",
  "consultedAt": "2026-11-02T12:00:00-03:00",
  "score": {"value": null, "min": null, "max": null},
  "protests": {"status": "unavailable"},
  "restrictions": {"status": "unavailable"}
}
```

Este exemplo ilustra **campos não disponíveis**, não um relatório real. Para protestos e restrições, os status possíveis são `found`, `none` ou `unavailable`, e `none` só pode ser retornado se o relatório explicitar ausência, não apenas por não conter dados.

## Segurança e custos
- Consultas podem gerar cobrança pela Assertiva e exigem finalidade autorizada. Proteja acesso no **servidor** e mantenha um registro mínimo de auditoria sem logs com documentos completos.
- Use HTTPS, segredos de ambiente, criptografia/controle de retenção quando houver persistência e confidencialidade por usuário.
- Nunca exponha o retorno bruto da API sem filtrar dados que a interface não precisa.
- Não basta ativar um booleano no navegador: o frontend só habilita consulta quando o backend informa status autenticado na mesma origem.

### Documentação oficial
- https://integracao.assertivasolucoes.com.br/v3/portal/credito
- https://intercom.help/assertiva/pt-BR/articles/16276395-api-assertiva-analise-360
- https://intercom.help/assertiva/pt-BR/articles/16275420-como-gerar-credenciais-e-token-de-acesso-para-as-apis-da-assertiva
