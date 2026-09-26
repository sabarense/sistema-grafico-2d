/**
 * ============================================================================
 * main.js — Ponto de Entrada e Loop Principal (v2 — com todas as melhorias)
 * ============================================================================
 *
 * Inicializa todos os módulos, conecta os callbacks entre UI e núcleo gráfico,
 * e implementa o loop de renderização.
 *
 * Melhorias v2:
 *   - Undo/Redo
 *   - Color picker (cor dinâmica)
 *   - Salvar/Carregar cena (JSON)
 *   - Zoom e Pan
 *   - Labels de vértices nos selecionados
 *   - Exibição da matriz de transformação
 *   - Hover highlight
 */

import { Point, Line, Circle, Polygon, Fill, SceneManager } from './primitives.js';
import { rasterizeDDA, rasterizeBresenham, rasterizeCircle } from './rasterization.js';
import { boundaryFill, floodFill } from './filling.js';
import {
    translationMatrix, rotationMatrix, scaleMatrix,
    reflectXMatrix, reflectYMatrix, reflectXYMatrix,
    applyTransformToPrimitive,
    matrixToString
} from './transformations.js';
import { cohenSutherland, liangBarsky } from './clipping.js';
import { Renderer } from './renderer.js';
import { UIManager, Mode } from './ui.js';
import { HistoryManager } from './history.js';

// ──────────────────────────────────────────────────────────────────────────────
// Expõe as classes de primitivas globalmente para uso do UIManager
// ──────────────────────────────────────────────────────────────────────────────
window.CG_Primitives = { Point, Line, Circle, Polygon, Fill };

// ──────────────────────────────────────────────────────────────────────────────
// Inicialização
// ──────────────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('drawing-canvas');
const scene = new SceneManager();
const renderer = new Renderer(canvas);
const history = new HistoryManager(50);

// ── Zoom e Pan ──────────────────────────────────────────────────────────────
let zoomLevel = 1.0;
let panOffsetX = 0;
let panOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Ajusta o canvas ao tamanho do container
function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    if (container) {
        renderer.resize(container.clientWidth, container.clientHeight);
        renderScene();
    }
}
window.addEventListener('resize', resizeCanvas);

// ──────────────────────────────────────────────────────────────────────────────
// UIManager — Instanciação e Callbacks
// ──────────────────────────────────────────────────────────────────────────────

const ui = new UIManager(canvas, renderer, scene, renderScene);

/**
 * Retorna a cor atualmente selecionada no color picker.
 * @returns {string} Cor em hexadecimal
 */
function getCurrentColor() {
    const picker = document.getElementById('color-picker');
    return picker ? picker.value : '#00BFFF';
}

function getSecondaryColor() {
    const picker = document.getElementById('color-picker-secondary');
    return picker ? picker.value : '#FF6B9D';
}

// Expõe getCurrentColor globalmente para o UIManager
window.CG_getCurrentColor = getCurrentColor;
window.CG_getSecondaryColor = getSecondaryColor;

// ── Callback de Transformação ───────────────────────────────────────────────
ui.setTransformCallback((type, params) => {
    const selected = scene.getSelected();
    if (selected.length === 0) {
        showToast('Selecione elementos primeiro!', 'warning');
        return;
    }

    // Salva estado para undo
    history.saveState(scene.getAll());

    let matrix;
    let aroundCenter = true;

    switch (type) {
        case 'translate':
            matrix = translationMatrix(params.tx, params.ty);
            aroundCenter = false;
            break;
        case 'rotate':
            matrix = rotationMatrix(params.angle);
            break;
        case 'scale':
            matrix = scaleMatrix(params.sx, params.sy);
            break;
        case 'reflectX':
            matrix = reflectXMatrix();
            aroundCenter = false;
            break;
        case 'reflectY':
            matrix = reflectYMatrix();
            aroundCenter = false;
            break;
        case 'reflectXY':
            matrix = reflectXYMatrix();
            aroundCenter = false;
            break;
    }

    if (matrix) {
        selected.forEach(primitive => {
            applyTransformToPrimitive(primitive, matrix, aroundCenter);
        });

        // Exibe a matriz na interface
        updateMatrixDisplay(matrix, type);

        renderScene();
        showToast(`Transformação "${type}" aplicada!`, 'success');
    }
});

// ── Callback de Clipping ────────────────────────────────────────────────────
ui.setClipCallback((algorithm, clipRect) => {
    const allPrimitives = scene.getAll();
    const linesToClip = allPrimitives.filter(p => p.type === 'line');

    if (linesToClip.length === 0) {
        showToast('Nenhuma reta na cena para recortar!', 'warning');
        return;
    }

    // Salva estado para undo
    history.saveState(scene.getAll());

    const clipFn = algorithm === 'cohen-sutherland' ? cohenSutherland : liangBarsky;
    const toRemove = [];
    const toAdd = [];

    linesToClip.forEach(line => {
        const result = clipFn(
            line.x1, line.y1, line.x2, line.y2,
            clipRect.xmin, clipRect.ymin, clipRect.xmax, clipRect.ymax
        );

        if (result === null) {
            toRemove.push(line.id);
        } else {
            line.x1 = Math.round(result.x0);
            line.y1 = Math.round(result.y0);
            line.x2 = Math.round(result.x1);
            line.y2 = Math.round(result.y1);
        }
    });

    // Recorta arestas de polígonos
    const polygons = allPrimitives.filter(p => p.type === 'polygon');
    polygons.forEach(polygon => {
        const edges = polygon.getEdges();
        const clippedLines = [];

        edges.forEach(edge => {
            const result = clipFn(
                edge.x1, edge.y1, edge.x2, edge.y2,
                clipRect.xmin, clipRect.ymin, clipRect.xmax, clipRect.ymax
            );
            if (result !== null) {
                clippedLines.push(new Line(
                    Math.round(result.x0), Math.round(result.y0),
                    Math.round(result.x1), Math.round(result.y1),
                    'bresenham', '#C084FC'
                ));
            }
        });

        toRemove.push(polygon.id);
        clippedLines.forEach(l => toAdd.push(l));
    });

    toRemove.forEach(id => scene.removeById(id));
    toAdd.forEach(l => scene.add(l));

    const algoName = algorithm === 'cohen-sutherland' ? 'Cohen-Sutherland' : 'Liang-Barsky';
    showToast(`Recorte ${algoName} aplicado!`, 'success');
    renderScene();
});

// ── Undo/Redo Callbacks ─────────────────────────────────────────────────────
ui.setUndoRedoCallbacks(
    () => { // undo
        const restored = history.undo(scene.getAll());
        if (restored) {
            restoreScene(restored);
            showToast('Ação desfeita', 'success');
        } else {
            showToast('Nada para desfazer', 'warning');
        }
    },
    () => { // redo
        const restored = history.redo(scene.getAll());
        if (restored) {
            restoreScene(restored);
            showToast('Ação refeita', 'success');
        } else {
            showToast('Nada para refazer', 'warning');
        }
    }
);

// ── Salvar/Carregar Callbacks ───────────────────────────────────────────────
ui.setSaveLoadCallbacks(
    () => { // save
        const data = scene.getAll().map(p => serializePrimitive(p));
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cena_cg.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Cena salva como cena_cg.json', 'success');
    },
    () => { // load
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    history.saveState(scene.getAll());
                    restoreScene(data);
                    showToast(`Cena carregada: ${data.length} elementos`, 'success');
                } catch (err) {
                    showToast('Erro ao carregar arquivo!', 'error');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }
);

// ── Registra callback de saveState para o UIManager ─────────────────────────
ui.setSaveStateCallback(() => {
    history.saveState(scene.getAll());
});

// ── Zoom e Pan events ───────────────────────────────────────────────────────
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.max(0.3, Math.min(5.0, zoomLevel + delta));
    renderer.setZoom(zoomLevel);
    renderScene();
    updateZoomDisplay();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // botão do meio
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        panStartX = e.clientX;
        panStartY = e.clientY;
        renderer.pan(dx, -dy);
        renderScene();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
});

function updateZoomDisplay() {
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = `${Math.round(zoomLevel * 100)}%`;
}

// ── Reset View ───────────────────────────────────────────────────────────────
document.getElementById('btn-reset-view')?.addEventListener('click', () => {
    zoomLevel = 1.0;
    renderer.setZoom(1.0);
    // Reseta a origem para o centro do canvas
    renderer.originX = Math.floor(renderer.width / 2);
    renderer.originY = Math.floor(renderer.height / 2);
    renderScene();
    updateZoomDisplay();
    showToast('Vista resetada para a origem', 'success');
});


// ──────────────────────────────────────────────────────────────────────────────
// Renderização da Cena
// ──────────────────────────────────────────────────────────────────────────────

function renderScene() {
    // 1. Limpa o buffer
    renderer.clearBuffer();

    // 2. Rasteriza todas as primitivas da cena
    const primitives = scene.getAll();
    const hoveredId = ui.getHoveredPrimitiveId();

    // Separa preenchimentos para renderizar depois dos contornos
    const fills = [];

    primitives.forEach(primitive => {
        if (primitive.type === 'fill') {
            fills.push(primitive);
            return;
        }

        let color;
        if (primitive.selected) {
            color = Renderer.hexToRGBA('#FF4444');
        } else if (primitive.id === hoveredId) {
            color = Renderer.hexToRGBA('#88DDFF'); // hover highlight
        } else {
            color = Renderer.hexToRGBA(primitive.color);
        }

        switch (primitive.type) {
            case 'point':
                drawPointPrimitive(primitive, color);
                break;
            case 'line':
                drawLinePrimitive(primitive, color);
                break;
            case 'circle':
                drawCirclePrimitive(primitive, color);
                break;
            case 'polygon':
                drawPolygonPrimitive(primitive, color);
                break;
        }
    });

    // 3. Executa os algoritmos de preenchimento
    fills.forEach(fill => {
        if (fill.fillType === 'boundary') {
            boundaryFill(fill.x, fill.y, fill.color, fill.targetColor, renderer);
        } else if (fill.fillType === 'flood') {
            floodFill(fill.x, fill.y, fill.color, fill.targetColor, renderer);
        }
    });

    // 4. Desenha grid e eixos por cima do preenchimento para não interferir com o Flood Fill
    renderer.drawGrid();
    renderer.drawAxes();

    // 5. Desenha polígono em construção (preview)
    const polyInProgress = ui.getPolygonInProgress();
    if (polyInProgress.length > 0) {
        const previewColor = Renderer.hexToRGBA('#FFD93D');
        const snapColor = Renderer.hexToRGBA('#00E676');   // verde = pode fechar
        const mouseWorld = ui.getMouseWorld();
        const zoom = renderer.zoom || 1;
        const SNAP_RADIUS = 15 / zoom;

        // Verifica se o mouse está perto do primeiro vértice (snap zone)
        let canSnap = false;
        if (polyInProgress.length >= 3 && mouseWorld) {
            const first = polyInProgress[0];
            const dx = mouseWorld.x - first.x;
            const dy = mouseWorld.y - first.y;
            canSnap = Math.sqrt(dx * dx + dy * dy) <= SNAP_RADIUS;
        }

        // Desenha as arestas já definidas
        for (let i = 0; i < polyInProgress.length - 1; i++) {
            const p1 = renderer.worldToScreen(polyInProgress[i].x, polyInProgress[i].y);
            const p2 = renderer.worldToScreen(polyInProgress[i + 1].x, polyInProgress[i + 1].y);
            const pixels = rasterizeBresenham(p1.x, p1.y, p2.x, p2.y);
            pixels.forEach(px => renderer.setPixelScreen(px.x, px.y, previewColor));
        }

        // Desenha os vértices
        polyInProgress.forEach((v, i) => {
            const p = renderer.worldToScreen(v.x, v.y);
            const col = (i === 0 && polyInProgress.length >= 3) ? snapColor : previewColor;
            drawCrossScreen(Math.round(p.x), Math.round(p.y), col);
        });

        // Rubber-band: linha do último vértice até o mouse
        if (mouseWorld) {
            const last = polyInProgress[polyInProgress.length - 1];
            const target = canSnap ? polyInProgress[0] : mouseWorld;
            const p1 = renderer.worldToScreen(last.x, last.y);
            const p2 = renderer.worldToScreen(target.x, target.y);
            // Renderiza a rubber-band como overlay (após putImageData)
            renderer._rubberBandPoly = { p1, p2, canSnap };

            // Se pode fechar, mostra também a aresta de fechamento (primeiro→mouse)
            if (canSnap && polyInProgress.length >= 3) {
                const pFirst = renderer.worldToScreen(polyInProgress[0].x, polyInProgress[0].y);
                renderer._rubberBandPolyClose = { pFirst, p2 };
            } else {
                renderer._rubberBandPolyClose = null;
            }
        }
    } else {
        renderer._rubberBandPoly = null;
        renderer._rubberBandPolyClose = null;
    }

    // 5. Renderiza o buffer no canvas
    renderer.renderToCanvas();

    // 6. Desenha overlays (após putImageData, usando Canvas 2D API)

    // Rubber-band para reta/circunferência
    const tempDrawing = ui.getTempDrawing();
    if (tempDrawing) {
        if (tempDrawing.mode === Mode.DRAW_LINE_DDA ||
            tempDrawing.mode === Mode.DRAW_LINE_BRESENHAM) {
            drawRubberBandLine(tempDrawing.start, tempDrawing.end);
        } else if (tempDrawing.mode === Mode.DRAW_CIRCLE) {
            drawRubberBandCircle(tempDrawing.start, tempDrawing.end);
        } else if (tempDrawing.mode === Mode.CLIP_CS || tempDrawing.mode === Mode.CLIP_LB) {
            renderer.drawDashedRect(
                tempDrawing.start.x, tempDrawing.start.y,
                tempDrawing.end.x, tempDrawing.end.y,
                '#FF6B35'
            );
        }
    }

    // Rubber-band do polígono em construção
    if (renderer._rubberBandPoly) {
        const { p1, p2, canSnap } = renderer._rubberBandPoly;
        const ctx = renderer.ctx;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = canSnap ? 'rgba(0, 230, 118, 0.9)' : 'rgba(255, 217, 61, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Destaque no primeiro vértice quando pode fechar
        if (canSnap && renderer._rubberBandPolyClose) {
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(0, 230, 118, 1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(renderer._rubberBandPolyClose.pFirst.x, renderer._rubberBandPolyClose.pFirst.y, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 230, 118, 0.25)';
            ctx.fill();
        }
        ctx.restore();
    }

    // Caixa de seleção
    const tempSel = ui.getTempSelection();
    if (tempSel) {
        renderer.drawDashedRect(
            tempSel.start.x, tempSel.start.y,
            tempSel.end.x, tempSel.end.y,
            '#4FC3F7'
        );
    }

    // Janela de recorte persistente
    const clipRect = ui.getClipRect();
    if (clipRect) {
        renderer.drawDashedRect(
            clipRect.xmin, clipRect.ymin,
            clipRect.xmax, clipRect.ymax,
            '#FF6B35', [4, 4]
        );
    }

    // Labels dos eixos
    renderer.drawAxisLabels();

    // 7. Labels de vértices nos elementos selecionados
    drawVertexLabels();
}

// ──────────────────────────────────────────────────────────────────────────────
// Funções de Rasterização de Primitivas
// ──────────────────────────────────────────────────────────────────────────────

function drawCrossScreen(sx, sy, color) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            renderer.setPixelScreen(sx + dx, sy + dy, color);
        }
    }
}

function drawPointPrimitive(point, color) {
    const p = renderer.worldToScreen(point.x, point.y);
    drawCrossScreen(Math.round(p.x), Math.round(p.y), color);
}

function drawLinePrimitive(line, color) {
    const p1 = renderer.worldToScreen(line.x1, line.y1);
    const p2 = renderer.worldToScreen(line.x2, line.y2);
    const pixels = line.algorithm === 'dda'
        ? rasterizeDDA(p1.x, p1.y, p2.x, p2.y)
        : rasterizeBresenham(p1.x, p1.y, p2.x, p2.y);
    pixels.forEach(px => renderer.setPixelScreen(px.x, px.y, color));
}

function drawCirclePrimitive(circle, color) {
    const p = renderer.worldToScreen(circle.cx, circle.cy);
    const radius = Math.round(circle.radius * renderer.zoom);
    const pixels = rasterizeCircle(p.x, p.y, radius);
    pixels.forEach(px => renderer.setPixelScreen(px.x, px.y, color));
}

function drawPolygonPrimitive(polygon, color) {
    polygon.getEdges().forEach(edge => {
        const p1 = renderer.worldToScreen(edge.x1, edge.y1);
        const p2 = renderer.worldToScreen(edge.x2, edge.y2);
        const pixels = rasterizeBresenham(p1.x, p1.y, p2.x, p2.y);
        pixels.forEach(px => renderer.setPixelScreen(px.x, px.y, color));
        // Garante pixel exato nos endpoints para fechar buracos nas junções
        renderer.setPixelScreen(Math.round(p1.x), Math.round(p1.y), color);
        renderer.setPixelScreen(Math.round(p2.x), Math.round(p2.y), color);
    });
    // Pinta os vértices por cima (3x3) para garantir fechamento visual
    polygon.vertices.forEach(v => {
        const p = renderer.worldToScreen(v.x, v.y);
        drawCrossScreen(Math.round(p.x), Math.round(p.y), color);
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Labels de Vértices (exibe coordenadas nos elementos selecionados)
// ──────────────────────────────────────────────────────────────────────────────

function drawVertexLabels() {
    const selected = scene.getSelected();
    if (selected.length === 0) return;

    selected.forEach(p => {
        const vertices = p.getVertices();
        vertices.forEach((v, i) => {
            const screen = renderer.worldToScreen(Math.round(v.x), Math.round(v.y));
            const label = `(${Math.round(v.x)}, ${Math.round(v.y)})`;
            renderer.drawText(label, screen.x + 6, screen.y - 6, '#FF8888', '10px JetBrains Mono, monospace');
        });

        // Para circunferências, mostra o raio
        if (p.type === 'circle') {
            const screen = renderer.worldToScreen(Math.round(p.cx), Math.round(p.cy));
            renderer.drawText(`r=${Math.round(p.radius)}`, screen.x + 6, screen.y + 16, '#FF8888', '10px JetBrains Mono, monospace');
        }
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Exibição da Matriz de Transformação
// ──────────────────────────────────────────────────────────────────────────────

function updateMatrixDisplay(matrix, type) {
    const el = document.getElementById('matrix-display');
    if (!el) return;

    const names = {
        translate: 'Translação', rotate: 'Rotação', scale: 'Escala',
        reflectX: 'Reflexão X', reflectY: 'Reflexão Y', reflectXY: 'Reflexão XY'
    };

    const rows = matrix.map(row =>
        '│ ' + row.map(v => {
            const s = v.toFixed(2);
            return s.padStart(7);
        }).join('  ') + ' │'
    );

    el.innerHTML = `<span class="matrix-title">${names[type] || type}</span>\n` +
        `<span class="matrix-bracket">┌${'─'.repeat(29)}┐</span>\n` +
        rows.join('\n') + '\n' +
        `<span class="matrix-bracket">└${'─'.repeat(29)}┘</span>`;
    el.classList.add('show');

    // Auto-hide após 5 segundos
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove('show'), 5000);
}

// ──────────────────────────────────────────────────────────────────────────────
// Rubber-band Overlays
// ──────────────────────────────────────────────────────────────────────────────

function drawRubberBandLine(start, end) {
    const ctx = renderer.ctx;
    const p1 = renderer.worldToScreen(start.x, start.y);
    const p2 = renderer.worldToScreen(end.x, end.y);

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(0, 191, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
}

function drawRubberBandCircle(start, end) {
    const ctx = renderer.ctx;
    const center = renderer.worldToScreen(start.x, start.y);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 107, 157, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────────────
// Serialização / Restauração de Cena
// ──────────────────────────────────────────────────────────────────────────────

function serializePrimitive(p) {
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
        case 'fill':
            return { ...base, x: p.x, y: p.y, fillType: p.fillType, targetColor: p.targetColor };
        default:
            return base;
    }
}

function restoreScene(dataArray) {
    scene.clear();
    dataArray.forEach(d => {
        let prim;
        switch (d.type) {
            case 'point':
                prim = new Point(d.x, d.y, d.color);
                break;
            case 'line':
                prim = new Line(d.x1, d.y1, d.x2, d.y2, d.algorithm || 'bresenham', d.color);
                break;
            case 'circle':
                prim = new Circle(d.cx, d.cy, d.radius, d.color);
                break;
            case 'polygon':
                prim = new Polygon(d.vertices || [], d.color);
                break;
            case 'fill':
                prim = new Fill(d.x, d.y, d.fillType, d.color, d.targetColor);
                break;
        }
        if (prim) {
            prim.selected = d.selected || false;
            scene.add(prim);
        }
    });
    renderScene();
}

// ──────────────────────────────────────────────────────────────────────────────
// Toast de Notificação
// ──────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => { toast.classList.add('show'); });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ──────────────────────────────────────────────────────────────────────────────
// Inicialização Final
// ──────────────────────────────────────────────────────────────────────────────

resizeCanvas();
renderScene();

console.log('🎨 Sistema Gráfico 2D v2 inicializado com sucesso!');
console.log('Melhorias: undo/redo, color picker, salvar/carregar, zoom/pan, labels, matriz, hover');
