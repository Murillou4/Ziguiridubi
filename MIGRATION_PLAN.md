# PLANO DE MIGRAÇÃO ARQUITETURAL — OFICINA DO VALE

Este documento estabelece o roteiro de execução da refatoração progressiva do projeto **Oficina do Vale**, migrando do modelo de arquivo único (`oficina_do_vale.html`) para um **Modular Monolith** desacoplado, com TypeScript, ES Modules, Canvas 2D e interface DOM independente.

---

## Fases de Execução

### Fase 1 — Auditoria e Planejamento (Concluída)
- [x] Inspecionar todo o monólito existente de 4.423 linhas.
- [x] Mapear classes (`SoundEngine`, `OficinaDoValeGame`), estruturas de dados, tabelas de configurações e métodos.
- [x] Identificar variáveis de estado (Persistent, Runtime, UI).
- [x] Mapear fluxo de entrada, simulação física, nós de recursos, máquinas, drones, contratos, dirigível e economia.
- [x] Produzir `ARCHITECTURE.md` e `MIGRATION_PLAN.md`.

### Fase 2 — Infraestrutura e Configuração do Projeto
- [ ] Criar estrutura de diretórios (`src/`, `src/core`, `src/domain`, `src/config`, `src/gameplay`, `src/rendering`, `src/input`, `src/audio`, `src/ui`, `src/persistence`, `src/app`, `tests/`).
- [ ] Configurar `package.json` com scripts de desenvolvimento, build e testes.
- [ ] Configurar `tsconfig.json` para validação rigorosa de tipos TypeScript.
- [ ] Configurar `vite.config.ts` e `vitest.config.ts`.
- [ ] Criar executor de testes (`tests/runner.html`) para execução de testes unitários diretamente no navegador sem dependências externas.

### Fase 3 — Domínio e Configurações Imutáveis
- [ ] Extrair tipos TypeScript (`src/domain/types.ts`).
- [ ] Extrair estado inicial e modelo de dados (`src/domain/GameState.ts`, `src/domain/PlayerState.ts`).
- [ ] Extrair cálculo de atributos e bônus (`src/domain/Stats.ts`).
- [ ] Extrair configurações orientadas a dados (`src/config/`):
  - `resources.ts`
  - `upgrades.ts`
  - `specializations.ts`
  - `buildings.ts`
  - `machines.ts`
  - `contracts.ts`
  - `airshipRoutes.ts`
  - `phases.ts`
  - `world.ts`

### Fase 4 — Core e Infraestrutura Base
- [ ] Implementar `GameClock.ts` e `GameLoop.ts` com timestep seguro.
- [ ] Implementar `EventBus.ts` com tipagem de eventos desacoplada.
- [ ] Implementar `MathUtils.ts` com funções geométricas e colisões.

### Fase 5 — Sistemas de Gameplay
Extrair os sistemas de simulação pura sem acoplamento visual ou de DOM:
- [ ] `InventorySystem.ts`: controle de mochila física, armazém, transferências e consumo.
- [ ] `PlayerSystem.ts`: movimentação (teclado/joystick/clique), desaceleração, tilt e dash.
- [ ] `WorldSystem.ts`: nós de recursos, colisão em ilhas e pontes (`isPointWalkable`), respawn.
- [ ] `GatheringSystem.ts`: cálculo de golpes, Sweet Spot rítmico, acerto crítico e geração de drops.
- [ ] `BuildingSystem.ts`: depósito de recursos em zonas amarelas e conclusão de blueprints.
- [ ] `MachineSystem.ts`: produção da Serraria, Fornalha e Oficina de Engrenagens.
- [ ] `DroneSystem.ts`: inteligência autônoma dos drones lenhadores e mineradores.
- [ ] `EconomySystem.ts`: venda direta e venda de excedentes.
- [ ] `ContractSystem.ts`: contratos da vila e reposição de contratos.
- [ ] `UpgradeSystem.ts`: compra e aplicação de melhorias.
- [ ] `ProgressionSystem.ts`: avanço de fases e seleção de especialização.
- [ ] `AirshipSystem.ts`: expedições aéreas, contagem de tempo e coleta de recompensas.

### Fase 6 — Motor de Renderização 2.5D
Separar o Canvas 2D em componentes focados exclusivamente em desenhar o estado atual:
- [ ] `Camera.ts`: interpolação suave e tremor (*shake*).
- [ ] `WorldRenderer.ts`: céu, nuvens procedurais e ilhas flutuantes.
- [ ] `ResourceRenderer.ts`: árvores, rochas, minério de ferro, cristais e anel rítmico de Sweet Spot.
- [ ] `BuildingRenderer.ts`: banca do mercador, bancada/baú, zonas amarelas tracejadas, estruturas prontas e dirigível animado.
- [ ] `PlayerRenderer.ts`: artesão, chapéu, ferramenta orientada, arco de golpe e pilha 3D de itens nas costas.
- [ ] `DroneRenderer.ts`: drones voadores com hélices e orbes de carga.
- [ ] `EffectsRenderer.ts`: partículas de impacto, textos flutuantes, orbes no chão e seta guia dourada.
- [ ] `CanvasRenderer.ts`: orquestrador de todas as camadas de renderização.

### Fase 7 — Entrada, Áudio e Persistência
- [ ] `InputManager.ts` & `VirtualJoystick.ts`: centralização de teclado, mouse e touch mobile.
- [ ] `AudioManager.ts`, `LofiMusic.ts`, `SoundEffects.ts`, `AudioSettings.ts`: sintetizador Web Audio procedural.
- [ ] `SaveRepository.ts`, `SaveMigrator.ts`, `SaveService.ts`: persistência isolada com retrocompatibilidade total (`oficina_do_vale_save_v2`, `ODV1_`, JSON).

### Fase 8 — Interface e Camada de Aplicação
- [ ] Separar a interface DOM em componentes dedicados:
  - `HUDView.ts`
  - `WorldInspectionCard.ts`
  - `MerchantModal.ts`
  - `WorkshopModal.ts`
  - `ProjectsModal.ts`
  - `AirshipModal.ts`
  - `TransferModal.ts`
  - `SettingsModal.ts`
  - `HowToPlayModal.ts`
  - `ToastManager.ts`
  - `MobileControls.ts`
  - `UIManager.ts`
- [ ] Implementar `GameApp.ts`, `createGame.ts` e `main.ts`.
- [ ] Criar o novo `index.html` limpo e modular.

### Fase 9 — Testes Unitários e Validação Completa
- [ ] Testes de inventário e capacidade.
- [ ] Testes de economia e vendas de excedentes.
- [ ] Testes de acertos críticos e cálculo de rendimento.
- [ ] Testes de produção de máquinas e multiplicadores.
- [ ] Testes de compra de upgrades e requisitos.
- [ ] Testes de progressão e fases.
- [ ] Testes de contratos e substituição.
- [ ] Testes de expedições aéreas do dirigível.
- [ ] Testes de serialização e retrocompatibilidade de saves antigos (ODV1_ e formato legado).
- [ ] Validação de execução completa no navegador.
