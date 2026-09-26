/**
 * ============================================================================
 * transformations.js — Transformações Geométricas 2D
 * ============================================================================
 *
 * Implementação das transformações geométricas 2D usando coordenadas
 * homogêneas (matrizes 3×3).
 *
 * Matrizes são representadas como arrays 3×3 na forma:
 *   [[a, b, c],
 *    [d, e, f],
 *    [0, 0, 1]]
 *
 * Um ponto (x, y) é representado como vetor coluna [x, y, 1].
 *
 * Todas as funções de criação de matriz retornam a matriz 3×3.
 * A função applyTransform aplica a matriz a uma lista de pontos.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Funções Auxiliares de Matrizes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma matriz identidade 3×3.
 * @returns {number[][]} Matriz identidade
 */
function identity() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

/**
 * Multiplica duas matrizes 3×3.
 * Resultado: C = A × B
 *
 * @param {number[][]} A - Primeira matriz 3×3
 * @param {number[][]} B - Segunda matriz 3×3
 * @returns {number[][]} Produto A × B
 */
function multiplyMatrices(A, B) {
    const C = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            C[i][j] = A[i][0] * B[0][j] +
                      A[i][1] * B[1][j] +
                      A[i][2] * B[2][j];
        }
    }
    return C;
}

/**
 * Multiplica uma matriz 3×3 por um vetor coluna [x, y, 1].
 *
 * @param {number[][]} M - Matriz 3×3
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @returns {{x: number, y: number}} Ponto transformado
 */
function multiplyMatrixPoint(M, x, y) {
    const rx = M[0][0] * x + M[0][1] * y + M[0][2];
    const ry = M[1][0] * x + M[1][1] * y + M[1][2];
    // M[2][0]*x + M[2][1]*y + M[2][2] = 1 (homogêneo)
    return { x: rx, y: ry };
}

// ──────────────────────────────────────────────────────────────────────────────
// Matrizes de Transformação
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cria a matriz de Translação.
 *
 * | 1  0  tx |
 * | 0  1  ty |
 * | 0  0  1  |
 *
 * x' = x + tx
 * y' = y + ty
 *
 * @param {number} tx - Deslocamento em X
 * @param {number} ty - Deslocamento em Y
 * @returns {number[][]} Matriz de translação 3×3
 */
function translationMatrix(tx, ty) {
    return [
        [1, 0, tx],
        [0, 1, ty],
        [0, 0, 1]
    ];
}

/**
 * Cria a matriz de Rotação em torno da origem.
 *
 * | cos(θ)  -sin(θ)  0 |
 * | sin(θ)   cos(θ)  0 |
 * |   0        0     1 |
 *
 * x' = x·cos(θ) − y·sin(θ)
 * y' = x·sin(θ) + y·cos(θ)
 *
 * @param {number} angleDegrees - Ângulo de rotação em graus (anti-horário)
 * @returns {number[][]} Matriz de rotação 3×3
 */
function rotationMatrix(angleDegrees) {
    const rad = angleDegrees * Math.PI / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    return [
        [cosA, -sinA, 0],
        [sinA,  cosA, 0],
        [0,     0,    1]
    ];
}

/**
 * Cria a matriz de Escala em relação à origem.
 *
 * | sx  0   0 |
 * | 0   sy  0 |
 * | 0   0   1 |
 *
 * x' = x · sx
 * y' = y · sy
 *
 * @param {number} sx - Fator de escala em X
 * @param {number} sy - Fator de escala em Y
 * @returns {number[][]} Matriz de escala 3×3
 */
function scaleMatrix(sx, sy) {
    return [
        [sx, 0,  0],
        [0,  sy, 0],
        [0,  0,  1]
    ];
}

/**
 * Cria a matriz de Reflexão no Eixo X.
 * Inverte a coordenada Y: y' = -y
 *
 * | 1   0   0 |
 * | 0  -1   0 |
 * | 0   0   1 |
 *
 * @returns {number[][]} Matriz de reflexão 3×3
 */
function reflectXMatrix() {
    return [
        [1,  0, 0],
        [0, -1, 0],
        [0,  0, 1]
    ];
}

/**
 * Cria a matriz de Reflexão no Eixo Y.
 * Inverte a coordenada X: x' = -x
 *
 * | -1  0   0 |
 * |  0  1   0 |
 * |  0  0   1 |
 *
 * @returns {number[][]} Matriz de reflexão 3×3
 */
function reflectYMatrix() {
    return [
        [-1, 0, 0],
        [0,  1, 0],
        [0,  0, 1]
    ];
}

/**
 * Cria a matriz de Reflexão na Origem (Eixo XY).
 * Inverte ambas coordenadas: x' = -x, y' = -y
 *
 * | -1   0   0 |
 * |  0  -1   0 |
 * |  0   0   1 |
 *
 * @returns {number[][]} Matriz de reflexão 3×3
 */
function reflectXYMatrix() {
    return [
        [-1,  0, 0],
        [0,  -1, 0],
        [0,   0, 1]
    ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Aplicação de Transformações
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Aplica uma matriz de transformação 3×3 a uma lista de pontos.
 *
 * @param {Array<{x: number, y: number}>} points - Lista de pontos
 * @param {number[][]} matrix - Matriz de transformação 3×3
 * @returns {Array<{x: number, y: number}>} Pontos transformados
 */
function applyTransform(points, matrix) {
    return points.map(p => multiplyMatrixPoint(matrix, p.x, p.y));
}

/**
 * Aplica uma transformação a uma primitiva, com rotação/escala em torno
 * do centroide da primitiva (e não da origem).
 *
 * Para rotação e escala, compõe as matrizes:
 *   1. Translada centroide para a origem
 *   2. Aplica a transformação
 *   3. Translada de volta
 *
 * @param {Object} primitive - Primitiva gráfica (Point, Line, Circle, Polygon)
 * @param {number[][]} matrix - Matriz de transformação
 * @param {boolean} [aroundCenter=true] - Se true, aplica em torno do centroide
 */
function applyTransformToPrimitive(primitive, matrix, aroundCenter = true) {
    const vertices = primitive.getVertices();

    if (aroundCenter && vertices.length > 0) {
        // Calcula o centroide dos vértices
        let cx = 0, cy = 0;
        vertices.forEach(v => { cx += v.x; cy += v.y; });
        cx /= vertices.length;
        cy /= vertices.length;

        // Compõe: T(-cx,-cy) → Transformação → T(cx,cy)
        const toOrigin = translationMatrix(-cx, -cy);
        const fromOrigin = translationMatrix(cx, cy);
        const composed = multiplyMatrices(fromOrigin, multiplyMatrices(matrix, toOrigin));

        const transformed = applyTransform(vertices, composed);
        primitive.setVertices(transformed);
    } else {
        const transformed = applyTransform(vertices, matrix);
        primitive.setVertices(transformed);
    }

    // Para circunferências, aplica escala ao raio se a transformação for escala
    if (primitive.type === 'circle' && matrix[0][0] !== undefined) {
        // Detecta se é uma escala (diagonal não-unitária, off-diagonal zero)
        const isScale = matrix[0][1] === 0 && matrix[1][0] === 0 &&
                       (matrix[0][0] !== 1 || matrix[1][1] !== 1) &&
                        matrix[0][0] === matrix[1][1]; // escala uniforme
        if (isScale) {
            primitive.radius = Math.abs(primitive.radius * matrix[0][0]);
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilitários
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converte uma matriz 3×3 para uma string formatada para exibição.
 * @param {number[][]} matrix
 * @returns {string}
 */
function matrixToString(matrix) {
    return matrix.map(row =>
        '| ' + row.map(v => v.toFixed(2).padStart(7)).join('  ') + ' |'
    ).join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export {
    identity,
    multiplyMatrices,
    multiplyMatrixPoint,
    translationMatrix,
    rotationMatrix,
    scaleMatrix,
    reflectXMatrix,
    reflectYMatrix,
    reflectXYMatrix,
    applyTransform,
    applyTransformToPrimitive,
    matrixToString
};

