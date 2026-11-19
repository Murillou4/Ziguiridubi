# ARQUITETURA DE SOFTWARE — OFICINA DO VALE

## 1. Visão Geral do Projeto

**Oficina do Vale** é um jogo incremental de progressão ativa em 2.5D com temática artesanal e estética aconchegante (Cozy Steampunk). O jogador controla um artesão que explora um arquipélago de ilhas flutuantes celestes, colhendo madeira, pedra, ferro e cristais etéreos com um sistema rítmico de golpe crítico (*Sweet Spot*), processando matérias-primas em máquinas manuais e a vapor, vendendo produtos na Banca do Mercador, cumprindo contratos de entrega, investindo em árvores de melhorias e especializações, construindo pontes e estações através de zonas de projeto (*Blueprints*), e comissionando dirigíveis para expedições lucrativas.

O jogo é implementado utilizando **HTML5 Canvas 2D** para a renderização do mundo e entidades, combinado com **DOM / Tailwind CSS** para interface rica e responsiva, além da **Web Audio API** para síntese procedural de música Lo-Fi e sonoplastia (*Foley*).

---

## 2. Diagnóstico da Implementação Atual (Legada)

### 2.1. Estrutura Anterior
Originalmente, todo o código do jogo estava concentrado em um único arquivo de 4.423 linhas (`oficina_do_vale.html`), dividido em:
- **Estilos Globais e Tailwind CSS (linhas 1-108)**
- **Elementos DOM do Jogo (linhas 109-563)**: HUD, barras de progresso, docking inferior, 7 modais (Mercador, Upgrades, Projetos, Dirigível, Transferência, Como Jogar, Opções), cartão flutuante de inspeção de zonas (*World Inspection Card*) e controles touch para mobile.
- **Classe `SoundEngine` (linhas 574-945)**: Sintetizador Web Audio API procedural Lo-Fi (gerador de ruído de vinil, sequenciador de acordes, bumbo, aro) e gerador de efeitos sonoros com osciladores e envelopes.
- **Constantes Globais de Configuração (linhas 946-1255)**: `RESOURCES`, `UPGRADE_CATEGORIES`, `UPGRADES_DEF`, `SPECIALIZATIONS`, `AIRSHIP_ROUTES`, `PHASES_INFO`.
- **Classe Deus `OficinaDoValeGame` (linhas 1256-4417)**: Monólito central acumulando absolutamente todas as responsabilidades do jogo.

### 2.2. Problemas Arquiteturais Identificados no Monólito

1. **Violação Massiva do Princípio de Responsabilidade Única (SRP)**:
   A classe `OficinaDoValeGame` continha mais de 3.100 linhas cuidando simultaneamente de:
   - Simulação física do jogador (movimentação, aceleração, dash, colisões em retângulos de ilhas e pontes).
   - Coleta rítmica (*Sweet Spot*), cálculo de ângulos de golpe e dano em nós.
   - Gerenciamento de inventário duplo (mochila física empilhável + armazém central).
   - Produção incremental em máquinas (Serraria, Fornalha, Oficina).
   - Inteligência artificial dos drones autônomos (máquina de estados `seek` -> `move` -> `harvest` -> `return`).
   - Economia, preços, multiplicadores, contratos aleatórios e venda de excedentes.
   - Expedições aéreas do dirigível e contagem de tempo em segundos.
   - Renderização gráfica 2.5D com sombras, oscilações senoidais, camadas de nuvens, ilhas, estruturas, efeitos de partículas e textos flutuantes.
   - Manipulação direta de dezenas de nós do DOM a cada frame ou tick.
   - Persistência e serialização no `localStorage`, geração de strings Base64 (`ODV1_`) e download de arquivos `.json`.
   - Eventos de teclado, mouse, touch e joystick virtual mobile.

2. **Acoplamento Extremo entre Simulação e Renderização**:
   Métodos de renderização acessavam variáveis internas e calculavam posições e oscilações no meio da chamada `render()`. Textos flutuantes e partículas eram gerados dispersos por todo o código de gameplay.

3. **Acoplamento com a Interface DOM**:
   O código de gameplay executava mutações manuais em classes Tailwind, alterando estilos *inline* de elementos como `card.style.left`, `resBar.innerHTML`, `bpFill.style.width` sem qualquer abstração ou componente de UI dedicado.

4. **Persistência Acoplada**:
   Operações com `localStorage` e serialização Base64 estavam embutidas dentro da lógica de gameplay, dificultando testes unitários e tornando o salvamento vulnerável a falhas de consistência.

5. **Dificuldade de Testabilidade**:
   Era impossível testar uma regra de negócio simples (como a fórmula de acerto crítico, a produção de uma máquina ou a migração de um save antigo) sem instanciar toda a janela do navegador, o elemento `<canvas>` e a Web Audio API.

---

## 3. Arquitetura Alvo: Modular Monolith por Domínio

A nova arquitetura adota o padrão de **Modular Monolith** desacoplado, organizado estritamente por domínios e responsabilidades bem delineadas:

```
┌───────────────────────────────────────────────────────────────┐
│                       GameApp (App Layer)                     │
│                Inicialização, Composição & Ciclo de Vida      │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
        ┌───────▼────────┐              ┌───────▼────────┐
        │   GameLoop     │              │  InputManager  │
        │   & Clock      │              │  (Keys, Mouse, │
        └───────┬────────┘              │     Touch)     │
                │                       └───────┬────────┘
                │ update(dt)                    │ Actions
        ┌───────▼───────────────────────────────▼────────┐
        │            Gameplay Systems (Domain)           │
        │  • PlayerSystem        • EconomySystem         │
        │  • GatheringSystem     • UpgradeSystem         │
        │  • InventorySystem     • ProgressionSystem     │
        │  • BuildingSystem      • ContractSystem        │
        │  • MachineSystem       • AirshipSystem         │
        │  • DroneSystem         • WorldSystem           │
        └───────┬───────────────────────────────┬────────┘
                │                               │
                │ Mutates State                 │ Notifications
        ┌───────▼────────┐              ┌───────▼────────┐
        │   GameState    │              │    EventBus    │
        │  (Persistent,  │              │ (Desacoplado & │
        │  Runtime, UI)  │              │     Tipado)    │
        └───────┬────────┘              └───────┬────────┘
                │                               │
        ┌───────┴────────┬──────────────┬───────┴────────┐
        │ Reads State    │ Reads State  │ Reads State    │
┌───────▼────────┐┌──────▼───────┐┌─────▼────────┐┌──────▼───────┐
│ CanvasRenderer ││  UIManager   ││ SaveService  ││ AudioManager │
│ (Mundo, Nós,   ││ (HUD, Modais,││ (Repository, ││ (Música Lo-Fi│
│  Entidades)    ││  Cartão WIC) ││  Migrator)   ││   & Foley)   │
└────────────────┘└──────────────┘└──────────────┘└──────────────┘
```

---

## 4. Camadas do Sistema e Responsabilidades

### 4.1. Camada de Aplicação (`src/app/`)
- **`GameApp.ts`**: Coordena os subsistemas do jogo sem conter regras de negócio. Inicializa o loop, injeta dependências e gerencia as transições de estado (tela inicial, jogo ativo, encerramento).
- **`createGame.ts`**: Factory function encarregada de instanciar e conectar todos os serviços, sistemas e renderizadores.
- **`main.ts`**: Ponto de entrada da aplicação, responsável por acoplar o DOM inicial e acionar o ciclo de vida.

### 4.2. Núcleo de Execução (`src/core/`)
- **`GameLoop.ts`**: Controla o `requestAnimationFrame` separando estritamente `update(dt)` (atualização lógica da simulação) e `render()` (apresentação visual). Impõe limitador de delta-time (máx. 0.05s) para evitar saltos quânticos de física em caso de perda de foco.
- **`GameClock.ts`**: Medidor de tempo de execução, tempos globais do mundo e contadores de hit-stop.
- **`EventBus.ts`**: Canal leve de mensagens tipadas para eventos de notificação (ex.: `node:harvested`, `save:completed`, `airship:returned`, `blueprint:completed`), garantindo desacoplamento entre gameplay e efeitos sonoros/UI.
- **`MathUtils.ts`**: Utilitários matemáticos puros (distâncias euclidianas, interpolação linear `lerp`, normalização angular, detecção de retângulos).

### 4.3. Camada de Domínio (`src/domain/`)
Separa claramente os três tipos de estado:
1. **Persistent State (`GameState.ts`)**:
   Estrutura estrita serializável que persiste entre sessões:
   - `phase`: número da fase atual (1 a 6).
   - `storage`: recursos acumulados no armazém (madeira, pedra, tábuas, ferro, lingotes, engrenagens, núcleos, cristais, relíquias, plantas técnicas, moedas).
   - `upgrades`: níveis atuais de cada upgrade.
   - `specialization`: id da especialização ativa (`artisan`, `airshipMagnate`, `automataEngineer` ou `null`).
   - `builds`: mapa de progresso de cada blueprint (se foi construída e recursos já depositados).
   - `trackedBuildId`: id do projeto atualmente rastreado pela seta dourada.
   - `machines`: progresso interno das máquinas de processamento.
   - `airship`: rota ativa, tempo decorrido, duração e status de retorno.
   - `contracts`: contratos vigentes gerados.
   - `stats`: estatísticas totais (recursos colhidos, acertos críticos, moedas ganhas).
2. **Runtime State (`PlayerState.ts`, entidades)**:
   - Posição do jogador (`x`, `y`), velocidades (`vx`, `vy`), orientação angular, balanço da caminhada, temporizadores de golpe, dash e invulnerabilidade, lista física de itens na mochila.
   - Nós de recursos ativos e seus contadores de respawn e anéis de Sweet Spot.
   - Drops de recursos voando no chão com física 3D simulada (`x`, `y`, `z`, `vz`).
   - Drones autônomos e seus respectivos estados operacionais.
   - Partículas e textos flutuantes temporários.
   - Câmera e valores de tremor de impacto (*Screen Shake*).
3. **UI State**:
   - Modal atualmente aberto, aba de upgrades ativa, blueprint inspecionada, hover do mouse.

- **`types.ts`**: Interfaces e tipos TypeScript de recursos, upgrades, nós, construções, contratos, expedições e rotas.
- **`Stats.ts`**: Funções puras para calcular todos os atributos derivados com base nas melhorias e especializações do jogador (velocidade de golpe, alcance, bônus de acerto crítico, capacidade da mochila, raio magnético, velocidade dos drones, etc.).

### 4.4. Definições e Configuração de Conteúdo (`src/config/`)
Isolamento absoluto de dados e fórmulas em arquivos imutáveis orientados a dados:
- `resources.ts`: Catálogo de 11 recursos com nomes, ícones, cores, preços e tiers.
- `upgrades.ts`: Definição de 15 upgrades em 5 categorias, tabelas de custos e textos de efeito.
- `specializations.ts`: As 3 builds de especialização (Artesão Mestre, Magnata Aéreo, Engenheiro de Automação).
- `buildings.ts`: Definições das 8 Zonas de Projeto Amarelas (Serraria, Fornalha, Oficina, Estação de Drones, 3 Pontes e Cais).
- `contracts.ts`: Templates de contratos gerados proceduralmente por fase.
- `airshipRoutes.ts`: As 3 rotas de expedição aérea, durações, custos de carga e recompensas.
- `phases.ts`: Descrições e objetivos das 6 fases de progressão.
- `world.ts`: Posições e tamanhos das 4 ilhas flutuantes e layout inicial de nós de recursos.

### 4.5. Sistemas de Gameplay (`src/gameplay/`)
Cada subsistema possui escopo coeso e independente:
- **`PlayerSystem`**: Movimentação com WASD / Setas, clique para andar com suavização, cálculo de tilt e facing, controle de dash e cooldowns.
- **`GatheringSystem`**: Avaliação de raio e arco de golpe, acerto rítmico no anel dourado de *Sweet Spot*, acerto crítico e cálculo de rendimento, emissão de drops.
- **`InventorySystem`**: Adição física à mochila até o limite máximo, descarga automática na bancada de depósito, cálculo de recursos totais (mochila + armazém), consumo inteligente (mochila primeiro, depois armazém).
- **`WorldSystem`**: Validação de pontos caminháveis (`isPointWalkable`), checagem de desbloqueio de ilhas e pontes, atualização de nós e respawn.
- **`BuildingSystem`**: Depósito incremental de materiais nas zonas amarelas, verificação de conclusão, avanço de fase e atualização de projetos rastreados.
- **`MachineSystem`**: Simulação da Serraria (madeira -> tábua), Fornalha (ferro -> lingote) e Oficina (lingote + tábua -> engrenagem), cálculo de chance de item duplo e modo automático à distância.
- **`DroneSystem`**: Gerenciamento do ciclo de vida dos drones lenhadores e mineradores (procura de nós válidos, deslocamento, extração, retorno ao baú).
- **`EconomySystem`**: Venda direta de recursos unitária ou em lote, venda de excedentes acima de 5 unidades, cálculo de moedas ganhas com multiplicadores de comerciante.
- **`ContractSystem`**: Validação e entrega de contratos, concessão de moedas e plantas técnicas, reposição automática de novas ofertas.
- **`UpgradeSystem`**: Verificação de pré-requisitos, validação de custos, dedução e compra de níveis de melhorias.
- **`ProgressionSystem`**: Transição entre as 6 fases do jogo e ativação de especializações de final de jornada.
- **`AirshipSystem`**: Despacho de expedições, cronometragem em segundos, retorno de carga e coleta de recompensas no cais.

### 4.6. Renderização e Engine (`src/rendering/`)
Responsabilidade exclusiva de desenhar no Canvas 2D sem alterar estado econômico ou simular gameplay:
- **`Camera`**: Posição interpolada suavemente no jogador, gerenciamento de tela e aplicação de *Screen Shake*.
- **`CanvasRenderer`**: Orquestrador das passadas de desenho (Céu -> Nuvens inferiores -> Ilhas -> Pontes/Zonas -> Praça Central -> Nós -> Destino de clique -> Drops -> Jogador -> Drones -> Partículas -> Textos Flutuantes).
- **`WorldRenderer`**: Fundo gradiente celeste, nuvens em movimento e geometria 2.5D das ilhas com bordas e despenhadeiros.
- **`ResourceRenderer`**: Desenho de árvores, ardósia, veios de ferro e cristais etéreos com animação senoidal, barras de vida e anéis concêntricos do *Sweet Spot*.
- **`BuildingRenderer`**: Toldo listrado e placa da Banca do Mercador, baú da Bancada de Upgrades, zonas amarelas com borda tracejada animada e estacas, estruturas industriais ativas com barras de produção e balão a vapor do Dirigível animado.
- **`PlayerRenderer`**: Artesão com chapéu, ferramenta orientada dinamicamente, arco dourado de golpe, rotação e pilha física 3D dos itens empilhados nas costas.
- **`DroneRenderer`**: Drones a vapor com hélices giratórias, flutuação suave e orbes de carga.
- **`EffectsRenderer`**: Partículas de impacto, textos flutuantes de colheita/dano e seta guia dourada apontando para a zona de projeto rastreada.

### 4.7. Sistema de Entrada (`src/input/`)
- **`InputManager`**: Registra listeners globais e emite eventos de intenção de alto nível (`dash`, `swing`, `interact`, `move`), isolando a simulação do DOM.
- **`VirtualJoystick`**: Tratamento dedicado ao joystick na tela para navegação por toque em dispositivos móveis.

### 4.8. Sistema de Áudio (`src/audio/`)
- **`AudioManager`**: Orquestrador com master gain, music gain e sfx gain.
- **`LofiMusic`**: Sintetizador procedural com gerador de chiado de vinil, progressão de 4 acordes Lo-Fi (Fmaj9 -> Em7 -> Dm9 -> Cmaj9), notas arpejadas, bumbo suave e aro de caixa.
- **`SoundEffects`**: Síntese analógica pura para balanço de ferramenta, impacto por tipo de material (madeira, pedra, ferro, cristal), acertos críticos, coleta de itens em combo melódico pentatônico, moedas, marteladas de construção, buzina de dirigível, dash a vapor e fanfarra de upgrade.
- **`AudioSettings`**: Persistência de volumes (Master, Música, SFX) e mutes.

### 4.9. Interface do Usuário (`src/ui/`)
- **`UIManager`**: Coordenador central da interface, atualizando telas apenas quando o estado sofre alterações ou na taxa adequada de tick de HUD (evitando repaints desnecessários a cada frame).
- **`HUDView`**: Barra de recursos com revelação dinâmica de novos materiais, indicador de itens na mochila, status de recarga do dash e cartão de objetivo da fase.
- **`WorldInspectionCard`**: Cartão flutuante posicionado sobre o Canvas em cima da zona amarela mais próxima ou apontada pelo cursor do mouse, com lista de materiais faltantes e botão de ação.
- **`MerchantModal`**, **`WorkshopModal`**, **`ProjectsModal`**, **`AirshipModal`**, **`TransferModal`**, **`SettingsModal`**, **`HowToPlayModal`**: Componentes modulares de controle de modais.
- **`ToastManager`**: Pilha de notificações toast transitórias com animação de entrada e saída.
- **`MobileControls`**: Exibição e sincronização de controles virtuais em telas menores.

### 4.10. Persistência e Compatibilidade (`src/persistence/`)
- **`SaveRepository`**: Acesso isolado ao `localStorage` sob a chave `oficina_do_vale_save_v2`.
- **`SaveMigrator`**: Validador de esquemas e migrador de versões legadas de save, garantindo retrocompatibilidade com saves anteriores.
- **`SaveService`**: Execução de salvamento silencioso e explícito, exportação em Base64 prefixado com `ODV1_`, importação com validação de formato e geração de backups em arquivo `.json`.

---

## 5. Estratégia de Preservação e Compatibilidade

1. **Compatibilidade de Saves**:
   O formato do payload salvo preserva rigorosamente a estrutura esperada pelo jogo:
   ```json
   {
     "version": 1,
     "timestamp": 1732047200000,
     "state": { ... },
     "playerPos": { "x": 0, "y": 55 },
     "audio": { "master": 0.8, "music": 0.55, "sfx": 0.85, "musicMuted": false, "sfxMuted": false }
   }
   ```
2. **Importação e Exportação**:
   Códigos prefixados com `ODV1_` continuam sendo gerados e decodificados com a mesma rotina de Base64 e URI decoding, garantindo que qualquer código antigo compartilhado por jogadores funcione sem perdas.
3. **Mecânicas e Balanço**:
   Nenhuma fórmula de dano, tempo de produção de máquinas, preço de recursos, custo de blueprints ou velocidade de viagem de dirigível foi alterada.


---

## 10. Estado operacional da migração

A aplicação modular utiliza `index.html` como shell da interface e `src/main.ts` como ponto de entrada. O HTML legado `oficina_do_vale.html` é mantido apenas como referência de comportamento e de compatibilidade.

Os módulos TypeScript em `src/` são a fonte de verdade; cópias JavaScript paralelas não devem ser mantidas nessa árvore. O projeto utiliza Vite para servir e empacotar a aplicação, TypeScript para validação estática e Vitest para testes unitários.

### Limite arquitetural conhecido

`GameApp` ainda funciona como coordenador de aplicação e contém alguns fluxos de interação de alto nível (golpe, dash, clique no mundo e interação contextual). Isso mantém a integração atual explícita, mas não deve virar um novo monólito. A extração dessas rotinas para controladores/sistemas especializados é uma etapa de evolução posterior e deve ser feita com testes de regressão, não por uma reescrita arriscada.
