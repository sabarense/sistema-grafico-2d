/**
 * ============================================================================
 * history.js — Sistema de Undo/Redo
 * ============================================================================
 *
 * Implementa um histórico de estados da cena para desfazer/refazer ações.
 * Cada snapshot é uma cópia profunda serializada das primitivas da cena.
 */

class HistoryManager {
    /**
     * @param {number} [maxSize=50] - Número máximo de estados armazenados
     */
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.undoStack = [];   // Estados anteriores
        this.redoStack = [];   // Estados desfeitos
    }

    /**
     * Salva um snapshot do estado atual da cena.
     * Deve ser chamado ANTES de cada ação que modifica a cena.
     *
     * @param {Array} primitives - Array de primitivas da cena
     */
    saveState(primitives) {
        // Serializa as primitivas (cópia profunda via JSON)
        const snapshot = JSON.stringify(primitives.map(p => this._serializePrimitive(p)));

        this.undoStack.push(snapshot);

        // Limita o tamanho do histórico
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }

        // Limpa o redo stack quando uma nova ação é feita
        this.redoStack = [];
    }

    /**
     * Desfaz a última ação, retornando o estado anterior.
     * @param {Array} currentPrimitives - Estado atual (para salvar no redo)
     * @returns {Array|null} Primitivas deserializadas ou null se não há undo
     */
    undo(currentPrimitives) {
        if (this.undoStack.length === 0) return null;

        // Salva estado atual no redo
        const currentSnapshot = JSON.stringify(
            currentPrimitives.map(p => this._serializePrimitive(p))
        );
        this.redoStack.push(currentSnapshot);

        // Restaura o estado anterior
        const previousSnapshot = this.undoStack.pop();
        return this._deserializeAll(JSON.parse(previousSnapshot));
    }

    /**
     * Refaz a última ação desfeita.
     * @param {Array} currentPrimitives - Estado atual (para salvar no undo)
     * @returns {Array|null} Primitivas deserializadas ou null se não há redo
     */
    redo(currentPrimitives) {
        if (this.redoStack.length === 0) return null;

        // Salva estado atual no undo
        const currentSnapshot = JSON.stringify(
            currentPrimitives.map(p => this._serializePrimitive(p))
        );
        this.undoStack.push(currentSnapshot);

        // Restaura o estado redo
        const nextSnapshot = this.redoStack.pop();
        return this._deserializeAll(JSON.parse(nextSnapshot));
    }

    /** @returns {boolean} Se há estados para desfazer */
    canUndo() { return this.undoStack.length > 0; }

    /** @returns {boolean} Se há estados para refazer */
    canRedo() { return this.redoStack.length > 0; }

    /** Limpa todo o histórico */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    // ─── Serialização ────────────────────────────────────────────────────

    _serializePrimitive(p) {
        const base = { type: p.type, id: p.id, color: p.color, selected: p.selected };
        switch (p.type) {
            case 'point':
                return { ...base, x: p.x, y: p.y };
            case 'line':
                return { ...base, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, algorithm: p.algorithm };
            case 'circle':
                return { ...base, cx: p.cx, cy: p.cy, radius: p.radius };
            case 'polygon':
                return { ...base, vertices: p.vertices.map(v => ({ x: v.x, y: v.y })) };
            default:
                return base;
        }
    }

    _deserializeAll(dataArray) {
        // Retorna os objetos crus — o main.js vai reconstruir com as classes reais
        return dataArray;
    }
}

export { HistoryManager };
