# Integração Infleet — JRS GUINDASTES

## Estado de implantação
A interface **Gestão → Integração Infleet** já existe no aplicativo JRS, com:
- acesso ao [painel oficial da Infleet](https://app.infleet.com.br/);
- consulta do status da conexão (não declara "conectado" se não houver backend autenticado);
- relação dos veículos/equipamentos existentes na JRS;
- associação pelo número da placa após resposta real da API;
- cadastro opcional de ID externo da Infleet para resolver equipamentos sem placa ou correspondências ambíguas;
- indicadores de total de ativos JRS, correspondências efetivas e últimas leituras recentes, sem dados simulados.

**Não está ativa a integração automática**. A aplicação atualmente usa um **site estático na Render**, com autenticação demonstrativa no navegador e sem token Infleet fornecido pelo usuário. Não é seguro enviar token Infleet pelo frontend, publicar segredos no GitHub ou permitir que o login local seja considerado autorização para expor posições de veículos. A integração de Markponto para RH é um projeto separado e também necessita validação do método de acesso e de credenciais.

## Capacidades oficiais
Documentação pública:
- https://help.infleet.com.br/pt-BR/articles/16447926-como-integrar-seus-sistemas-a-infleet-api-graphql-e-webhook
- https://docs.api.infleet.com.br/boas-vindas
- https://help.infleet.com.br/pt-BR/articles/15922347-como-criar-um-webhook-para-receber-posicoes-e-eventos-de-telemetria-e-videotelemetria

A **API GraphQL** oficial usa HTTPS `https://api.infleet.com.br/v1/graphql` com autenticação `Authorization: Bearer [TOKEN]`, liberado pelo suporte Infleet. A API é destinada a consultas/cadastros de veículos, motoristas, posição, viagens, indicadores, abastecimento e manutenção sob demanda.

Para telemetria contínua, os **webhooks** Infleet fazem `POST` para servidor HTTPS público configurado em Integrações → Webhooks. O backend deve responder 2xx em menos de 3 segundos, verificar header secreto e deduplicar eventos por UUID, porque o provedor tem estratégia de entrega pelo menos uma vez. Não confiar em origem sem validar header de autenticação.

## Contrato de backend esperado na mesma origem JRS
O frontend só considera conectado se esta chamada do **backend autenticado** responder:

`GET /api/integracoes/infleet/status`

```json
{
  "connected": true,
  "provider": "Infleet",
  "auth": "server"
}
```

O backend deverá confirmar a sessão do usuário no servidor e validar papéis de acesso; o status não deve devolver token nem dados privados.

A consulta manual de frota usa:

`GET /api/integracoes/infleet/frota`

Resposta normalizada pelo backend:

```json
{
  "provider": "Infleet",
  "fetchedAt": "2026-11-03T09:00:00-03:00",
  "vehicles": [
    {
      "id": "ID_EXTERNO",
      "plate": "ABC1D23",
      "name": "Veículo (exemplo de esquema)",
      "driver": "Motorista (exemplo de esquema)",
      "position": {
        "label": "Localidade (se fornecida)",
        "recordedAt": "2026-11-03T08:55:00-03:00",
        "speedKmh": 0,
        "ignition": false,
        "valid": true
      },
      "odometerKm": null,
      "engineHours": null
    }
  ]
}
```

**Isto é apenas o contrato ilustrativo dos campos. Não é uma consulta real.** O backend traduz os formatos efetivos disponíveis na conta Infleet, nunca inventa posição, velocidade, status ou motorista. Campos ausentes são `null`/não informados. Quando `position.valid === false`, a interface sinaliza posicionamento inválido.

Proteções fundamentais:
1. **Servidor web autenticado**, com login real e autorização por usuário JRS e escopo de frota. O login local da demo não protege um endpoint público.
2. Token Infleet guardado somente como segredo do backend, nunca no navegador, URL, arquivo .env no GitHub ou mensagens.
3. HTTPS, autorização de CORS/referer e CSRF conforme a arquitetura escolhida, log de auditoria e limites de requisições.
4. Verificação de placa única para o vínculo automático; caso haja duplicidade, exigir mapeamento manual de ID. Validar divergência entre ID vinculado e placa.
5. Políticas LGPD de finalidade, retenção e acesso, pois posições e jornadas de motoristas são informações sensíveis ao contexto de trabalho.
6. API consultada sob demanda; sem polling intenso de toda a frota. Usar webhook para telemetria contínua quando de fato implementado.
7. Nunca considerar veículo `livre` apenas porque tem ignição desligada ou está parado: disponibilidade de locação continua independente da telemetria.

## Sequência de ativação
- Solicitar à Infleet a liberação de **API GraphQL** para conta JRS e token de acesso.
- Implantar no Render um **serviço de backend autenticado** e armazenar o token em variável de ambiente secreta.
- Construir consultas reais conforme o schema da documentação e mapear resposta para contrato acima.
- Validar com uma placa, verificar horário/posição, e então habilitar restante da frota.
- Para alertas em tempo real, adicionar endpoint webhook com segredo/UUID de idempotência e persistência segura.

Neste repositório o frontend está pronto para estes endpoints. **Eles ainda não existem no site estático.**
