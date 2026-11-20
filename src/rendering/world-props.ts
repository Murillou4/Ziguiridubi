/* ============================================================
 * world-props.ts
 * Props do mundo: Banca do Mercador e Armazém & Upgrades.
 *
 * Tudo é desenhado por código com a API Canvas 2D (sem imagens,
 * sem bibliotecas). Estilo cartoon, visão 3/4, luz vinda do canto
 * superior esquerdo.
 *
 * Convenções:
 * - (x, y) = centro da base, no contato com o chão. Todo o desenho é
 *   feito em coordenadas locais com origem nesse ponto (y negativo = cima).
 * - state.time é em segundos. near e active vão de 0 a 1.
 * - Cada função faz ctx.save()/ctx.restore(); nada vaza para o contexto.
 * - Sem alocações por frame: nada de arrays, objetos, Path2D ou gradientes
 *   dentro do desenho (as listas de cores e posições são constantes).
 * ============================================================ */

export interface PropState {
  time: number;
  near?: number;
  active?: number;
}

export interface DrawOptions {
  scale?: number;
  shadow?: boolean;
}

const TAU = Math.PI * 2;

/* Deslocamento do truque do halo (ver halo()), em pixels de dispositivo. */
const DESLOC_HALO = 4000;

/* Paleta. Cada forma usa 2 ou 3 tons; contornos são um tom mais escuro da própria cor. */
const COR = {
  sombra: '#2a1a0a',
  madeiraEscura: '#6b3f1d',
  madeiraMedia: '#8f5a2c',
  madeiraClara: '#c28a4c',
  madeiraBrilho: '#e3aa66',
  madeiraSombra: '#4f2c14',
  madeiraContorno: '#3e2210',
  bauMedio: '#9a5f2f',
  bauClaro: '#b87a3e',
  bauEscuro: '#744520',
  ferro: '#7d8d9a',
  ferroClaro: '#aebcc7',
  ferroEscuro: '#34434f',
  rebite: '#dfe6ec',
  ouro: '#f0b43a',
  ouroClaro: '#ffe27a',
  ouroEscuro: '#9a6410',
  latao: '#c9a25a',
  aco: '#b4bfc8',
  acoEscuro: '#4d5a66',
  acoBrilho: '#f4fbff',
  laranja: '#f28a2e',
  laranjaEscuro: '#b5561a',
  creme: '#fff4da',
  amarelo: '#ffc640',
  brilho: '#ffd36a',
  brilhoForte: '#fff3b0',
  saco: '#b98846',
  sacoEscuro: '#8c5f2a',
  sacoClaro: '#e2b77a',
  frasco: '#3f8fcf',
  frascoClaro: '#9fd6f5',
  cortica: '#c9a06a',
  folha: '#5cb85c',
  maca: '#e8453c',
  laranjaFruta: '#ff9f2e',
  cesto: '#d9a25a',
  cestoClaro: '#f0c27a',
  cestoEscuro: '#8a5a22',
  bolsoPano: '#c99a3a',
  prato: '#d8c08a',
  interiorBau: '#2b1408',
} as const;

/* Faixas do toldo: laranja, creme e amarelo, em sequência. */
const CORES_TOLDO: readonly string[] = [
  COR.laranja, COR.creme, COR.amarelo, COR.laranja, COR.creme, COR.amarelo,
];

/* Posições fixas das sparkles (constantes: nada é alocado no loop). */
const SPARK_MOEDA_X: readonly number[] = [-12, 12, -14];
const SPARK_MOEDA_Y: readonly number[] = [-88, -92, -80];
const SPARK_BAU_X: readonly number[] = [-12, 2, 13];

/* ------------------------------------------------------------
 * Utilitários
 * ------------------------------------------------------------ */

function limitar01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* Parte fracionária de v (para ciclos periódicos). */
function fracao(v: number): number {
  return v - Math.floor(v);
}

/* Caminho de retângulo com cantos arredondados (evita roundRect para compatibilidade). */
function caminhoRetangulo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + w, y, x + w, y + h, raio);
  ctx.arcTo(x + w, y + h, x, y + h, raio);
  ctx.arcTo(x, y + h, x, y, raio);
  ctx.arcTo(x, y, x + w, y, raio);
  ctx.closePath();
}

/* Sombra de contato: elipse escura e translúcida no chão. */
function sombraDeContato(
  ctx: CanvasRenderingContext2D,
  cx: number,
  rx: number,
  ry: number,
  cy: number,
  alfa: number,
): void {
  ctx.globalAlpha = alfa;
  ctx.fillStyle = COR.sombra;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/*
 * Halo quente suave (sem borda dura).
 * Truque: a elipse é desenhada deslocada para fora da tela e o shadowOffsetX
 * a traz de volta. Assim só a sombra borrada (o brilho) aparece.
 * O deslocamento local é DESLOC_HALO / escala porque shadowOffset é em
 * pixels de dispositivo, não sofre a transformação do contexto.
 */
function halo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  raio: number,
  escala: number,
  intensidade: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.4 * intensidade;
  ctx.fillStyle = COR.brilho;
  ctx.shadowColor = COR.brilho;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = DESLOC_HALO;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.ellipse(cx - DESLOC_HALO / escala, cy, raio, raio, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* Sparkle: cruz fina de luz que aparece e some (alfa controlado pelo chamador). */
function brilho4(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alfa: number,
): void {
  if (alfa <= 0.01) return;
  ctx.globalAlpha = alfa;
  ctx.strokeStyle = COR.brilhoForte;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/*
 * Moeda com aro escuro, face dourada e brilho no aro (luz de cima-esquerda).
 * cosseno (-1..1) simula o giro no próprio eixo: a largura varia com |cos|.
 */
function moeda(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  raio: number,
  cosseno: number,
  simbolo: boolean,
): void {
  const rx = Math.max(1.2, raio * Math.abs(cosseno));

  ctx.fillStyle = COR.ouroEscuro;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, raio, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = COR.ouro;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.8, raio * 0.8, 0, 0, TAU);
  ctx.fill();

  // brilho do aro
  ctx.fillStyle = COR.ouroClaro;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.3, cy - raio * 0.3, rx * 0.35, raio * 0.3, 0, 0, TAU);
  ctx.fill();

  // símbolo no centro (só quando a moeda está de frente o bastante para ler)
  if (simbolo && Math.abs(cosseno) > 0.45) {
    ctx.fillStyle = COR.ouroEscuro;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 0.5);
  }
}

/* ------------------------------------------------------------
 * BANCA DO MERCADOR
 * ------------------------------------------------------------ */

/* Caminho de uma faixa do toldo: retângulo + barra inferior em semicírculo (festão). */
function desenhaFaixa(ctx: CanvasRenderingContext2D, k: number, dx: number): void {
  const x0 = -36 + k * 12 + dx;
  ctx.beginPath();
  ctx.moveTo(x0, -66);
  ctx.lineTo(x0 + 12, -66);
  ctx.lineTo(x0 + 12, -56);
  ctx.arc(x0 + 6, -56, 6, 0, Math.PI, false);
  ctx.closePath();
}

/* Toldo: seis faixas com festão arredondado, reflexo e dobra sob a travessa. */
function desenhaToldo(ctx: CanvasRenderingContext2D, dx: number): void {
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = COR.laranjaEscuro;
  for (let k = 0; k < 6; k++) {
    desenhaFaixa(ctx, k, dx);
    ctx.fillStyle = CORES_TOLDO[k];
    ctx.fill();
    ctx.stroke();
  }

  // reflexo claro no lado esquerdo de cada faixa
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 6; k++) {
    ctx.fillRect(-36 + k * 12 + 1.5 + dx, -64, 1.2, 6.5);
  }

  // sombra da dobra sob a travessa
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = COR.sombra;
  ctx.fillRect(-36 + dx, -66, 72, 2.5);
  ctx.globalAlpha = 1;
}

/* Poste de madeira com veio, prego e luz de um lado. */
function desenhaPoste(ctx: CanvasRenderingContext2D, cx: number): void {
  ctx.fillStyle = COR.madeiraMedia;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, cx - 2.5, -74, 5, 49, 1.5);
  ctx.fill();
  ctx.stroke();

  // luz no lado esquerdo
  ctx.fillStyle = COR.madeiraBrilho;
  ctx.fillRect(cx - 2, -72, 1, 45);

  // veio
  ctx.strokeStyle = COR.madeiraSombra;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx + 1, -66);
  ctx.lineTo(cx + 0.6, -48);
  ctx.moveTo(cx + 1.4, -40);
  ctx.lineTo(cx + 1, -30);
  ctx.stroke();

  // pregos visíveis abaixo do toldo
  ctx.fillStyle = COR.rebite;
  ctx.beginPath();
  ctx.arc(cx, -46, 0.9, 0, TAU);
  ctx.arc(cx, -34, 0.9, 0, TAU);
  ctx.fill();
}

/* Travessa de madeira no topo, ligando os postes. */
function desenhaTravessa(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COR.madeiraMedia;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, -34, -74, 68, 7, 2.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR.madeiraBrilho;
  ctx.fillRect(-32, -73, 64, 1.2);
}

/* Frente e tampo do balcão, com placa de moeda e tábuas com veio. */
function desenhaBalcao(ctx: CanvasRenderingContext2D): void {
  // frente
  ctx.fillStyle = COR.madeiraEscura;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, -30, -26, 60, 22, 3);
  ctx.fill();
  ctx.stroke();

  // luz lateral esquerda
  ctx.fillStyle = COR.madeiraMedia;
  ctx.fillRect(-29, -24, 2, 18);

  // tábuas verticais
  ctx.strokeStyle = COR.madeiraSombra;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-14, -25);
  ctx.lineTo(-14, -5);
  ctx.moveTo(4, -25);
  ctx.lineTo(4, -5);
  ctx.moveTo(20, -25);
  ctx.lineTo(20, -5);
  ctx.stroke();

  // placa pequena com ícone de moeda (sem texto)
  ctx.fillStyle = COR.ouro;
  ctx.strokeStyle = COR.ouroEscuro;
  ctx.lineWidth = 0.7;
  caminhoRetangulo(ctx, -6.5, -20, 13, 9, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR.ouroClaro;
  ctx.beginPath();
  ctx.arc(0, -15.5, 2.8, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -15.5, 2.8, 0, TAU);
  ctx.stroke();

  // tampo mais claro
  ctx.fillStyle = COR.madeiraClara;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, -33, -31, 66, 7, 2.5);
  ctx.fill();
  ctx.stroke();

  // brilho do tampo e veio
  ctx.fillStyle = COR.madeiraBrilho;
  ctx.fillRect(-31, -30, 62, 1.2);
  ctx.strokeStyle = COR.madeiraMedia;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-26, -27);
  ctx.lineTo(-2, -27.5);
  ctx.moveTo(8, -26.5);
  ctx.lineTo(28, -27);
  ctx.stroke();
}

/* Fruta com brilho pequeno no canto superior esquerdo. */
function desenhaFruta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  cor: string,
): void {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.28, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* Prato de balança: bojo em curva, dois tons. */
function desenhaPrato(ctx: CanvasRenderingContext2D, cx: number): void {
  ctx.fillStyle = COR.prato;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx - 4, -35.5);
  ctx.lineTo(cx + 4, -35.5);
  ctx.quadraticCurveTo(cx + 3, -31.5, cx, -31.5);
  ctx.quadraticCurveTo(cx - 3, -31.5, cx - 4, -35.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/* Mercadorias sobre o tampo: cesto com frutas, saquinho de moedas, frasco e balança. */
function desenhaMercadorias(ctx: CanvasRenderingContext2D): void {
  // cesto
  ctx.fillStyle = COR.cesto;
  ctx.strokeStyle = COR.cestoEscuro;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-27, -31);
  ctx.lineTo(-15, -31);
  ctx.lineTo(-16, -25);
  ctx.quadraticCurveTo(-21, -24, -26, -25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // trama e aro
  ctx.strokeStyle = COR.cestoEscuro;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-25.5, -28);
  ctx.lineTo(-16.5, -28);
  ctx.stroke();
  ctx.fillStyle = COR.cestoClaro;
  ctx.fillRect(-27.5, -31.8, 13, 1.4);

  // frutas
  desenhaFruta(ctx, -23, -34.5, 3.2, COR.maca);
  desenhaFruta(ctx, -18.5, -35.5, 3.2, COR.laranjaFruta);
  desenhaFruta(ctx, -14, -34, 2.8, COR.folha);

  // saquinho de moedas
  ctx.fillStyle = COR.bolsoPano;
  ctx.strokeStyle = COR.cestoEscuro;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(-9, -35, 4.8, 4.6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR.ouroClaro;
  ctx.beginPath();
  ctx.ellipse(-10.8, -36.5, 1.5, 1.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COR.madeiraSombra;
  ctx.fillRect(-10.5, -40.5, 3, 1.8);

  // frasco
  ctx.fillStyle = COR.frasco;
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.lineWidth = 0.7;
  caminhoRetangulo(ctx, -3, -40, 4.5, 9, 1.8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR.frascoClaro;
  ctx.fillRect(-2.4, -38.5, 0.9, 5);
  ctx.fillStyle = COR.cortica;
  ctx.fillRect(-2.2, -44, 2.9, 4);

  // balança de pratos
  ctx.fillStyle = COR.madeiraClara;
  ctx.fillRect(16, -45, 2, 14);
  ctx.fillStyle = COR.madeiraSombra;
  ctx.fillRect(12, -32.5, 10, 1.6);
  ctx.strokeStyle = COR.latao;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8, -41);
  ctx.lineTo(25, -41);
  ctx.stroke();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.beginPath();
  ctx.moveTo(8, -41);
  ctx.lineTo(4, -35.5);
  ctx.moveTo(8, -41);
  ctx.lineTo(12, -35.5);
  ctx.moveTo(25, -41);
  ctx.lineTo(21, -35.5);
  ctx.moveTo(25, -41);
  ctx.lineTo(29, -35.5);
  ctx.stroke();
  desenhaPrato(ctx, 8);
  desenhaPrato(ctx, 25);
  ctx.fillStyle = COR.ouro;
  ctx.beginPath();
  ctx.arc(17, -41, 1.2, 0, TAU);
  ctx.fill();
}

/* Lanterninha pendurada no toldo; oscila (ang) e acompanha o balanço (dx). */
function desenhaLanterna(
  ctx: CanvasRenderingContext2D,
  dx: number,
  ang: number,
  near: number,
): void {
  ctx.save();
  ctx.translate(31 + dx, -50);
  ctx.rotate(ang);

  // corrente
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 4.5);
  ctx.stroke();

  // halo suave ao redor da janela
  ctx.globalAlpha = 0.15 + 0.15 * near;
  ctx.fillStyle = COR.brilho;
  ctx.beginPath();
  ctx.arc(0, 9, 5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // corpo de ferro
  ctx.fillStyle = COR.ferro;
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.lineWidth = 0.7;
  caminhoRetangulo(ctx, -3, 4.5, 6, 9, 1.5);
  ctx.fill();
  ctx.stroke();

  // janela quente
  ctx.fillStyle = COR.ouroClaro;
  ctx.fillRect(-1.8, 6.5, 3.6, 5);

  // tampa superior
  ctx.fillStyle = COR.ferroEscuro;
  ctx.beginPath();
  ctx.moveTo(-3.8, 4.5);
  ctx.lineTo(3.8, 4.5);
  ctx.lineTo(1.6, 2.5);
  ctx.lineTo(-1.6, 2.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/* Moeda grande flutuando acima do toldo, girando no eixo e com sparkles. */
function desenhaMoedaFlutuante(
  ctx: CanvasRenderingContext2D,
  t: number,
  near: number,
): void {
  const cosseno = Math.cos(t * 2.2);
  const cy = -84 + Math.sin(t * 2.5) * 1.2;
  moeda(ctx, 0, cy, 7, cosseno, true);

  // perto: sparkles mais intensos e maiores
  const intensidade = 0.5 + 0.5 * near;
  const raio = 1.5 + 1.2 * near;
  for (let i = 0; i < 3; i++) {
    const p = fracao(t * 0.45 + i * 0.37);
    brilho4(ctx, SPARK_MOEDA_X[i], SPARK_MOEDA_Y[i], raio, Math.sin(p * Math.PI) * intensidade);
  }
}

/* Ativo: 3 moedinhas saem do balcão, sobem e somem. */
function desenhaMoedinhas(ctx: CanvasRenderingContext2D, t: number, ativo: number): void {
  for (let i = 0; i < 3; i++) {
    const p = fracao(t * 0.9 + i / 3);
    const x = (i - 1) * 5 + Math.sin(p * TAU) * 1.2;
    const y = -36 - p * 34;
    ctx.globalAlpha = ativo * (1 - p);
    moeda(ctx, x, y, 2.6, Math.cos(t * 6 + i), false);
  }
  ctx.globalAlpha = 1;
}

/*
 * Desenha a Banca do Mercador.
 * state.time: segundos. state.near: 0..1 (perto). state.active: 0..1 (loja aberta).
 */
export function drawMerchantStall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PropState,
  opts?: DrawOptions,
): void {
  const s = Math.max(0.01, opts?.scale ?? 1);
  const t = state.time;
  const near = limitar01(state.near ?? 0);
  const ativo = limitar01(state.active ?? 0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // sombra de contato (no chão, antes do pulinho)
  if (opts?.shadow ?? true) sombraDeContato(ctx, 0, 40, 9, -1, 0.3);

  // brilho quente quando perto (por trás do prop)
  if (near > 0.01) halo(ctx, 0, -44, 40, s, near);

  // "pulinho" de 1px quando perto
  ctx.translate(0, -Math.round(near * Math.max(0, Math.sin(t * 4))));

  // respiração: toldo ~1px em repouso (ciclo de 3s); balanço forte quando ativo
  const balanco = Math.sin(t * 2.094) * 0.7 + Math.sin(t * 9) * 1.6 * ativo;
  // lanterna oscila suavemente; mais agitada quando ativo
  const oscLanterna = Math.sin(t * 2.4) * 0.07 + Math.sin(t * 9) * 0.1 * ativo;

  desenhaPoste(ctx, -25.5);
  desenhaPoste(ctx, 25.5);
  desenhaBalcao(ctx);

  // sombra projetada do toldo sobre o tampo
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = COR.sombra;
  ctx.fillRect(-33, -31, 66, 4.5);
  ctx.globalAlpha = 1;

  desenhaMercadorias(ctx);
  desenhaTravessa(ctx);
  desenhaToldo(ctx, balanco);
  desenhaLanterna(ctx, balanco, oscLanterna, near);
  desenhaMoedaFlutuante(ctx, t, near);
  if (ativo > 0.02) desenhaMoedinhas(ctx, t, ativo);

  ctx.restore();
}

/* ------------------------------------------------------------
 * ARMAZÉM & UPGRADES
 * ------------------------------------------------------------ */

/* Cinta de ferro com rebites (usada no corpo e na tampa do baú). */
function desenhaCinta(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yTopo: number,
  altura: number,
): void {
  ctx.fillStyle = COR.ferro;
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.lineWidth = 0.7;
  ctx.fillRect(cx - 1.7, yTopo, 3.4, altura);
  ctx.strokeRect(cx - 1.7, yTopo, 3.4, altura);
  ctx.fillStyle = COR.ferroClaro;
  ctx.fillRect(cx - 1.4, yTopo, 0.9, altura);
  ctx.fillStyle = COR.rebite;
  ctx.beginPath();
  ctx.arc(cx, yTopo + 4, 0.9, 0, TAU);
  ctx.arc(cx, yTopo + altura - 4, 0.9, 0, TAU);
  ctx.fill();
}

/* Sacola de provisões ao lado do baú (volume e quebra da silhueta). */
function desenhaSaco(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COR.saco;
  ctx.strokeStyle = COR.sacoEscuro;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-32, -9.5, 7, 7.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // sombra no lado direito/baixo
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = COR.sacoEscuro;
  ctx.beginPath();
  ctx.ellipse(-30.5, -7, 3.5, 4.8, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // brilho no lado esquerdo
  ctx.fillStyle = COR.sacoClaro;
  ctx.beginPath();
  ctx.ellipse(-35, -12, 2, 2.8, 0.4, 0, TAU);
  ctx.fill();

  // gargalo amarrado e cordão
  ctx.fillStyle = COR.sacoEscuro;
  caminhoRetangulo(ctx, -34, -18.5, 4, 2.5, 1);
  ctx.fill();
  ctx.strokeStyle = COR.madeiraSombra;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-36, -16);
  ctx.lineTo(-28, -16);
  ctx.stroke();
}

/* Engrenagem encostada na lateral do baú; gira devagar o tempo todo. */
function desenhaEngrenagem(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();
  ctx.translate(30, -10);
  ctx.rotate(t * 0.9);

  // dentes (6): cada um é girado em 60° sobre o próprio centro
  ctx.fillStyle = COR.ferro;
  for (let k = 0; k < 6; k++) {
    ctx.fillRect(-1.3, -7.2, 2.6, 3.4);
    ctx.rotate(TAU / 6);
  }

  // corpo
  ctx.strokeStyle = COR.ferroEscuro;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // brilho superior esquerdo
  ctx.strokeStyle = COR.ferroClaro;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 3.8, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();

  // furo central
  ctx.fillStyle = COR.ferroEscuro;
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/* Corpo do baú: pés, madeira com tábuas, luz e sombra laterais, cintas. */
function desenhaCorpoBau(ctx: CanvasRenderingContext2D): void {
  // pés
  ctx.fillStyle = COR.bauEscuro;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.8;
  caminhoRetangulo(ctx, -21, -5.5, 5, 4, 1);
  ctx.fill();
  ctx.stroke();
  caminhoRetangulo(ctx, 16, -5.5, 5, 4, 1);
  ctx.fill();
  ctx.stroke();

  // corpo
  ctx.fillStyle = COR.bauMedio;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, -24, -25, 48, 20, 3);
  ctx.fill();
  ctx.stroke();

  // luz à esquerda e sombra à direita
  ctx.fillStyle = COR.bauClaro;
  ctx.fillRect(-23, -24, 2.5, 18);
  ctx.fillStyle = COR.bauEscuro;
  ctx.fillRect(20.5, -24, 3.5, 18);

  // tábuas verticais e veio
  ctx.strokeStyle = COR.madeiraSombra;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-8, -24);
  ctx.lineTo(-8, -6);
  ctx.moveTo(8, -24);
  ctx.lineTo(8, -6);
  ctx.stroke();
  ctx.strokeStyle = COR.bauClaro;
  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.lineTo(-12, -11.5);
  ctx.moveTo(10, -20);
  ctx.lineTo(18, -19.5);
  ctx.moveTo(-4, -17);
  ctx.lineTo(3, -17.5);
  ctx.stroke();

  // cintas de metal
  desenhaCinta(ctx, -15, -25, 20);
  desenhaCinta(ctx, 15, -25, 20);
}

/* Luz dourada saindo de dentro do baú quando aberto. */
function desenhaLuzBau(
  ctx: CanvasRenderingContext2D,
  ativo: number,
  lift: number,
): void {
  // interior escuro na abertura
  ctx.fillStyle = COR.interiorBau;
  ctx.fillRect(-21, -25 - lift, 42, lift + 1);

  // luz dourada, com brilho que vaza pelas bordas
  ctx.save();
  ctx.globalAlpha = 0.9 * ativo;
  ctx.fillStyle = COR.ouroClaro;
  ctx.shadowColor = COR.brilho;
  ctx.shadowBlur = 10 * ativo;
  ctx.fillRect(-19, -25 - lift * 0.85, 38, lift * 0.85 + 0.5);
  ctx.restore();
}

/* Tampa com cintas, lâmina de tábuas, e fechadura (com brilho ocasional). */
function desenhaTampa(
  ctx: CanvasRenderingContext2D,
  t: number,
  ativo: number,
  lift: number,
): void {
  ctx.save();
  // abertura: sobe (lift) e inclina em torno do centro da tampa (ângulo ∝ active)
  ctx.translate(0, -lift);
  ctx.translate(0, -32);
  ctx.rotate(-ativo * 0.12);
  ctx.translate(0, 32);

  // corpo da tampa
  ctx.fillStyle = COR.bauClaro;
  ctx.strokeStyle = COR.madeiraContorno;
  ctx.lineWidth = 0.9;
  caminhoRetangulo(ctx, -25, -40, 50, 16, 7);
  ctx.fill();
  ctx.stroke();

  // faixa de luz no topo
  ctx.fillStyle = COR.madeiraBrilho;
  caminhoRetangulo(ctx, -21, -38.5, 42, 2.5, 1.2);
  ctx.fill();

  // sombra na base da tampa
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = COR.bauEscuro;
  ctx.fillRect(-23, -27, 46, 3);
  ctx.globalAlpha = 1;

  // tábuas
  ctx.strokeStyle = COR.madeiraSombra;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-8, -36);
  ctx.lineTo(-8, -28);
  ctx.moveTo(8, -36);
  ctx.lineTo(8, -28);
  ctx.stroke();

  // cintas da tampa
  desenhaCinta(ctx, -15, -40, 16);
  desenhaCinta(ctx, 15, -40, 16);

  // cantoneiras de ferro nos cantos superiores
  ctx.fillStyle = COR.ferroEscuro;
  ctx.fillRect(-25, -40, 3, 3);
  ctx.fillRect(22, -40, 3, 3);

  // cadeado dourado com fechadura
  ctx.fillStyle = COR.ouro;
  ctx.strokeStyle = COR.ouroEscuro;
  ctx.lineWidth = 0.7;
  caminhoRetangulo(ctx, -4, -36, 8, 9, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COR.ouroClaro;
  ctx.fillRect(-3, -35.5, 2, 1);
  ctx.fillStyle = COR.ouroEscuro;
  ctx.beginPath();
  ctx.arc(0, -32, 1.2, 0, TAU);
  ctx.fill();
  ctx.fillRect(-0.5, -31, 1, 2.5);

  // brilho sutil no cadeado de tempos em tempos (a cada 4s)
  const g = fracao(t / 4);
  if (g < 0.15) brilho4(ctx, 2, -36.5, 2.2, (1 - g / 0.15) * 0.9);


  ctx.restore();
}

/* Faíscas douradas saindo do baú aberto. */
function desenhaFaiscasBau(ctx: CanvasRenderingContext2D, t: number, ativo: number): void {
  for (let i = 0; i < 3; i++) {
    const p = fracao(t * 0.7 + i * 0.33);
    brilho4(ctx, SPARK_BAU_X[i], -44 - p * 8, 2.2, Math.sin(p * Math.PI) * ativo);
  }
}

/*
 * Desenha o Armazém & Upgrades (baú com engrenagem).
 * state.time: segundos. state.near: 0..1 (perto). state.active: 0..1 (abre a tampa).
 */
export function drawWarehouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: PropState,
  opts?: DrawOptions,
): void {
  const s = Math.max(0.01, opts?.scale ?? 1);
  const t = state.time;
  const near = limitar01(state.near ?? 0);
  const ativo = limitar01(state.active ?? 0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // sombra maior do conjunto + sombra de contato mais forte do baú
  if (opts?.shadow ?? true) {
    sombraDeContato(ctx, 0, 42, 10, -1, 0.2);
    sombraDeContato(ctx, 0, 30, 6.5, -1, 0.3);
    sombraDeContato(ctx, -32, 9, 3, -1.5, 0.3);
  }

  // brilho quente quando perto
  if (near > 0.01) halo(ctx, 0, -33, 36, s, near);

  // "pulinho" de 1px quando perto
  ctx.translate(0, -Math.round(near * Math.max(0, Math.sin(t * 4))));

  // abertura da tampa: até 8px de subida
  const lift = ativo * 8;

  // ordem de profundidade interna: engrenagem e saco atrás, baú na frente
  desenhaEngrenagem(ctx, t);
  desenhaSaco(ctx);
  desenhaCorpoBau(ctx);
  if (ativo > 0.01) desenhaLuzBau(ctx, ativo, lift);
  desenhaTampa(ctx, t, ativo, lift);
  if (ativo > 0.02) desenhaFaiscasBau(ctx, t, ativo);

  ctx.restore();
}
