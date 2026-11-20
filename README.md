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

## Beta e contas

O beta é servido pelo Firebase Hosting em [Oficina do Vale](https://oficina-do-vale-beta.web.app/). Visitantes salvam no navegador. Contas Google têm uma partida privada por conta, com cópia local para continuar quando a nuvem estiver indisponível.

Um save que está no `localhost` pode ser exportado em **Salvar** e importado usando o mesmo menu no beta. Depois, entre com Google e escolha **Levar minha partida local** se a conta estiver vazia. Saves de visitante e de conta são separados.

Para rodar somente com save local, basta iniciar o Vite sem variáveis Firebase. Para testar contas localmente, configure `.env.local` a partir de `.env.example` com um projeto `demo-oficina-do-vale`, valores fictícios para a chave e o ID de app, e `VITE_FIREBASE_EMULATORS=true`. Rode `firebase emulators:start --only auth,firestore --project demo-oficina-do-vale` em outro terminal.

Para publicar, obtenha a configuração pública do aplicativo Web no console do Firebase e preencha `.env.production.local` a partir de `.env.example`. Use `oficina-do-vale-beta.web.app` como domínio de autenticação neste beta. Mantenha o login Google habilitado e autorize o domínio de publicação no Firebase Authentication. Rode `npm run build` e `firebase deploy --only firestore:rules,firestore:indexes,hosting --project oficina-do-vale-beta`.

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
