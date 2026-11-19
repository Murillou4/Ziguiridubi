# Oficina do Vale

Jogo de progressão ativa em Canvas 2D, com interface DOM, TypeScript e Vite.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm

## Desenvolvimento

```bash
npm install
npm run dev
```

O Vite inicia o jogo em `http://localhost:5173`.

## Verificações

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## Estrutura

- `src/app`: composição e ciclo de vida da aplicação.
- `src/core`: game loop, relógio, eventos e utilitários.
- `src/domain`: estado, tipos e atributos derivados.
- `src/gameplay`: sistemas independentes de gameplay.
- `src/config`: definições de recursos, mundo e progressão.
- `src/rendering`: renderização Canvas 2D.
- `src/input`: teclado, mouse e controles touch.
- `src/audio`: música procedural e efeitos.
- `src/ui`: HUD, modais e interface DOM.
- `src/persistence`: salvamento, importação e migração de saves.

O ponto de entrada atual é `src/main.ts`, carregado por `index.html`.

## Arquivo legado

`oficina_do_vale.html` é mantido como referência da implementação original. O jogo modular não deve importar código desse arquivo.
