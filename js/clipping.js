/**
 * ============================================================================
 * clipping.js — Algoritmos de Recorte (Clipping) de Segmentos de Reta
 * ============================================================================
 *
 * Implementação dos algoritmos de recorte:
 *   - Cohen-Sutherland (regiões codificadas)
 *   - Liang-Barsky (equação paramétrica)
 *
 * Ambos recebem os endpoints de um segmento e os limites da janela de recorte,
 * retornando o segmento recortado ou null se estiver totalmente fora.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Cohen-Sutherland — Recorte por Regiões Codificadas
// ──────────────────────────────────────────────────────────────────────────────

// Constantes para os bits de código de região (outcode)
const INSIDE = 0b0000; // 0000 — dentro da janela
const LEFT   = 0b0001; // 0001 — à esquerda
const RIGHT  = 0b0010; // 0010 — à direita
const BOTTOM = 0b0100; // 0100 — abaixo
const TOP    = 0b1000; // 1000 — acima

/**
 * Calcula o código de região (outcode) de um ponto em relação à janela.
 *
 * Bit 1 (LEFT):   set se x < xmin
 * Bit 2 (RIGHT):  set se x > xmax
 * Bit 3 (BOTTOM): set se y < ymin
 * Bit 4 (TOP):    set se y > ymax
 *
 * @param {number} x - Coordenada X do ponto
 * @param {number} y - Coordenada Y do ponto
 * @param {number} xmin - Limite esquerdo da janela
 * @param {number} ymin - Limite inferior da janela
 * @param {number} xmax - Limite direito da janela
 * @param {number} ymax - Limite superior da janela
 * @returns {number} Outcode de 4 bits
 */
function computeOutcode(x, y, xmin, ymin, xmax, ymax) {
    let code = INSIDE;

    if (x < xmin)      code |= LEFT;
    else if (x > xmax) code |= RIGHT;

    if (y < ymin)      code |= BOTTOM;
    else if (y > ymax) code |= TOP;

    return code;
}

/**
 * Recorta um segmento de reta usando o algoritmo Cohen-Sutherland.
 *
 * Algoritmo:
 *   1. Calcula os outcodes dos dois endpoints
 *   2. Testa aceitação trivial: outcode1 | outcode2 == 0 → aceita
 *   3. Testa rejeição trivial: outcode1 & outcode2 != 0 → rejeita
 *   4. Caso não-trivial: calcula interseção com a borda indicada pelo
 *      outcode do ponto fora da janela e repete
 *
 * @param {number} x0 - X do primeiro endpoint
 * @param {number} y0 - Y do primeiro endpoint
 * @param {number} x1 - X do segundo endpoint
 * @param {number} y1 - Y do segundo endpoint
 * @param {number} xmin - Limite esquerdo da janela
 * @param {number} ymin - Limite inferior da janela
 * @param {number} xmax - Limite direito da janela
 * @param {number} ymax - Limite superior da janela
 * @returns {{x0: number, y0: number, x1: number, y1: number}|null}
 *          Segmento recortado ou null se totalmente fora
 */
function cohenSutherland(x0, y0, x1, y1, xmin, ymin, xmax, ymax) {
    let outcode0 = computeOutcode(x0, y0, xmin, ymin, xmax, ymax);
    let outcode1 = computeOutcode(x1, y1, xmin, ymin, xmax, ymax);

    // Limite de iterações para evitar loop infinito (segurança)
    let maxIterations = 20;

    while (maxIterations-- > 0) {
        // Teste de ACEITAÇÃO TRIVIAL: ambos pontos dentro da janela
        if ((outcode0 | outcode1) === INSIDE) {
            return { x0, y0, x1, y1 };
        }

        // Teste de REJEIÇÃO TRIVIAL: ambos pontos do mesmo lado de uma borda
        if ((outcode0 & outcode1) !== INSIDE) {
            return null;
        }

        // Caso NÃO-TRIVIAL: pelo menos um ponto está fora
        // Seleciona o outcode do ponto que está fora
        const outcodeOut = outcode0 !== INSIDE ? outcode0 : outcode1;

        let x, y;

        // Calcula a interseção com a borda correspondente ao bit setado
        if (outcodeOut & TOP) {
            // Interseção com a borda superior: y = ymax
            x = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0);
            y = ymax;
        } else if (outcodeOut & BOTTOM) {
            // Interseção com a borda inferior: y = ymin
            x = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0);
            y = ymin;
        } else if (outcodeOut & RIGHT) {
            // Interseção com a borda direita: x = xmax
            y = y0 + (y1 - y0) * (xmax - x0) / (x1 - x0);
            x = xmax;
        } else if (outcodeOut & LEFT) {
            // Interseção com a borda esquerda: x = xmin
            y = y0 + (y1 - y0) * (xmin - x0) / (x1 - x0);
            x = xmin;
        }

        // Substitui o ponto que estava fora pelo ponto de interseção
        if (outcodeOut === outcode0) {
            x0 = x;
            y0 = y;
            outcode0 = computeOutcode(x0, y0, xmin, ymin, xmax, ymax);
        } else {
            x1 = x;
            y1 = y;
            outcode1 = computeOutcode(x1, y1, xmin, ymin, xmax, ymax);
        }
    }

    // Se atingiu o limite de iterações, retorna null como fallback
    return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Liang-Barsky — Recorte por Equação Paramétrica
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Recorta um segmento de reta usando o algoritmo Liang-Barsky.
 *
 * Algoritmo baseado na equação paramétrica da reta:
 *   x = x1 + u · Δx
 *   y = y1 + u · Δy
 *   onde 0 ≤ u ≤ 1
 *
 * Reescreve as condições de visibilidade na forma p_k · u ≤ q_k:
 *   k=1 (esquerda):  p1 = -Δx,  q1 = x1 - xmin
 *   k=2 (direita):   p2 =  Δx,  q2 = xmax - x1
 *   k=3 (inferior):  p3 = -Δy,  q3 = y1 - ymin
 *   k=4 (superior):  p4 =  Δy,  q4 = ymax - y1
 *
 * Para cada aresta:
 *   - Se p_k = 0 e q_k < 0: linha paralela e fora → rejeita
 *   - Se p_k < 0: entrando → u1 = max(u1, q_k/p_k)
 *   - Se p_k > 0: saindo   → u2 = min(u2, q_k/p_k)
 *
 * Se u1 > u2: linha totalmente fora.
 * Senão: endpoints recortados são calculados com u1 e u2.
 *
 * @param {number} x1 - X do primeiro endpoint
 * @param {number} y1 - Y do primeiro endpoint
 * @param {number} x2 - X do segundo endpoint
 * @param {number} y2 - Y do segundo endpoint
 * @param {number} xmin - Limite esquerdo da janela
 * @param {number} ymin - Limite inferior da janela
 * @param {number} xmax - Limite direito da janela
 * @param {number} ymax - Limite superior da janela
 * @returns {{x0: number, y0: number, x1: number, y1: number}|null}
 *          Segmento recortado ou null se totalmente fora
 */
function liangBarsky(x1, y1, x2, y2, xmin, ymin, xmax, ymax) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Parâmetros p e q para as 4 arestas da janela
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];

    let u1 = 0.0; // Parâmetro de entrada (início do segmento visível)
    let u2 = 1.0; // Parâmetro de saída (fim do segmento visível)

    for (let k = 0; k < 4; k++) {
        if (p[k] === 0) {
            // Linha PARALELA à aresta k
            if (q[k] < 0) {
                // Linha está completamente fora desta aresta
                return null;
            }
            // Senão: paralela e dentro — não afeta u1/u2, continua
        } else {
            const r = q[k] / p[k];

            if (p[k] < 0) {
                // Aresta de ENTRADA (a linha vai de fora para dentro)
                // u1 = max(u1, r)
                if (r > u1) {
                    u1 = r;
                }
            } else {
                // Aresta de SAÍDA (a linha vai de dentro para fora)
                // u2 = min(u2, r)
                if (r < u2) {
                    u2 = r;
                }
            }
        }
    }

    // Se u1 > u2, a linha está totalmente fora da janela
    if (u1 > u2) {
        return null;
    }

    // Calcula os novos endpoints usando a equação paramétrica
    const clippedX0 = x1 + u1 * dx;
    const clippedY0 = y1 + u1 * dy;
    const clippedX1 = x1 + u2 * dx;
    const clippedY1 = y1 + u2 * dy;

    return {
        x0: clippedX0,
        y0: clippedY0,
        x1: clippedX1,
        y1: clippedY1
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export { cohenSutherland, liangBarsky, computeOutcode, INSIDE, LEFT, RIGHT, BOTTOM, TOP };
