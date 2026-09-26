/**
 * ============================================================================
 * ui.js — Interface Gráfica e Interação via Mouse (v2)
 * ============================================================================
 *
 * Gerencia toda a interação do usuário com a Área de Desenho:
 *   - Modos de desenho (selecionados por botões na toolbar)
 *   - Captura de eventos de mouse (click, drag, double-click)
 *   - Painel de transformações (sidebar)
 *   - Feedback visual (rubber-band, seleção, janela de recorte)
 *   - Undo/Redo, Color Picker, Salvar/Carregar, Hover highlight
 *
 * Toda a entrada é feita via mouse e controles da interface gráfica,
 * sem uso de entrada via teclado/console.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Modos de Interação
// ──────────────────────────────────────────────────────────────────────────────

/** @enum {string} Modos de interação disponíveis */
const Mode = {
    DRAW_POINT:          'draw_point',
    DRAW_LINE_DDA:       'draw_line_dda',
    DRAW_LINE_BRESENHAM: 'draw_line_bresenham',
    DRAW_CIRCLE:         'draw_circle',
    DRAW_POLYGON:        'draw_polygon',
    SELECT:              'select',
    CLIP_CS:             'clip_cs',
    CLIP_LB:             'clip_lb',
    BOUNDARY_FILL:       'boundary_fill',
    FLOOD_FILL:          'flood_fill'
};

// ──────────────────────────────────────────────────────────────────────────────
// Classe: UIManager
// ──────────────────────────────────────────────────────────────────────────────

class UIManager {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {import('./renderer.js').Renderer} renderer
     * @param {import('./primitives.js').SceneManager} sceneManager
     * @param {Function} onSceneChange - Callback chamado quando a cena muda
     */
    constructor(canvas, renderer, sceneManager, onSceneChange) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.scene = sceneManager;
        this.onSceneChange = onSceneChange;

        // Estado atual
        this.currentMode = Mode.DRAW_POINT;
        this.isDrawing = false;

        // Estado temporário para desenho interativo
        this.tempStartWorld = null;
        this.tempEndWorld = null;
        this.polygonVertices = [];

        // Estado de seleção
        this.selectionStart = null;
        this.selectionEnd = null;

        // Estado de clipping
        this.clipRect = null;

        // Estado de drag (mover elementos selecionados)
        this._isDragging = false;
        this._dragLastWorld = null;

        // Debounce para evitar conflito click/dblclick no polígono
        this._lastClickTime = 0;

        // Hover: ID da primitiva sob o cursor
        this._hoveredId = null;

        // Posição atual do mouse no mundo (para preview do polígono)
        this._mouseWorld = { x: 0, y: 0 };

        // Callbacks registrados pelo main.js
        this._onTransform = null;
        this._onClipApply = null;
        this._onUndo = null;
        this._onRedo = null;
        this._onSave = null;
        this._onLoad = null;
        this._onSaveState = null;

        // Inicializa os event listeners
        this._initMouseEvents();
        this._initToolbarEvents();
        this._initTransformEvents();
        this._initActionEvents();
        this._initLayoutEvents();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Eventos de Mouse no Canvas
    // ──────────────────────────────────────────────────────────────────────

    _getWorldCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        return this.renderer.screenToWorld(sx, sy);
    }

    _initMouseEvents() {
        // ── MOUSEDOWN ──
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const world = this._getWorldCoords(e);

            switch (this.currentMode) {
                case Mode.DRAW_POINT:
                    this._handleDrawPoint(world);
                    break;
                case Mode.DRAW_LINE_DDA:
                case Mode.DRAW_LINE_BRESENHAM:
                    this._handleLineStart(world);
                    break;
                case Mode.DRAW_CIRCLE:
                    this._handleCircleStart(world);
                    break;
                case Mode.DRAW_POLYGON:
                    this._handlePolygonClick(world);
                    break;
                case Mode.SELECT:
                    this._handleSelectionStart(world);
                    break;
                case Mode.CLIP_CS:
                case Mode.CLIP_LB:
                    this._handleClipStart(world);
                    break;

                case Mode.BOUNDARY_FILL:
                    this._handleBoundaryFill(world);
                    break;
                case Mode.FLOOD_FILL:
                    this._handleFloodFill(world);
                    break;
            }
        });

        // ── MOUSEMOVE ──
        this.canvas.addEventListener('mousemove', (e) => {
            const world = this._getWorldCoords(e);
            this._mouseWorld = world; // Sempre atualiza posição atual
            this._updateCoordsDisplay(world);
            this._updateHover(world);

            if (!this.isDrawing) {
                // Preview do polígono: re-renderiza para mostrar a linha até o mouse
                if (this.currentMode === Mode.DRAW_POLYGON && this.polygonVertices.length > 0) {
                    this.onSceneChange();
                }
                // Muda cursor no modo SELECT se estiver sobre elemento selecionado
                if (this.currentMode === Mode.SELECT) {
                    const overSelected = this.scene.getSelected().some(p =>
                        p.id === this._hoveredId
                    );
                    this.canvas.style.cursor = overSelected ? 'grab' : 'default';
                }
                return;
            }

            // Drag de elementos selecionados
            if (this._isDragging && this._dragLastWorld) {
                const dx = world.x - this._dragLastWorld.x;
                const dy = world.y - this._dragLastWorld.y;
                this._dragLastWorld = world;
                // Move todos os selecionados
                this.scene.getSelected().forEach(p => {
                    const verts = p.getVertices();
                    p.setVertices(verts.map(v => ({ x: v.x + dx, y: v.y + dy })));
                });
                this.onSceneChange();
                return;
            }

            switch (this.currentMode) {
                case Mode.DRAW_LINE_DDA:
                case Mode.DRAW_LINE_BRESENHAM:
                case Mode.DRAW_CIRCLE:
                    this.tempEndWorld = world;
                    this.onSceneChange();
                    break;
                case Mode.SELECT:
                    this.selectionEnd = world;
                    this.onSceneChange();
                    break;
                case Mode.CLIP_CS:
                case Mode.CLIP_LB:
                    this.tempEndWorld = world;
                    this.onSceneChange();
                    break;
            }
        });

        // ── MOUSEUP ──
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            const world = this._getWorldCoords(e);

            switch (this.currentMode) {
                case Mode.DRAW_LINE_DDA:
                    this._handleLineEnd(world, 'dda');
                    break;
                case Mode.DRAW_LINE_BRESENHAM:
                    this._handleLineEnd(world, 'bresenham');
                    break;
                case Mode.DRAW_CIRCLE:
                    this._handleCircleEnd(world);
                    break;
                case Mode.SELECT:
                    this._handleSelectionEnd(world);
                    break;
                case Mode.CLIP_CS:
                case Mode.CLIP_LB:
                    this._handleClipEnd(world);
                    break;
            }
        });

        // ── DBLCLICK — Fecha polígono ──
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.currentMode === Mode.DRAW_POLYGON) {
                this._handlePolygonClose();
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Hover Detection
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Atualiza qual primitiva está sob o cursor (para highlight).
     * Detecção simplificada: verifica proximidade dos vértices/centros.
     */
    _updateHover(world) {
        if (this.isDrawing) return;

        // Limiar em coordenadas de mundo, ajustado pelo zoom (8px na tela)
        const zoom = this.renderer.zoom || 1;
        const threshold = 8 / zoom;
        let closest = null;
        let closestDist = Infinity;

        this.scene.getAll().forEach(p => {
            if (p.type === 'fill') return; // Fill não tem hover
            const vertices = p.getVertices();
            vertices.forEach(v => {
                const dist = Math.sqrt((v.x - world.x) ** 2 + (v.y - world.y) ** 2);
                if (dist < threshold && dist < closestDist) {
                    closestDist = dist;
                    closest = p;
                }
            });
        });

        const newId = closest ? closest.id : null;
        if (newId !== this._hoveredId) {
            this._hoveredId = newId;
            this.onSceneChange();
        }
    }

    getHoveredPrimitiveId() {
        return this._hoveredId;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Handlers de Desenho
    // ──────────────────────────────────────────────────────────────────────

    _getColor() {
        return window.CG_getCurrentColor ? window.CG_getCurrentColor() : '#00BFFF';
    }

    _getSecondaryColor() {
        return window.CG_getSecondaryColor ? window.CG_getSecondaryColor() : '#FF6B9D';
    }

    _handleDrawPoint(world) {
        if (this._onSaveState) this._onSaveState();
        const { Point } = window.CG_Primitives;
        const point = new Point(Math.round(world.x), Math.round(world.y), this._getColor());
        this.scene.add(point);
        this.onSceneChange();
    }

    _handleLineStart(world) {
        this.isDrawing = true;
        this.tempStartWorld = { x: Math.round(world.x), y: Math.round(world.y) };
        this.tempEndWorld = { ...this.tempStartWorld };
    }

    _handleLineEnd(world, algorithm) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this._onSaveState) this._onSaveState();
        const { Line } = window.CG_Primitives;
        const end = { x: Math.round(world.x), y: Math.round(world.y) };
        const line = new Line(
            this.tempStartWorld.x, this.tempStartWorld.y,
            end.x, end.y,
            algorithm, this._getColor()
        );
        this.scene.add(line);

        this.tempStartWorld = null;
        this.tempEndWorld = null;
        this.onSceneChange();
    }

    _handleCircleStart(world) {
        this.isDrawing = true;
        this.tempStartWorld = { x: Math.round(world.x), y: Math.round(world.y) };
        this.tempEndWorld = { ...this.tempStartWorld };
    }

    _handleCircleEnd(world) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const { Circle } = window.CG_Primitives;
        const dx = world.x - this.tempStartWorld.x;
        const dy = world.y - this.tempStartWorld.y;
        const radius = Math.round(Math.sqrt(dx * dx + dy * dy));

        if (radius > 0) {
            if (this._onSaveState) this._onSaveState();
            const circle = new Circle(
                this.tempStartWorld.x, this.tempStartWorld.y, radius, this._getColor()
            );
            this.scene.add(circle);
        }

        this.tempStartWorld = null;
        this.tempEndWorld = null;
        this.onSceneChange();
    }

    _handlePolygonClick(world) {
        const now = Date.now();
        // Ignora cliques muito seguidos (evita duplo clique duplicar vértice)
        if (now - this._lastClickTime < 350) return;
        this._lastClickTime = now;

        const SNAP_RADIUS = 15 / (this.renderer.zoom || 1); // 15px na tela

        // Se já tem vértices e clicou perto do primeiro → fecha o polígono
        if (this.polygonVertices.length >= 3) {
            const first = this.polygonVertices[0];
            const dx = world.x - first.x;
            const dy = world.y - first.y;
            if (Math.sqrt(dx * dx + dy * dy) <= SNAP_RADIUS) {
                this._handlePolygonClose();
                return;
            }
        }

        // Evita adicionar vértice idêntico ao anterior
        if (this.polygonVertices.length > 0) {
            const last = this.polygonVertices[this.polygonVertices.length - 1];
            if (last.x === Math.round(world.x) && last.y === Math.round(world.y)) return;
        }

        this.polygonVertices.push({ x: Math.round(world.x), y: Math.round(world.y) });
        this.onSceneChange();
    }

    getMouseWorld() { return this._mouseWorld; }

    _handlePolygonClose() {
        // Remove o último vértice se for idêntico ao penúltimo (gerado pelo segundo click do dblclick)
        if (this.polygonVertices.length > 1) {
            const last = this.polygonVertices[this.polygonVertices.length - 1];
            const prev = this.polygonVertices[this.polygonVertices.length - 2];
            if (last.x === prev.x && last.y === prev.y) {
                this.polygonVertices.pop();
            }
        }

        // Remove o último vértice se for idêntico ao primeiro (duplica o fechamento)
        if (this.polygonVertices.length > 1) {
            const first = this.polygonVertices[0];
            const last = this.polygonVertices[this.polygonVertices.length - 1];
            if (first.x === last.x && first.y === last.y) {
                this.polygonVertices.pop();
            }
        }

        if (this.polygonVertices.length >= 3) {
            if (this._onSaveState) this._onSaveState();
            const { Polygon } = window.CG_Primitives;
            const polygon = new Polygon(this.polygonVertices, this._getColor());
            this.scene.add(polygon);
        }
        this.polygonVertices = [];
        this._lastClickTime = 0; // Reseta debounce
        this.onSceneChange();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Handlers de Preenchimento
    // ──────────────────────────────────────────────────────────────────────

    _handleBoundaryFill(world) {
        if (this._onSaveState) this._onSaveState();
        const { Fill } = window.CG_Primitives;
        // targetColor = cor do contorno (secundária)
        const fill = new Fill(Math.round(world.x), Math.round(world.y), 'boundary', this._getColor(), this._getSecondaryColor());
        this.scene.add(fill);
        this.onSceneChange();
    }

    _handleFloodFill(world) {
        if (this._onSaveState) this._onSaveState();
        const { Fill } = window.CG_Primitives;
        // Lê a cor do pixel em coordenadas de tela (consistente com filling.js que usa getPixelScreen)
        let targetColor = '#000000';
        const screen = this.renderer.worldToScreen(Math.round(world.x), Math.round(world.y));
        const pixel = this.renderer.getPixelScreen(Math.round(screen.x), Math.round(screen.y));
        if (pixel) {
            targetColor = this.renderer.constructor.rgbaToHex(pixel);
        }

        const fill = new Fill(Math.round(world.x), Math.round(world.y), 'flood', this._getColor(), targetColor);
        this.scene.add(fill);
        this.onSceneChange();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Handlers de Seleção
    // ──────────────────────────────────────────────────────────────────────

    _handleSelectionStart(world) {
        // Verifica se clicou sobre um elemento já selecionado ou o elemento em hover
        const hoveredId = this._hoveredId;
        const selected = this.scene.getSelected();
        const isOverSelected = selected.length > 0 && selected.some(p => p.id === hoveredId);
        const isOverHovered = hoveredId !== null && !isOverSelected;

        if (isOverSelected) {
            // Inicia drag dos elementos selecionados
            this._isDragging = true;
            this._dragLastWorld = world;
            this.isDrawing = true;
            this.canvas.style.cursor = 'grabbing';
            if (this._onSaveState) this._onSaveState(); // salva estado para undo
        } else if (isOverHovered) {
            // Clicou num elemento NÃO selecionado: seleciona só ele e inicia drag
            this.scene.deselectAll();
            const hovered = this.scene.getAll().find(p => p.id === hoveredId);
            if (hovered) {
                hovered.selected = true;
                this._isDragging = true;
                this._dragLastWorld = world;
                this.isDrawing = true;
                this.canvas.style.cursor = 'grabbing';
                if (this._onSaveState) this._onSaveState();
            }
        } else {
            // Clicou em espaço vazio: inicia retângulo de seleção
            this._isDragging = false;
            this.isDrawing = true;
            this.scene.deselectAll();
            this.selectionStart = { x: world.x, y: world.y };
            this.selectionEnd = { ...this.selectionStart };
            this.canvas.style.cursor = 'crosshair';
        }
    }

    _handleSelectionEnd(world) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.canvas.style.cursor = 'default';

        if (this._isDragging) {
            // Fim do drag — apenas reseta o estado
            this._isDragging = false;
            this._dragLastWorld = null;
            this.onSceneChange();
            this._updateSelectionInfo();
            return;
        }

        this.selectionEnd = { x: world.x, y: world.y };

        const xmin = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const ymin = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const xmax = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const ymax = Math.max(this.selectionStart.y, this.selectionEnd.y);

        this.scene.selectByRect(xmin, ymin, xmax, ymax);

        this.selectionStart = null;
        this.selectionEnd = null;
        this.onSceneChange();
        this._updateSelectionInfo();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Handlers de Clipping
    // ──────────────────────────────────────────────────────────────────────

    _handleClipStart(world) {
        this.isDrawing = true;
        this.tempStartWorld = { x: Math.round(world.x), y: Math.round(world.y) };
        this.tempEndWorld = { ...this.tempStartWorld };
    }

    _handleClipEnd(world) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const end = { x: Math.round(world.x), y: Math.round(world.y) };

        this.clipRect = {
            xmin: Math.min(this.tempStartWorld.x, end.x),
            ymin: Math.min(this.tempStartWorld.y, end.y),
            xmax: Math.max(this.tempStartWorld.x, end.x),
            ymax: Math.max(this.tempStartWorld.y, end.y)
        };

        if (this._onClipApply) {
            this._onClipApply(
                this.currentMode === Mode.CLIP_CS ? 'cohen-sutherland' : 'liang-barsky',
                this.clipRect
            );
        }

        this.tempStartWorld = null;
        this.tempEndWorld = null;
        this.onSceneChange();
    }

    setClipCallback(callback) { this._onClipApply = callback; }

    // ──────────────────────────────────────────────────────────────────────
    // Eventos da Toolbar
    // ──────────────────────────────────────────────────────────────────────

    _initToolbarEvents() {
        const buttons = document.querySelectorAll('[data-mode]');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.mode;

                if (this.currentMode !== Mode.DRAW_POLYGON && this.polygonVertices.length > 0) {
                    this.polygonVertices = [];
                    this.onSceneChange();
                }

                this._updateStatusText();
            });
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Eventos de Transformação (sidebar)
    // ──────────────────────────────────────────────────────────────────────

    _initTransformEvents() {
        const bind = (btnId, cb) => {
            const btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', cb);
        };

        bind('btn-translate', () => {
            const tx = parseFloat(document.getElementById('input-tx').value) || 0;
            const ty = parseFloat(document.getElementById('input-ty').value) || 0;
            if (this._onTransform) this._onTransform('translate', { tx, ty });
        });

        bind('btn-rotate', () => {
            const angle = parseFloat(document.getElementById('input-angle').value) || 0;
            if (this._onTransform) this._onTransform('rotate', { angle });
        });

        bind('btn-scale', () => {
            const sx = parseFloat(document.getElementById('input-sx').value) || 1;
            const sy = parseFloat(document.getElementById('input-sy').value) || 1;
            if (this._onTransform) this._onTransform('scale', { sx, sy });
        });

        bind('btn-reflect-x', () => {
            if (this._onTransform) this._onTransform('reflectX', {});
        });

        bind('btn-reflect-y', () => {
            if (this._onTransform) this._onTransform('reflectY', {});
        });

        bind('btn-reflect-xy', () => {
            if (this._onTransform) this._onTransform('reflectXY', {});
        });
    }

    setTransformCallback(callback) { this._onTransform = callback; }

    // ──────────────────────────────────────────────────────────────────────
    // Eventos de Ações
    // ──────────────────────────────────────────────────────────────────────

    _initActionEvents() {
        const bind = (id, cb) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', cb);
        };

        bind('btn-clear', () => {
            if (this._onSaveState) this._onSaveState();
            this.scene.clear();
            this.clipRect = null;
            this.onSceneChange();
            this._updateSelectionInfo();
        });

        bind('btn-delete', () => {
            if (this._onSaveState) this._onSaveState();
            this.scene.removeSelected();
            this.onSceneChange();
            this._updateSelectionInfo();
        });

        bind('btn-grid', () => {
            this.renderer.showGrid = !this.renderer.showGrid;
            const btn = document.getElementById('btn-grid');
            if (btn) btn.classList.toggle('active', this.renderer.showGrid);
            this.onSceneChange();
        });

        bind('btn-axes', () => {
            this.renderer.showAxes = !this.renderer.showAxes;
            const btn = document.getElementById('btn-axes');
            if (btn) btn.classList.toggle('active', this.renderer.showAxes);
            this.onSceneChange();
        });

        // Undo / Redo
        bind('btn-undo', () => { if (this._onUndo) this._onUndo(); });
        bind('btn-redo', () => { if (this._onRedo) this._onRedo(); });

        // Salvar / Carregar
        bind('btn-save', () => { if (this._onSave) this._onSave(); });
        bind('btn-load', () => { if (this._onLoad) this._onLoad(); });
    }

    setUndoRedoCallbacks(undo, redo) {
        this._onUndo = undo;
        this._onRedo = redo;
    }

    setSaveLoadCallbacks(save, load) {
        this._onSave = save;
        this._onLoad = load;
    }

    setSaveStateCallback(cb) { this._onSaveState = cb; }

    // ──────────────────────────────────────────────────────────────────────
    // Eventos de Layout (Toggles)
    // ──────────────────────────────────────────────────────────────────────

    _initLayoutEvents() {
        const layout = document.getElementById('app-layout');
        const toggleLeft = document.getElementById('toggle-left');
        const toggleRight = document.getElementById('toggle-right');

        if (toggleLeft && layout) {
            toggleLeft.addEventListener('click', () => {
                layout.classList.toggle('collapsed-left');
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 300); // Espera a transição do CSS
            });
        }

        if (toggleRight && layout) {
            toggleRight.addEventListener('click', () => {
                layout.classList.toggle('collapsed-right');
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 300);
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Atualização de Informações na Interface
    // ──────────────────────────────────────────────────────────────────────

    _updateCoordsDisplay(world) {
        const el = document.getElementById('coords-display');
        if (el) {
            el.textContent = `(${Math.round(world.x)}, ${Math.round(world.y)})`;
        }
    }

    _updateStatusText() {
        const el = document.getElementById('status-text');
        if (!el) return;

        const modeNames = {
            [Mode.DRAW_POINT]:          'Desenhar Ponto — Clique para inserir',
            [Mode.DRAW_LINE_DDA]:       'Reta DDA — Clique e arraste',
            [Mode.DRAW_LINE_BRESENHAM]: 'Reta Bresenham — Clique e arraste',
            [Mode.DRAW_CIRCLE]:         'Circunferência — Clique (centro) e arraste (raio)',
            [Mode.DRAW_POLYGON]:        'Polígono — Clique p/ vértices, duplo-clique p/ fechar',
            [Mode.SELECT]:              'Selecionar — Arraste para criar caixa de seleção',
            [Mode.CLIP_CS]:             'Recorte Cohen-Sutherland — Arraste a janela',
            [Mode.CLIP_LB]:             'Recorte Liang-Barsky — Arraste a janela',
            [Mode.BOUNDARY_FILL]:       'Boundary Fill — Preenche até encontrar a Cor Secundária',
            [Mode.FLOOD_FILL]:          'Flood Fill — Substitui a cor sob o clique pela Cor Principal'
        };

        el.textContent = modeNames[this.currentMode] || '';
    }

    _updateSelectionInfo() {
        const el = document.getElementById('selection-info');
        if (!el) return;

        const selected = this.scene.getSelected();
        if (selected.length === 0) {
            el.textContent = 'Nenhum elemento selecionado';
        } else {
            el.textContent = `${selected.length} elemento(s) selecionado(s)`;
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Getters para o estado temporário
    // ──────────────────────────────────────────────────────────────────────

    getTempDrawing() {
        if (!this.isDrawing || !this.tempStartWorld || !this.tempEndWorld) return null;
        return { mode: this.currentMode, start: this.tempStartWorld, end: this.tempEndWorld };
    }

    getTempSelection() {
        if (!this.isDrawing || !this.selectionStart || !this.selectionEnd) return null;
        return { start: this.selectionStart, end: this.selectionEnd };
    }

    getPolygonInProgress() { return this.polygonVertices; }
    getClipRect() { return this.clipRect; }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export { UIManager, Mode };
