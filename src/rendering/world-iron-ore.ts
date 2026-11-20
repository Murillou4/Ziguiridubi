// ---------- paleta ----------
const COR_CONTORNO = "#334155";
const COR_TOPO = "#a6b3c4"; // faceta de cima (mais clara)
const COR_DIREITA = "#94a3b8";
const COR_ESQUERDA = "#64748b";
const COR_BAIXO = "#475569";
const COR_BRILHO = "#bcc7d4";
const COR_FERRUGEM = "#c2410c"; // veios de hematita
const COR_FERRUGEM_LUZ = "#fb923c";
const COR_SOMBRA = "rgba(30,41,59,0.28)";
const COR_HALO = "rgba(203,213,225,0.13)";
const COR_FAISCA = "#f8fafc";

// ---------- geometria (px, centro do bloco em 0,0; y para baixo) ----------
// Contorno arredondado de uma pedra com 8 pontas
const P = new Float32Array([
  -7.6, 1.2, //  0
  -5.6, -4.4, // 1
  -1.2, -7.6, // 2
  4.4, -6.4, //  3
  7.6, -1.2, //  4
  6.8, 4.4, //   5
  2.0, 7.2, //   6
  -4.0, 6.4, //  7
]);
// Pontos internos que separam as facetas
const A_X = -3.6, A_Y = -0.8;
const B_X = 0.8, B_Y = -1.6;
const C_X = 2.4, C_Y = 2.0;

const px = (i: number) => P[i * 2];
const py = (i: number) => P[i * 2 + 1];

const ALTURA_BASE = 6; // distância do centro do bloco até o chão
const RAIO_SOMBRA = 7.5;
const DURACAO_POP = 0.28;

// Faceta poligonal definida por pares x,y.
function faceta(
  ctx: CanvasRenderingContext2D,
  cor: string,
  ...v: number[]
): void {
  ctx.beginPath();
  ctx.moveTo(v[0], v[1]);
  for (let i = 2; i < v.length; i += 2) ctx.lineTo(v[i], v[i + 1]);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  // stroke da mesma cor esconde a costura entre facetas
  ctx.strokeStyle = cor;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function fleck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = COR_FERRUGEM;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COR_FERRUGEM_LUZ;
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// Um bloco de minério completo (usado no grande e no pequeno)
function bloco(ctx: CanvasRenderingContext2D): void {
  // contorno externo escuro e arredondado
  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let i = 1; i < 8; i++) ctx.lineTo(px(i), py(i));
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.fillStyle = COR_BAIXO;
  ctx.fill();

  // facetas (luz vindo de cima à esquerda)
  faceta(ctx, COR_ESQUERDA, px(0), py(0), px(1), py(1), A_X, A_Y);
  faceta(ctx, COR_TOPO, px(1), py(1), px(2), py(2), px(3), py(3), B_X, B_Y, A_X, A_Y);
  faceta(ctx, COR_DIREITA, px(3), py(3), px(4), py(4), px(5), py(5), C_X, C_Y, B_X, B_Y);
  faceta(
    ctx, COR_BAIXO,
    A_X, A_Y, B_X, B_Y, C_X, C_Y, px(5), py(5), px(6), py(6), px(7), py(7), px(0), py(0),
  );

  // brilho metálico na quina de cima
  ctx.strokeStyle = COR_BRILHO;
  ctx.lineWidth = 0.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px(1) + 1.2, py(1) - 0.4);
  ctx.lineTo(px(2) + 0.2, py(2) + 1.0);
  ctx.stroke();

  // veios de ferrugem (identificam o recurso como minério, não pedra)
  fleck(ctx, -3.2, 3.4, 1.5);
  fleck(ctx, 3.8, 4.0, 1.1);
  fleck(ctx, 5.0, -0.2, 0.9);
  fleck(ctx, -5.2, -0.2, 0.8);
}

export function drawIronOrePile(ctx: CanvasRenderingContext2D): void {
  bloco(ctx);

  // pedacinho menor ao lado, dá cara de "monte"
  ctx.save();
  ctx.translate(6.8, 4.2);
  ctx.rotate(0.35);
  ctx.scale(0.5, 0.5);
  bloco(ctx);
  ctx.restore();
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function drawIronOreDrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  age: number,
  time: number,
  seed: number,
): void {
  const s = ((seed >>> 0) * 0.6180339887) % 1; // 0..1 bem espalhado, mesmo com seed inteiro
  const espelho = s > 0.5 ? -1 : 1;
  const giro = (s - 0.5) * 0.4;

  // pop-in ao nascer
  const pop = age < DURACAO_POP ? easeOutBack(Math.max(0, age) / DURACAO_POP) : 1;

  // balanço suave só quando está pousado
  const pousado = z < 0.5 ? 1 : 0;
  const bob = Math.sin(time * 2.2 + s * 6.2832) * 0.9 * pousado;

  ctx.save();

  // sombra no chão, encolhe quando o item está no ar
  const k = 1 - Math.min(z, 24) / 48;
  ctx.fillStyle = COR_SOMBRA;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, RAIO_SOMBRA * k * pop, 2.6 * k * pop, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y - ALTURA_BASE - z + bob);
  ctx.scale(pop * espelho, pop);
  ctx.rotate(giro);

  // halo discreto pra destacar do gramado
  ctx.fillStyle = COR_HALO;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();

  drawIronOrePile(ctx);

  // faísca que pisca de tempos em tempos
  const fase = Math.sin(time * 1.7 + s * 9.0);
  if (fase > 0.82) {
    const f = (fase - 0.82) / 0.18;
    const r = 3.2 * f;
    ctx.globalAlpha *= f;
    ctx.fillStyle = COR_FAISCA;
    ctx.beginPath();
    ctx.moveTo(-3.4, -5.4 - r);
    ctx.quadraticCurveTo(-3.4, -5.4, -3.4 + r, -5.4);
    ctx.quadraticCurveTo(-3.4, -5.4, -3.4, -5.4 + r);
    ctx.quadraticCurveTo(-3.4, -5.4, -3.4 - r, -5.4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
