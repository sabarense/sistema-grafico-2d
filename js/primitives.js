/**
 * ============================================================================
 * primitives.js — Estruturas de Dados e Gerenciamento de Primitivas Gráficas
 * ============================================================================
 *
 * Este módulo define as classes fundamentais para representação de primitivas
 * gráficas 2D (Ponto, Reta, Circunferência, Polígono) e o SceneManager para
 * gerenciar a cena (adição, remoção, seleção por região retangular).
 *
 * Cada primitiva possui um ID único, cor, flag de seleção e tipo.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Contador global para IDs únicos
// ──────────────────────────────────────────────────────────────────────────────
let _nextId = 1;

/**
 * Gera um ID único incremental para cada primitiva.
 * @returns {number} ID único
 */
function generateId() {
    return _nextId++;
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Point (Vértice / Ponto)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Representa um ponto (vértice) no espaço 2D.
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @param {string} [color='#00FF88'] - Cor do ponto em hexadecimal
 */
class Point {
    constructor(x, y, color = '#00FF88') {
        this.id = generateId();
        this.type = 'point';
        this.x = x;
        this.y = y;
        this.color = color;
        this.selected = false;
    }

    /**
     * Retorna os vértices da primitiva (para transformações uniformes).
     * @returns {Array<{x: number, y: number}>}
     */
    getVertices() {
        return [{ x: this.x, y: this.y }];
    }

    /**
     * Atualiza os vértices da primitiva após transformação.
     * @param {Array<{x: number, y: number}>} vertices
     */
    setVertices(vertices) {
        this.x = vertices[0].x;
        this.y = vertices[0].y;
    }

    /**
     * Verifica se o ponto está dentro de uma região retangular (AABB).
     * @param {number} xmin - Limite esquerdo
     * @param {number} ymin - Limite superior
     * @param {number} xmax - Limite direito
     * @param {number} ymax - Limite inferior
     * @returns {boolean}
     */
    isInsideRect(xmin, ymin, xmax, ymax) {
        return this.x >= xmin && this.x <= xmax &&
               this.y >= ymin && this.y <= ymax;
    }

    /**
     * Retorna uma cópia (clone) profunda do ponto.
     * @returns {Point}
     */
    clone() {
        const p = new Point(this.x, this.y, this.color);
        p.id = this.id;
        p.selected = this.selected;
        return p;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Line (Reta / Segmento de Reta)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Representa um segmento de reta definido por dois pontos.
 * @param {number} x1 - Coordenada X do ponto inicial
 * @param {number} y1 - Coordenada Y do ponto inicial
 * @param {number} x2 - Coordenada X do ponto final
 * @param {number} y2 - Coordenada Y do ponto final
 * @param {string} [algorithm='bresenham'] - Algoritmo de rasterização ('dda' ou 'bresenham')
 * @param {string} [color='#00BFFF'] - Cor da reta
 */
class Line {
    constructor(x1, y1, x2, y2, algorithm = 'bresenham', color = '#00BFFF') {
        this.id = generateId();
        this.type = 'line';
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.algorithm = algorithm; // 'dda' ou 'bresenham'
        this.color = color;
        this.selected = false;
    }

    getVertices() {
        return [
            { x: this.x1, y: this.y1 },
            { x: this.x2, y: this.y2 }
        ];
    }

    setVertices(vertices) {
        this.x1 = vertices[0].x;
        this.y1 = vertices[0].y;
        this.x2 = vertices[1].x;
        this.y2 = vertices[1].y;
    }

    /**
     * Verifica se pelo menos um dos endpoints está dentro da região retangular.
     * (Critério simplificado para seleção — se um endpoint está dentro, seleciona)
     */
    isInsideRect(xmin, ymin, xmax, ymax) {
        const p1Inside = this.x1 >= xmin && this.x1 <= xmax &&
                         this.y1 >= ymin && this.y1 <= ymax;
        const p2Inside = this.x2 >= xmin && this.x2 <= xmax &&
                         this.y2 >= ymin && this.y2 <= ymax;
        return p1Inside || p2Inside;
    }

    clone() {
        const l = new Line(this.x1, this.y1, this.x2, this.y2, this.algorithm, this.color);
        l.id = this.id;
        l.selected = this.selected;
        return l;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Circle (Circunferência)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Representa uma circunferência definida por centro e raio.
 * @param {number} cx - Coordenada X do centro
 * @param {number} cy - Coordenada Y do centro
 * @param {number} radius - Raio da circunferência
 * @param {string} [color='#FF6B9D'] - Cor da circunferência
 */
class Circle {
    constructor(cx, cy, radius, color = '#FF6B9D') {
        this.id = generateId();
        this.type = 'circle';
        this.cx = cx;
        this.cy = cy;
        this.radius = radius;
        this.color = color;
        this.selected = false;
    }

    getVertices() {
        return [{ x: this.cx, y: this.cy }];
    }

    setVertices(vertices) {
        this.cx = vertices[0].x;
        this.cy = vertices[0].y;
    }

    /**
     * Verifica se o centro da circunferência está dentro da região.
     */
    isInsideRect(xmin, ymin, xmax, ymax) {
        return this.cx >= xmin && this.cx <= xmax &&
               this.cy >= ymin && this.cy <= ymax;
    }

    clone() {
        const c = new Circle(this.cx, this.cy, this.radius, this.color);
        c.id = this.id;
        c.selected = this.selected;
        return c;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Polygon (Polígono)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Representa um polígono definido por uma lista ordenada de vértices.
 * @param {Array<{x: number, y: number}>} vertices - Lista de vértices
 * @param {string} [color='#FFD93D'] - Cor do polígono
 */
class Polygon {
    constructor(vertices = [], color = '#FFD93D') {
        this.id = generateId();
        this.type = 'polygon';
        this.vertices = vertices.map(v => ({ x: v.x, y: v.y }));
        this.color = color;
        this.selected = false;
    }

    getVertices() {
        return this.vertices.map(v => ({ x: v.x, y: v.y }));
    }

    setVertices(vertices) {
        this.vertices = vertices.map(v => ({ x: v.x, y: v.y }));
    }

    /**
     * Verifica se pelo menos um vértice do polígono está dentro da região.
     */
    isInsideRect(xmin, ymin, xmax, ymax) {
        return this.vertices.some(v =>
            v.x >= xmin && v.x <= xmax &&
            v.y >= ymin && v.y <= ymax
        );
    }

    /**
     * Retorna as arestas do polígono como pares de vértices consecutivos.
     * @returns {Array<{x1, y1, x2, y2}>}
     */
    getEdges() {
        const edges = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const next = (i + 1) % this.vertices.length;
            edges.push({
                x1: this.vertices[i].x,
                y1: this.vertices[i].y,
                x2: this.vertices[next].x,
                y2: this.vertices[next].y
            });
        }
        return edges;
    }

    clone() {
        const p = new Polygon(this.vertices, this.color);
        p.id = this.id;
        p.selected = this.selected;
        return p;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Fill (Preenchimento)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Representa uma operação de preenchimento.
 * @param {number} x - Semente X (mundo)
 * @param {number} y - Semente Y (mundo)
 * @param {string} fillType - 'flood' ou 'boundary'
 * @param {string} color - Cor de preenchimento (hex)
 * @param {string} targetColor - Cor alvo (contorno ou antiga) (hex)
 */
class Fill {
    constructor(x, y, fillType, color, targetColor) {
        this.id = generateId();
        this.type = 'fill';
        this.x = x;
        this.y = y;
        this.fillType = fillType; // 'flood' ou 'boundary'
        this.color = color;
        this.targetColor = targetColor;
        this.selected = false;
    }

    getVertices() {
        return [{ x: this.x, y: this.y }];
    }

    setVertices(vertices) {
        if (vertices.length > 0) {
            this.x = vertices[0].x;
            this.y = vertices[0].y;
        }
    }

    isInsideRect(xmin, ymin, xmax, ymax) {
        return this.x >= xmin && this.x <= xmax &&
               this.y >= ymin && this.y <= ymax;
    }

    clone() {
        const f = new Fill(this.x, this.y, this.fillType, this.color, this.targetColor);
        f.id = this.id;
        f.selected = this.selected;
        return f;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Classe: SceneManager — Gerenciador da Cena
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Gerencia todas as primitivas da cena.
 * Suporta adição, remoção, seleção por região retangular e limpeza.
 */
class SceneManager {
    constructor() {
        /** @type {Array<Point|Line|Circle|Polygon>} */
        this.primitives = [];
    }

    /**
     * Adiciona uma primitiva à cena.
     * @param {Point|Line|Circle|Polygon} primitive
     */
    add(primitive) {
        this.primitives.push(primitive);
    }

    /**
     * Remove uma primitiva pelo ID.
     * @param {number} id
     */
    removeById(id) {
        this.primitives = this.primitives.filter(p => p.id !== id);
    }

    /**
     * Remove todas as primitivas selecionadas.
     */
    removeSelected() {
        this.primitives = this.primitives.filter(p => !p.selected);
    }

    /**
     * Desmarca a seleção de todas as primitivas.
     */
    deselectAll() {
        this.primitives.forEach(p => { p.selected = false; });
    }

    /**
     * Seleciona todas as primitivas que estão dentro da região retangular.
     * @param {number} xmin
     * @param {number} ymin
     * @param {number} xmax
     * @param {number} ymax
     * @returns {Array} primitivas selecionadas
     */
    selectByRect(xmin, ymin, xmax, ymax) {
        // Normaliza para garantir min < max
        const x0 = Math.min(xmin, xmax);
        const y0 = Math.min(ymin, ymax);
        const x1 = Math.max(xmin, xmax);
        const y1 = Math.max(ymin, ymax);

        const selected = [];
        this.primitives.forEach(p => {
            if (p.isInsideRect(x0, y0, x1, y1)) {
                p.selected = true;
                selected.push(p);
            }
        });
        return selected;
    }

    /**
     * Retorna todas as primitivas atualmente selecionadas.
     * @returns {Array}
     */
    getSelected() {
        return this.primitives.filter(p => p.selected);
    }

    /**
     * Retorna todas as primitivas da cena.
     * @returns {Array}
     */
    getAll() {
        return this.primitives;
    }

    /**
     * Remove todas as primitivas da cena.
     */
    clear() {
        this.primitives = [];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export { Point, Line, Circle, Polygon, Fill, SceneManager };
