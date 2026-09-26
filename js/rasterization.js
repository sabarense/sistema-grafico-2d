/**
 * ============================================================================
 * rasterization.js — Algoritmos de Rasterização de Primitivas
 * ============================================================================
 *
 * Implementações dos algoritmos fundamentais de rasterização
 *
 * Cada função retorna um array de pixels {x, y} a serem plotados.
 * Nenhuma função de biblioteca gráfica é utilizada.
 */

// ──────────────────────────────────────────────────────────────────────────────
// DDA (Digital Differential Analyzer) — Algoritmo de Rasterização de Retas
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Rasteriza um segmento de reta usando o algoritmo DDA.
 *
 * Algoritmo:
 *   1. Calcula dx = x2 - x1, dy = y2 - y1
 *   2. steps = max(|dx|, |dy|)
 *   3. Incrementos: xInc = dx / steps, yInc = dy / steps
 *   4. Para cada passo, plota round(x), round(y) e incrementa x e y
 *
 * @param {number} x1 - Coordenada X do ponto inicial
 * @param {number} y1 - Coordenada Y do ponto inicial
 * @param {number} x2 - Coordenada X do ponto final
 * @param {number} y2 - Coordenada Y do ponto final
 * @returns {Array<{x: number, y: number}>} Lista de pixels a plotar
 */
function rasterizeDDA(x1, y1, x2, y2) {
    const pixels = [];

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Número de passos: o maior entre |dx| e |dy|
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    // Caso degenerado: ponto único
    if (steps === 0) {
        pixels.push({ x: Math.round(x1), y: Math.round(y1) });
        return pixels;
    }

    // Incrementos fracionários por passo
    const xIncrement = dx / steps;
    const yIncrement = dy / steps;

    let x = x1;
    let y = y1;

    // Itera steps + 1 vezes (inclui o ponto inicial e o final)
    for (let i = 0; i <= steps; i++) {
        pixels.push({ x: Math.round(x), y: Math.round(y) });
        x += xIncrement;
        y += yIncrement;
    }

    return pixels;
}

// ──────────────────────────────────────────────────────────────────────────────
// Bresenham — Algoritmo de Rasterização de Retas (apenas aritmética inteira)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Rasteriza um segmento de reta usando o algoritmo de Bresenham.
 *
 * Algoritmo (para o primeiro octante, 0 ≤ m ≤ 1):
 *   1. Calcula Δx = |x2 - x1|, Δy = |y2 - y1|
 *   2. Parâmetro de decisão inicial: p₀ = 2Δy − Δx
 *   3. Para cada x de x1 até x2:
 *      - Se p < 0: próximo pixel é (x+1, y),     p = p + 2Δy
 *      - Se p ≥ 0: próximo pixel é (x+1, y+1),   p = p + 2Δy − 2Δx
 *
 * O algoritmo é generalizado para todos os 8 octantes trocando x↔y e
 * ajustando os sinais dos incrementos conforme necessário.
 *
 * @param {number} x1 - Coordenada X do ponto inicial
 * @param {number} y1 - Coordenada Y do ponto inicial
 * @param {number} x2 - Coordenada X do ponto final
 * @param {number} y2 - Coordenada Y do ponto final
 * @returns {Array<{x: number, y: number}>} Lista de pixels a plotar
 */
function rasterizeBresenham(x1, y1, x2, y2) {
    const pixels = [];

    // Arredonda para inteiros (Bresenham opera com inteiros)
    let ix1 = Math.round(x1);
    let iy1 = Math.round(y1);
    let ix2 = Math.round(x2);
    let iy2 = Math.round(y2);

    let dx = Math.abs(ix2 - ix1);
    let dy = Math.abs(iy2 - iy1);

    // Direção do incremento em cada eixo
    const sx = ix1 < ix2 ? 1 : -1;
    const sy = iy1 < iy2 ? 1 : -1;

    // Flag: indica se a inclinação é "íngreme" (|dy| > |dx|)
    // Nesse caso, trocamos os papéis de x e y
    const steep = dy > dx;

    if (steep) {
        // Troca dx e dy para que dx seja sempre o eixo principal
        [dx, dy] = [dy, dx];
    }

    // Parâmetro de decisão inicial: p₀ = 2Δy − Δx
    let p = 2 * dy - dx;

    let x = ix1;
    let y = iy1;

    for (let i = 0; i <= dx; i++) {
        pixels.push({ x: x, y: y });

        if (p >= 0) {
            // Incrementa no eixo secundário
            if (steep) {
                x += sx;
            } else {
                y += sy;
            }
            // Atualiza parâmetro: p = p + 2Δy − 2Δx
            p -= 2 * dx;
        }

        // Sempre incrementa no eixo principal
        if (steep) {
            y += sy;
        } else {
            x += sx;
        }

        // Atualiza parâmetro: p = p + 2Δy
        p += 2 * dy;
    }

    return pixels;
}

// ──────────────────────────────────────────────────────────────────────────────
// Bresenham / Midpoint — Algoritmo de Rasterização de Circunferência
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Plota os 8 pontos simétricos de uma circunferência.
 * Dada a coordenada (x, y) relativa ao centro (cx, cy), os 8 pontos são:
 *   (cx+x, cy+y), (cx-x, cy+y), (cx+x, cy-y), (cx-x, cy-y),
 *   (cx+y, cy+x), (cx-y, cy+x), (cx+y, cy-x), (cx-y, cy-x)
 *
 * @param {Array} pixels - Array de saída
 * @param {number} cx - Centro X
 * @param {number} cy - Centro Y
 * @param {number} x - Coordenada X relativa
 * @param {number} y - Coordenada Y relativa
 */
function plotCirclePoints(pixels, cx, cy, x, y) {
    pixels.push({ x: cx + x, y: cy + y });
    pixels.push({ x: cx - x, y: cy + y });
    pixels.push({ x: cx + x, y: cy - y });
    pixels.push({ x: cx - x, y: cy - y });
    pixels.push({ x: cx + y, y: cy + x });
    pixels.push({ x: cx - y, y: cy + x });
    pixels.push({ x: cx + y, y: cy - x });
    pixels.push({ x: cx - y, y: cy - x });
}

/**
 * Rasteriza uma circunferência usando o algoritmo de Bresenham (Midpoint).
 *
 * Algoritmo:
 *   1. Ponto inicial: (x, y) = (0, R)
 *   2. Parâmetro de decisão inicial: p₀ = 1 − R
 *   3. Enquanto x ≤ y:
 *      - Plota os 8 pontos simétricos
 *      - x = x + 1
 *      - Se p < 0: p = p + 2x + 1
 *      - Se p ≥ 0: y = y - 1, p = p + 2x + 1 - 2y
 *
 * @param {number} cx - Coordenada X do centro
 * @param {number} cy - Coordenada Y do centro
 * @param {number} radius - Raio da circunferência
 * @returns {Array<{x: number, y: number}>} Lista de pixels a plotar
 */
function rasterizeCircle(cx, cy, radius) {
    const pixels = [];

    // Arredonda para inteiros
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    const r = Math.round(radius);

    if (r <= 0) {
        pixels.push({ x: icx, y: icy });
        return pixels;
    }

    let x = 0;
    let y = r;

    // Parâmetro de decisão inicial: p₀ = 1 − R
    let p = 1 - r;

    // Plota os pontos iniciais (nos 4 eixos cardinais)
    plotCirclePoints(pixels, icx, icy, x, y);

    // Itera do primeiro octante (x = 0 até x = y)
    while (x < y) {
        x++;

        if (p < 0) {
            // Midpoint está dentro do círculo — y não muda
            // p_{k+1} = p_k + 2x_{k+1} + 1
            p = p + 2 * x + 1;
        } else {
            // Midpoint está fora ou sobre o círculo — decrementa y
            y--;
            // p_{k+1} = p_k + 2x_{k+1} + 1 - 2y_{k+1}
            p = p + 2 * x + 1 - 2 * y;
        }

        plotCirclePoints(pixels, icx, icy, x, y);
    }

    return pixels;
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export { rasterizeDDA, rasterizeBresenham, rasterizeCircle };
