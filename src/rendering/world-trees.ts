/**
 * world-trees.ts
 * Árvores do mundo (grande e pequena) desenhadas só com a API Canvas 2D.
 *
 * - Visão 3/4 oblíqua, luz vinda do canto superior esquerdo.
 * - Cada volume de folhagem tem 3 tons (escuro / médio / claro) + contorno
 *   num tom mais escuro do próprio verde (nunca preto).
 * - Sem alocações por frame: todas as listas de cores e posições são
 *   constantes do módulo; o único buffer mutável (DESLOC) é criado uma vez.
 * - Nenhum estado do contexto vaza: tudo fica entre save() e restore().
 *
 * (x, y) = ponto central da base do tronco, no contato com o chão.
 *
 * Nota: o halo "sem borda dura" é feito com camadas translúcidas empilhadas
 * (sem shadowBlur e sem gradientes), o mesmo princípio dos props do mundo.
 */

export interface PropState { time: number; near?: number; active?: number; fruitSeed?: number }
export interface DrawOptions { scale?: number; shadow?: boolean }

// ============================================================================
// Constantes gerais
// ============================================================================

const TAU = Math.PI * 2;

/** Frequências (rad/s) das animações. */
const W_BALANCO = TAU / 3; // balanço parado: ciclo de ~3 s
const W_SACODE = 15;       // sacudida da coleta (~2,4 Hz)
const W_TREMOR = 52;       // tremor do tronco na coleta
const W_PULO = 4.4;        // pulinho quando o jogador está perto

/** Cores de sombra (translúcidas via globalAlpha). */
const COR_SOMBRA = "#10280e";
const COR_SOMBRA_TRONCO = "#1b2a0f";

/** Brilho (halo) quente ao redor da copa: 4 camadas, da mais larga à mais justa. */
const BRILHO_COR = "#ffe58a";
const BRILHO_EXP = [8, 5.5, 3.5, 2];
const BRILHO_ALFA = [0.06, 0.08, 0.1, 0.14];


/** Posições iniciais (fração do espalhamento) das folhas que caem. */
const FOLHA_X = [-0.7, 0.55, -0.15, 0.85, -0.45];

// ============================================================================
// Paletas
// ============================================================================

interface PaletaCopa {
  readonly escuro: string;   // base da copa e lado direito
  readonly medio: string;    // corpo
  readonly claro: string;    // topo à esquerda
  readonly mancha: string;   // manchas de luz
  readonly contorno: string; // contorno fino, verde bem escuro
}

// Verdes naturais próximos dos tons da ilha.
const PAL_GRANDE: PaletaCopa = {
  escuro: "#3b633e",
  medio: "#52794a",
  claro: "#719151",
  mancha: "#8ca668",
  contorno: "#334f34",
};

// Árvore jovem: mesma família, um pouco mais clara.
const PAL_PEQUENA: PaletaCopa = {
  escuro: "#456c44",
  medio: "#618650",
  claro: "#7e9d5d",
  mancha: "#99b471",
  contorno: "#38583a",
};

// Tronco da árvore grande (marrom com veio)
const TG_MEDIO = "#8e5c2c";
const TG_CLARO = "#b87f45";
const TG_ESCURO = "#5f3b1d";
const TG_CONTORNO = "#3f2512";
const TG_VEIO = "#4d2f17";

// Tronco da árvore pequena (marrom claro)
const TP_MEDIO = "#b98a55";
const TP_CLARO = "#dcb07a";
const TP_ESCURO = "#8c6238";
const TP_CONTORNO = "#5e4125";
const TP_NO = "#7b5330";

// ============================================================================
// Configuração de cada árvore (tudo constante do módulo)
// ============================================================================

interface ConfigArvore {
  /** Volumes da copa: [cx, cy, r] por volume, coordenadas relativas à base. */
  readonly blobs: readonly number[];
  readonly nBlobs: number;
  /** Altura (px) usada para normalizar o balanço: quanto mais alto, mais balança. */
  readonly altRef: number;
  readonly pal: PaletaCopa;
  readonly contornoLw: number;
  /** Manchas de luz: [x, y, rx, ry, rot, índiceDoVolume]. */
  readonly manchas: readonly number[];
  readonly nManchas: number;
  /** Sombra de contato: 3 camadas de [dx, dy, rx, ry, alpha]. */
  readonly sombra: readonly number[];
  /** Folhas que caem. */
  readonly folhaY0: number;
  readonly folhaQueda: number;
  readonly folhaEsp: number;
  readonly folhaZig: number;
  readonly folhaRx: number;
  readonly folhaRy: number;
  /** Desenha o tronco; tx = deslocamento horizontal do topo (a base não se move). */
  readonly tronco: (ctx: CanvasRenderingContext2D, tx: number) => void;
}

// Árvore grande (~64 x 84). Ordem: de trás (cima) para a frente (baixo).
const CFG_GRANDE: ConfigArvore = {
  blobs: [
    -9, -61, 17,   // 0: alto à esquerda
    10, -66, 17,   // 1: alto à direita (topo da árvore)
    -18, -43, 14,  // 2: baixo à esquerda
    18, -43, 14,   // 3: baixo à direita
    0, -41, 15,    // 4: baixo ao centro
  ],
  nBlobs: 5,
  altRef: 84,
  pal: PAL_GRANDE,
  contornoLw: 1.2,
  manchas: [
    -14, -69, 4.2, 2.3, -0.5, 0,
    5, -75, 3.4, 1.9, -0.3, 1,
    -24, -50, 3.2, 1.8, -0.6, 2,
  ],
  nManchas: 3,
  sombra: [
    3, 2, 31, 9, 0.1,
    2.5, 1.5, 24, 7.2, 0.16,
    1.5, 1, 15, 4.6, 0.22,
  ],
  folhaY0: -42,
  folhaQueda: 44,
  folhaEsp: 26,
  folhaZig: 5,
  folhaRx: 3.4,
  folhaRy: 1.7,
  tronco: desenharTroncoGrande,
};

// Árvore pequena / jovem (~48 x 64): nuvem com 3 volumes.
const CFG_PEQUENA: ConfigArvore = {
  blobs: [
    0, -49, 14.5,  // 0: topo
    -11, -33, 13,  // 1: esquerda
    11, -33, 13,   // 2: direita
  ],
  nBlobs: 3,
  altRef: 64,
  pal: PAL_PEQUENA,
  contornoLw: 1,
  manchas: [
    -6, -54, 3.4, 1.9, -0.5, 0,
    -16, -38.5, 2.6, 1.5, -0.6, 1,
  ],
  nManchas: 2,
  sombra: [
    2, 1.5, 22, 6.5, 0.1,
    1.6, 1, 17, 5.2, 0.16,
    1, 0.8, 10, 3.4, 0.22,
  ],
  folhaY0: -30,
  folhaQueda: 32,
  folhaEsp: 18,
  folhaZig: 4,
  folhaRx: 2.8,
  folhaRy: 1.4,
  tronco: desenharTroncoPequeno,
};

// ============================================================================
// Estado de animação
// ============================================================================

/** Buffer reutilizado (criado uma única vez): [dx, dy] de cada volume da copa. */
const DESLOC = new Float32Array(16);

/**
 * Balanço horizontal (px) de um ponto na altura normalizada h (0 = base, 1 = topo).
 * Parada: ~1 px de amplitude no topo. Ativa: soma uma oscilação rápida (~2 px).
 * A base (h = 0) quase não se move; o resto cresce com a altura.
 */
function balancoX(t: number, active: number, h: number, fase: number): number {
  const k = 0.4 + 0.6 * h;
  return k * (
    Math.sin(t * W_BALANCO - h * 0.6 + fase) +
    active * Math.sin(t * W_SACODE + h * 1.1 + fase * 2)
  );
}

/** Calcula o deslocamento de cada volume da copa (balanço, pulinho e sacudida). */
function calcularDeslocamentos(cfg: ConfigArvore, t: number, near: number, active: number): void {
  const pulo = near * (0.5 + 0.5 * Math.sin(t * W_PULO)); // 0..1 -> sobe até 1 px
  const b = cfg.blobs;
  for (let i = 0; i < cfg.nBlobs; i++) {
    let h = -b[i * 3 + 1] / cfg.altRef;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    DESLOC[i * 2] = balancoX(t, active, h, i * 0.4);
    DESLOC[i * 2 + 1] = -pulo + active * Math.sin(t * 23 + i * 1.7) * 0.55;
  }
}

// ============================================================================
// Peças de desenho
// ============================================================================

/** Sombra de contato: elipses translúcidas empilhadas, mais larga que o tronco. */
function desenharSombraContato(ctx: CanvasRenderingContext2D, cfg: ConfigArvore): void {
  const s = cfg.sombra;
  ctx.fillStyle = COR_SOMBRA;
  for (let i = 0; i < 3; i++) {
    const b = i * 5;
    ctx.globalAlpha = s[b + 4];
    ctx.beginPath();
    ctx.ellipse(s[b], s[b + 1], s[b + 2], s[b + 3], 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Caminho do tronco grande (levemente curvo, base alargada em raízes). */
function caminhoTroncoGrande(ctx: CanvasRenderingContext2D, m: number, tx: number): void {
  ctx.beginPath();
  ctx.moveTo(-8, 1.2);
  ctx.quadraticCurveTo(-5.6, -1, -4.8, -9);
  ctx.quadraticCurveTo(-6.4 + m, -20, -4.4 + tx, -34);
  ctx.lineTo(4.6 + tx, -34);
  ctx.quadraticCurveTo(3.6 + m, -20, 5.2, -9);
  ctx.quadraticCurveTo(6.2, -1, 9, 1.2);
  ctx.quadraticCurveTo(0, 4, -8, 1.2);
  ctx.closePath();
}

function desenharTroncoGrande(ctx: CanvasRenderingContext2D, tx: number): void {
  const m = tx * 0.4; // o meio do tronco acompanha menos que o topo
  ctx.lineWidth = 1;

  // Raízes discretas
  ctx.fillStyle = TG_MEDIO;
  ctx.strokeStyle = TG_CONTORNO;
  ctx.beginPath();
  ctx.ellipse(-8.2, 0.8, 4.6, 1.9, -0.35, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(8.6, 0.9, 4.2, 1.7, 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // Corpo
  caminhoTroncoGrande(ctx, m, tx);
  ctx.fill();
  ctx.stroke();

  // Faixa de luz (esquerda) e de sombra (direita)
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = TG_CLARO;
  ctx.beginPath();
  ctx.moveTo(-3.4, -4);
  ctx.quadraticCurveTo(-4.4 + m, -18, -2.6 + tx, -31);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = TG_ESCURO;
  ctx.beginPath();
  ctx.moveTo(3.2, -4);
  ctx.quadraticCurveTo(2.4 + m, -18, 3 + tx, -31);
  ctx.stroke();

  // Veios e vincos das raízes
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = TG_VEIO;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-1.4, -4);
  ctx.quadraticCurveTo(-2.4 + m, -12, -1.2 + m * 1.5, -20);
  ctx.moveTo(1.4, -8);
  ctx.quadraticCurveTo(2.2 + m, -15, 1.4 + tx * 0.7, -24);
  ctx.moveTo(-4.2, -2);
  ctx.quadraticCurveTo(-6.2, 0.5, -8.6, 1.8);
  ctx.moveTo(4.4, -2);
  ctx.quadraticCurveTo(6.4, 0.6, 9.2, 1.8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Sombra suave da copa sobre o topo do tronco (recortada no formato do tronco)
  ctx.save();
  caminhoTroncoGrande(ctx, m, tx);
  ctx.clip();
  ctx.fillStyle = COR_SOMBRA_TRONCO;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(-14, -34, 30, 16);
  ctx.fillRect(-14, -34, 30, 11);
  ctx.fillRect(-14, -34, 30, 6);
  ctx.restore();
}

/** Caminho do tronco pequeno (fino e reto, com leve curva). */
function caminhoTroncoPequeno(ctx: CanvasRenderingContext2D, m: number, tx: number): void {
  ctx.beginPath();
  ctx.moveTo(-4.6, 1);
  ctx.quadraticCurveTo(-3.2, -1, -2.6, -6);
  ctx.quadraticCurveTo(-3.4 + m, -14, -2.4 + tx, -28);
  ctx.lineTo(2.6 + tx, -28);
  ctx.quadraticCurveTo(2.4 + m, -14, 2.8, -6);
  ctx.quadraticCurveTo(3.4, -1, 4.8, 1);
  ctx.quadraticCurveTo(0, 3, -4.6, 1);
  ctx.closePath();
}

function desenharTroncoPequeno(ctx: CanvasRenderingContext2D, tx: number): void {
  const m = tx * 0.4;
  ctx.lineWidth = 0.9;

  // Raízes minúsculas
  ctx.fillStyle = TP_MEDIO;
  ctx.strokeStyle = TP_CONTORNO;
  ctx.beginPath();
  ctx.ellipse(-4.2, 0.7, 2.4, 1, -0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(4.4, 0.8, 2.2, 0.9, 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // Corpo
  caminhoTroncoPequeno(ctx, m, tx);
  ctx.fill();
  ctx.stroke();

  // Faixas de luz e sombra
  ctx.lineCap = "round";
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = TP_CLARO;
  ctx.beginPath();
  ctx.moveTo(-1.2, -3);
  ctx.quadraticCurveTo(-1.8 + m, -14, -0.8 + tx, -25);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = TP_ESCURO;
  ctx.beginPath();
  ctx.moveTo(1.4, -3);
  ctx.quadraticCurveTo(1.2 + m, -14, 1.4 + tx, -25);
  ctx.stroke();

  // Pequeno nó de madeira
  const nx = 0.9 + m * 0.5;
  ctx.fillStyle = TP_NO;
  ctx.strokeStyle = TP_CONTORNO;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(nx, -11, 1.5, 2.1, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = TP_CLARO;
  ctx.beginPath();
  ctx.ellipse(nx - 0.4, -11.9, 0.5, 0.8, 0, 0, TAU);
  ctx.fill();

  // Sombra suave da copa sobre o topo do tronco
  ctx.save();
  caminhoTroncoPequeno(ctx, m, tx);
  ctx.clip();
  ctx.fillStyle = COR_SOMBRA_TRONCO;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(-10, -28, 20, 10);
  ctx.fillRect(-10, -28, 20, 6);
  ctx.fillRect(-10, -28, 20, 3);
  ctx.restore();
}

function caminhoCopa(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-30, -47);
  ctx.bezierCurveTo(-33, -56, -27, -65, -20, -68);
  ctx.bezierCurveTo(-15, -80, -1, -83, 9, -78);
  ctx.bezierCurveTo(20, -80, 29, -71, 27, -61);
  ctx.bezierCurveTo(34, -55, 35, -44, 28, -38);
  ctx.bezierCurveTo(24, -33, 18, -32, 13, -33);
  ctx.bezierCurveTo(7, -26, -4, -26, -10, -32);
  ctx.bezierCurveTo(-21, -29, -32, -37, -30, -47);
  ctx.closePath();
}

function desenharRamo(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.quadraticCurveTo(-6, 2, -7, -3);
  ctx.quadraticCurveTo(-1, -4, 0, 3);
  ctx.moveTo(0, 3);
  ctx.quadraticCurveTo(0, -3, 6, -5);
  ctx.quadraticCurveTo(7, 1, 0, 3);
  ctx.fill();
  ctx.restore();
}

function desenharFrutinhas(ctx: CanvasRenderingContext2D, seed: number): void {
  let bits = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  bits = Math.imul(bits ^ (bits >>> 16), 0x45d9f3b) >>> 0;
  if (bits % 10 >= 3) return;

  const count = 1 + ((bits >>> 8) % 3);
  ctx.fillStyle = bits & 16 ? '#a8664d' : '#ba9555';
  for (let i = 0; i < count; i++) {
    const x = -17 + i * 15 + ((bits >>> (12 + i * 3)) & 7);
    const y = -44 - ((bits >>> (21 + i * 3)) & 7);
    ctx.beginPath();
    ctx.ellipse(x, y, 2.1, 2.6, -0.25, 0, TAU);
    ctx.fill();
  }
}

function desenharCopa(ctx: CanvasRenderingContext2D, cfg: ConfigArvore, near: number, fruitSeed?: number): void {
  const scale = cfg.altRef / CFG_GRANDE.altRef;
  ctx.save();
  ctx.translate(DESLOC[0], DESLOC[1]);
  ctx.scale(scale, scale);
  caminhoCopa(ctx);

  if (near > 0.01) {
    ctx.strokeStyle = BRILHO_COR;
    for (let i = 0; i < BRILHO_EXP.length; i++) {
      ctx.globalAlpha = near * BRILHO_ALFA[i] * 0.6;
      ctx.lineWidth = BRILHO_EXP[i] * 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = cfg.pal.escuro;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = cfg.pal.medio;
  ctx.beginPath();
  ctx.moveTo(-34, -86);
  ctx.lineTo(32, -86);
  ctx.bezierCurveTo(33, -64, 27, -53, 17, -51);
  ctx.bezierCurveTo(10, -44, 3, -42, -5, -45);
  ctx.bezierCurveTo(-15, -38, -27, -40, -34, -47);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cfg.pal.claro;
  ctx.beginPath();
  ctx.moveTo(-34, -74);
  ctx.bezierCurveTo(-16, -88, 8, -88, 22, -76);
  ctx.bezierCurveTo(16, -68, 7, -65, -2, -65);
  ctx.bezierCurveTo(-10, -58, -23, -54, -34, -58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cfg.pal.mancha;
  for (let i = 0; i < cfg.nManchas; i++) {
    const base = i * 6;
    const x = cfg.manchas[base] / scale;
    const y = cfg.manchas[base + 1] / scale;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x, y - 5, x + 4, y - 2);
    ctx.quadraticCurveTo(x + 1, y + 1, x - 4, y);
    ctx.fill();
  }

  desenharRamo(ctx, -18, -46, -0.45, cfg.pal.medio);
  desenharRamo(ctx, 15, -54, 0.28, cfg.pal.claro);
  desenharRamo(ctx, 1, -36, -0.12, cfg.pal.medio);
  if (fruitSeed !== undefined) desenharFrutinhas(ctx, fruitSeed);
  ctx.restore();

  caminhoCopa(ctx);
  ctx.strokeStyle = cfg.pal.contorno;
  ctx.lineWidth = cfg.contornoLw;
  ctx.stroke();
  ctx.restore();
}

/** Uma folha caindo em zigue-zague; p = progresso da queda (0..1). */
function desenharFolha(ctx: CanvasRenderingContext2D, cfg: ConfigArvore, p: number, x0: number, alpha: number, fase: number): void {
  const env = p < 0.1 ? p * 10 : p > 0.7 ? (1 - p) / 0.3 : 1; // aparece e some suavemente
  const a = alpha * env;
  if (a < 0.02) return;
  const zz = Math.sin(p * 9.4 + fase);
  const px = x0 + zz * cfg.folhaZig * (0.35 + 0.65 * p);
  const py = cfg.folhaY0 + cfg.folhaQueda * p;
  const rot = zz * 0.9 + fase * 0.3;
  const rx = cfg.folhaRx;
  const ry = cfg.folhaRy;

  ctx.globalAlpha = a;
  ctx.fillStyle = cfg.pal.claro;
  ctx.strokeStyle = cfg.pal.contorno;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, ry, rot, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = cfg.pal.mancha;
  ctx.beginPath();
  ctx.ellipse(px - rx * 0.2, py - ry * 0.25, rx * 0.5, ry * 0.35, rot, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Folhas: parada = uma folha cai devagar de tempos em tempos (ciclo de 9 s);
 * ativa = 3 folhas em zigue-zague, escalonadas.
 */
function desenharFolhas(ctx: CanvasRenderingContext2D, cfg: ConfigArvore, t: number, active: number): void {
  const ciclo = (t + 2.3) / 9;
  const idx = Math.floor(ciclo);
  const c = ciclo - idx;
  if (c < 0.4) {
    desenharFolha(ctx, cfg, c / 0.4, FOLHA_X[idx % 5] * cfg.folhaEsp, 0.95, idx * 1.3);
  }
  if (active > 0.02) {
    const a = active * 1.5 > 1 ? 1 : active * 1.5;
    for (let i = 0; i < 3; i++) {
      const v = t * 0.75 + i / 3;
      const k = Math.floor(v);
      desenharFolha(ctx, cfg, v - k, FOLHA_X[(k * 3 + i) % 5] * cfg.folhaEsp, a, k * 0.9 + i * 2.1);
    }
  }
}

// ============================================================================
// Motor comum às duas árvores
// ============================================================================

function desenharArvore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PropState,
  opts: DrawOptions | undefined,
  cfg: ConfigArvore,
): void {
  const escala = opts?.scale ?? 1;
  const comSombra = opts?.shadow ?? true;
  const n = state.near ?? 0;
  const a = state.active ?? 0;
  const near = n < 0 ? 0 : n > 1 ? 1 : n;
  const active = a < 0 ? 0 : a > 1 ? 1 : a;
  // Fase própria por posição, para as árvores não balançarem em uníssono.
  const t = state.time + x * 0.0371 + y * 0.0529;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);
  ctx.lineJoin = "round";

  if (comSombra) desenharSombraContato(ctx, cfg);

  calcularDeslocamentos(cfg, t, near, active);

  // Tronco: base fixa; o topo acompanha o balanço e treme na coleta.
  const tx = 0.45 * balancoX(t, active, 0.6, 0.2) + active * Math.sin(t * W_TREMOR) * 1.2;
  cfg.tronco(ctx, tx);

  desenharCopa(ctx, cfg, near, state.fruitSeed);
  desenharFolhas(ctx, cfg, t, active);

  ctx.restore();
}

// ============================================================================
// API pública
// ============================================================================

/** Árvore grande (~64 x 84 px em escala 1). (x, y) = centro da base do tronco. */
export function drawBigTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PropState,
  opts?: DrawOptions,
): void {
  desenharArvore(ctx, x, y, state, opts, CFG_GRANDE);
}

/** Árvore pequena / jovem (~48 x 64 px em escala 1). (x, y) = centro da base do tronco. */
export function drawSmallTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PropState,
  opts?: DrawOptions,
): void {
  desenharArvore(ctx, x, y, state, opts, CFG_PEQUENA);
}
