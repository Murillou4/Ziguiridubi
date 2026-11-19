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
