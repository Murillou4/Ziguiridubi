# Plano de migração arquitetural — Oficina do Vale

## Estado desta branch

A base modular TypeScript já está implementada no repositório. Esta branch fecha a infraestrutura que faltava para que ela possa ser executada, validada e mantida com um fluxo de desenvolvimento reproduzível.

### Concluído no código

- [x] Estrutura modular em `src/` para app, core, domínio, gameplay, configuração, renderização, input, áudio, UI e persistência.
- [x] Sistemas de gameplay extraídos em módulos TypeScript.
- [x] Renderizadores Canvas 2D especializados.
- [x] Interface DOM organizada em views e modais.
- [x] Serviço de save, repositório LocalStorage e normalização/migração de payload.
- [x] Manifesto npm, Vite e configuração de TypeScript.
- [x] Entrada do jogo apontando diretamente para `src/main.ts`.
- [x] Testes unitários iniciais para inventário, atributos derivados e migração de save.
- [x] Workflow de CI para typecheck, testes e build de produção.
- [x] Cópias JavaScript redundantes removidas de `src/`; os módulos TypeScript são a fonte de verdade.

### Pendências de validação e evolução

- [ ] Confirmar o resultado do primeiro workflow de CI desta branch.
- [ ] Corrigir todos os erros encontrados pelo typecheck/build sem afrouxar a tipagem global.
- [ ] Ampliar a cobertura de testes para coleta, economia, máquinas, construções, drones, contratos, upgrades e expedições.
- [ ] Validar manualmente no navegador os fluxos de teclado, mouse, touch, HUD e modais.
- [ ] Extrair de `GameApp` as rotinas de interação/coordenação que ainda carregam regras específicas de gameplay, preservando o comportamento.
- [ ] Confirmar importação de backups reais exportados pela implementação legada.

## Critério de conclusão

A migração só deve ser considerada concluída depois que o CI passar e os fluxos principais forem validados no navegador. A existência de módulos separados, isoladamente, não é prova de que a migração está funcional.


---

## 10. Refinamento de controladores e regressão (novembro de 2026)

- [x] Criar contexto de runtime com dependências explícitas e getters que acompanham troca de estado/jogador.
- [x] Extrair interações de jogador para `PlayerInteractionController`.
- [x] Extrair simulação por frame para `GameSimulationController`.
- [x] Reduzir `GameApp` a composição, ciclo de vida, eventos de infraestrutura, save/reset e renderização coordenada.
- [x] Adicionar testes para máquinas, drones, construções, economia e contratos.
- [x] Adicionar testes de navegador com Playwright para Chromium desktop e mobile emulado.
- [x] Aguardar e verificar o resultado do CI desta branch.
- [x] Revisar screenshots e traces produzidos pelo Playwright.
- [ ] Fazer inspeção visual em dispositivo físico (iOS/Android) e conferir ergonomia/gestos reais.
- [x] Expandir testes de browser para inicialização, movimento por teclado e clique, abertura/fechamento do mercador, controles touch e joystick virtual.
- [ ] Expandir testes de browser para construção via mundo, coleta, fluxo de save/import e modais restantes.

Os testes automatizados de navegador exercitam eventos reais de teclado e touch em navegador Chromium, mas não devem ser descritos como validação manual em hardware físico. A migração só será marcada como concluída após o CI passar e a inspeção visual pendente ser feita.


### Ajuste de responsividade após inspeção visual

- [x] Reduzir a largura do cartão de objetivo em telas mobile e limitar a área do bloco de recursos.
- [x] Adicionar asserção Playwright para garantir que a linha superior do HUD não ultrapasse a largura do viewport.
