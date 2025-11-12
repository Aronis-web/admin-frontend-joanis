// src/pixel/PlayerSpec.ts  — Perfil sin PNG (24x24)
// Leyenda: .=transp K=outline S=piel s=piel sombra W=blanco G=gris
// H=camiseta h=luz camiseta P=pantalón p=sombra pantalón
// L=lentes B=botas U=suela botas
export const palette = [
  'transparent', // 0 .
  '#1B1B1B',     // 1 K outline
  '#A06B4B',     // 2 S piel
  '#7C533B',     // 3 s sombra piel
  '#FFFFFF',     // 4 W blanco
  '#D9D9D9',     // 5 G gris claro
  '#21242C',     // 6 H camiseta
  '#2C313C',     // 7 h luz camiseta
  '#2A4669',     // 8 P pantalón
  '#1E3450',     // 9 p sombra pantalón
  '#101010',     // 10 L lentes negros
  '#121212',     // 11 B botas negras
  '#BFBFBF',     // 12 U suela clara
];

const KEY: Record<string, number> = {
  '.':0, K:1, S:2, s:3, W:4, G:5, H:6, h:7, P:8, p:9, L:10, U:11, B:12,
};
const to = (rows: string[]) => rows.map(r => r.trim().split('').map(c => KEY[c] ?? 0));

// PROPORCIÓN: Cabeza grande, cuerpo stout, overol azul, gorra roja, bigote.
// Vista de perfil (parado). Estilo clásico de Mario.

// ===== IDLE (Mario perfil parado) =====
export const idle = to([
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
]);

// ===== WALK1 (pierna adelante) =====
export const walk1 = to([
  '......................',
  '......................',
  '........KKKKK.........',
  '.......KWWWWW........',
  '......KWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '......KWWWWWWK.......',
  '......KWWWWWWK.......',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
]);

// ===== WALK2 (pierna atrás) =====
export const walk2 = to([
  '......................',
  '......................',
  '........KKKKK.........',
  '.......KWWWWW........',
  '......KWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '......KWWWWWWK.......',
  '......KWWWWWWK.......',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
]);

// ===== JUMP (brazos arriba) =====
export const jump = to([
  '......................',
  '......................',
  '........KKKKK.........',
  '.......KWWWWW........',
  '......KWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '.....KWWWWWWWK.......',
  '......KWWWWWWK.......',
  '......KWWWWWWK.......',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
  '.......KWWWWW........',
]);

export const anims = {
  idle: { frames: [idle], fps: 2 },
  walk: { frames: [walk1, idle, walk2, idle], fps: 10 },
  jump: { frames: [jump], fps: 1 },
  land: { frames: [idle], fps: 8 },
};