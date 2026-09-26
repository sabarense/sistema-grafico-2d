/**
 * ============================================================================
 * renderer.js — Renderizador de Pixel Buffer
 * ============================================================================
 *
 * Camada de abstração sobre o HTML5 Canvas para manipulação direta de pixels.
 * O renderer mantém um buffer de pixels (ImageData) que é escrito pixel a pixel
 * e depois copiado para o Canvas.
 *
 * Também gerencia o sistema de coordenadas com origin no centro do canvas,
 * eixo Y apontando para cima (padrão matemático), grid e eixos de referência.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Classe: Renderer
// ──────────────────────────────────────────────────────────────────────────────

class Renderer {
    /**
     * Inicializa o renderer com um elemento Canvas.
     * @param {HTMLCanvasElement} canvas - Elemento Canvas do DOM
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Buffer de pixels — ImageData de dimensão width × height
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.pixelBuffer = this.imageData.data; // Uint8ClampedArray [R,G,B,A, ...]

        // Sistema de coordenadas: origin no centro, Y para cima
        this.originX = Math.floor(this.width / 2);
        this.originY = Math.floor(this.height / 2);
        this.zoom = 1.0;

        // Configurações visuais
        this.showGrid = true;
        this.showAxes = true;
        this.gridSpacing = 20;        // pixels entre linhas do grid
        this.backgroundColor = [18, 18, 24, 255]; // fundo escuro
        this.gridColor = [40, 40, 55, 255];       // grid sutil
        this.axisColor = [80, 80, 110, 255];      // eixos mais visíveis
    }

    // ──────────────────────────────────────────────────────────────────────
    // Conversão de Coordenadas
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Converte coordenadas do mundo (origin centro, Y para cima)
     * para coordenadas do canvas (origin top-left, Y para baixo).
     *
     * @param {number} wx - Coordenada X do mundo
     * @param {number} wy - Coordenada Y do mundo
     * @returns {{x: number, y: number}} Coordenadas do canvas
     */
    worldToScreen(wx, wy) {
        return {
            x: this.originX + Math.round(wx * this.zoom),
            y: this.originY - Math.round(wy * this.zoom)
        };
    }

    /**
     * Converte coordenadas do canvas para coordenadas do mundo.
     *
     * @param {number} sx - Coordenada X do canvas (screen)
     * @param {number} sy - Coordenada Y do canvas (screen)
     * @returns {{x: number, y: number}} Coordenadas do mundo
     */
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.originX) / this.zoom,
            y: (this.originY - sy) / this.zoom
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // Manipulação de Pixels
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Define a cor de um pixel no buffer, nas coordenadas do MUNDO.
     * Ignora silenciosamente pixels fora dos limites do canvas.
     *
     * @param {number} wx - Coordenada X do mundo
     * @param {number} wy - Coordenada Y do mundo
     * @param {number[]} color - Cor como [R, G, B, A]
     */
    setPixel(wx, wy, color) {
        const { x, y } = this.worldToScreen(wx, wy);

        // Verifica limites
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        const index = (y * this.width + x) * 4;
        this.pixelBuffer[index]     = color[0]; // R
        this.pixelBuffer[index + 1] = color[1]; // G
        this.pixelBuffer[index + 2] = color[2]; // B
        this.pixelBuffer[index + 3] = color[3]; // A
    }

    /**
     * Retorna a cor de um pixel nas coordenadas do MUNDO.
     * @param {number} wx - Coordenada X do mundo
     * @param {number} wy - Coordenada Y do mundo
     * @returns {number[]|null} Cor como [R, G, B, A] ou null se fora
     */
    getPixelWorld(wx, wy) {
        const { x, y } = this.worldToScreen(wx, wy);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;

        const index = (y * this.width + x) * 4;
        return [
            this.pixelBuffer[index],
            this.pixelBuffer[index + 1],
            this.pixelBuffer[index + 2],
            this.pixelBuffer[index + 3]
        ];
    }

    /**
     * Define a cor de um pixel no buffer, nas coordenadas da TELA (screen).
     *
     * @param {number} sx - Coordenada X do canvas
     * @param {number} sy - Coordenada Y do canvas
     * @param {number[]} color - Cor como [R, G, B, A]
     */
    setPixelScreen(sx, sy, color) {
        const x = Math.round(sx);
        const y = Math.round(sy);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        const index = (y * this.width + x) * 4;
        this.pixelBuffer[index]     = color[0];
        this.pixelBuffer[index + 1] = color[1];
        this.pixelBuffer[index + 2] = color[2];
        this.pixelBuffer[index + 3] = color[3];
    }

    /**
     * Retorna a cor de um pixel nas coordenadas da TELA.
     */
    getPixelScreen(sx, sy) {
        const x = Math.round(sx);
        const y = Math.round(sy);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;

        const index = (y * this.width + x) * 4;
        return [
            this.pixelBuffer[index],
            this.pixelBuffer[index + 1],
            this.pixelBuffer[index + 2],
            this.pixelBuffer[index + 3]
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Limpeza e Renderização
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Limpa o buffer de pixels, preenchendo com a cor de fundo.
     */
    clearBuffer() {
        const [r, g, b, a] = this.backgroundColor;
        for (let i = 0; i < this.pixelBuffer.length; i += 4) {
            this.pixelBuffer[i]     = r;
            this.pixelBuffer[i + 1] = g;
            this.pixelBuffer[i + 2] = b;
            this.pixelBuffer[i + 3] = a;
        }
    }

    /**
     * Desenha o grid de referência diretamente no buffer de pixels.
     */
    drawGrid() {
        if (!this.showGrid) return;

        const color = this.gridColor;

        // Linhas verticais
        const scaledSpacing = Math.max(10, Math.round(this.gridSpacing * this.zoom));
        const offsetX = this.originX % scaledSpacing;
        const offsetY = this.originY % scaledSpacing;

        for (let sx = offsetX; sx < this.width; sx += scaledSpacing) {
            for (let sy = 0; sy < this.height; sy++) {
                this.setPixelScreen(sx, sy, color);
            }
        }

        // Linhas horizontais
        for (let sy = offsetY; sy < this.height; sy += scaledSpacing) {
            for (let sx = 0; sx < this.width; sx++) {
                this.setPixelScreen(sx, sy, color);
            }
        }
    }

    /**
     * Desenha os eixos X e Y de referência no buffer.
     */
    drawAxes() {
        if (!this.showAxes) return;

        const color = this.axisColor;

        // Eixo X (horizontal passando pela origin)
        for (let sx = 0; sx < this.width; sx++) {
            this.setPixelScreen(sx, this.originY, color);
        }

        // Eixo Y (vertical passando pela origin)
        for (let sy = 0; sy < this.height; sy++) {
            this.setPixelScreen(this.originX, sy, color);
        }
    }

    /**
     * Copia o buffer de pixels para o Canvas (exibe na tela).
     */
    renderToCanvas() {
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Desenho de Overlays (usando Canvas 2D API para textos e linhas finas)
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Desenha um retângulo tracejado (overlay) usando a Canvas 2D API.
     * Usado para a caixa de seleção e a janela de recorte.
     *
     * @param {number} wx1 - X do mundo (canto 1)
     * @param {number} wy1 - Y do mundo (canto 1)
     * @param {number} wx2 - X do mundo (canto 2)
     * @param {number} wy2 - Y do mundo (canto 2)
     * @param {string} strokeColor - Cor da borda (CSS)
     * @param {number[]} [dashPattern=[6, 4]] - Padrão de tracejado
     */
    drawDashedRect(wx1, wy1, wx2, wy2, strokeColor, dashPattern = [6, 4]) {
        const p1 = this.worldToScreen(wx1, wy1);
        const p2 = this.worldToScreen(wx2, wy2);

        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        this.ctx.save();
        this.ctx.setLineDash(dashPattern);
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(x, y, w, h);
        this.ctx.restore();
    }

    /**
     * Desenha texto no Canvas (overlay).
     *
     * @param {string} text - Texto a exibir
     * @param {number} sx - Coordenada X da tela
     * @param {number} sy - Coordenada Y da tela
     * @param {string} [color='#aaa'] - Cor do texto
     * @param {string} [font='11px monospace'] - Fonte
     */
    drawText(text, sx, sy, color = '#aaa', font = '11px monospace') {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.fillText(text, sx, sy);
        this.ctx.restore();
    }

    /**
     * Desenha as coordenadas de referência nos eixos.
     */
    drawAxisLabels() {
        if (!this.showAxes) return;

        const color = '#667';
        const font = '10px monospace';

        // Marcações no eixo X
        const scaledSpacing = this.gridSpacing * 5;
        const startX = -Math.floor(this.originX / (scaledSpacing * this.zoom)) * scaledSpacing;
        
        for (let wx = startX; wx < (this.width - this.originX) / this.zoom; wx += scaledSpacing) {
            if (wx === 0) continue;
            const { x, y } = this.worldToScreen(wx, 0);
            this.drawText(wx.toString(), x - 8, y + 14, color, font);
        }

        // Marcações no eixo Y
        const startY = -Math.floor((this.height - this.originY) / (scaledSpacing * this.zoom)) * scaledSpacing;
        
        for (let wy = startY; wy < this.originY / this.zoom; wy += scaledSpacing) {
            if (wy === 0) continue;
            const { x, y } = this.worldToScreen(0, wy);
            this.drawText(wy.toString(), x + 5, y + 4, color, font);
        }

        // Label da origem
        const orig = this.worldToScreen(0, 0);
        this.drawText('0', orig.x + 4, orig.y + 14, '#889', font);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Utilitários
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Converte uma cor hexadecimal CSS para array [R, G, B, A].
     *
     * @param {string} hex - Cor em hexadecimal (ex: '#FF6B9D')
     * @returns {number[]} Array [R, G, B, 255]
     */
    static hexToRGBA(hex) {
        const cleaned = hex.replace('#', '');
        const r = parseInt(cleaned.substring(0, 2), 16);
        const g = parseInt(cleaned.substring(2, 4), 16);
        const b = parseInt(cleaned.substring(4, 6), 16);
        return [r, g, b, 255];
    }

    /**
     * Converte [R, G, B, A] para cor hexadecimal.
     * @param {number[]} rgba - Array [R, G, B, A]
     * @returns {string} Cor em hexadecimal
     */
    static rgbaToHex(rgba) {
        if (!rgba) return '#000000';
        const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}`;
    }

    /**
     * Redimensiona o canvas e recria o buffer.
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.pixelBuffer = this.imageData.data;
        this.originX = Math.floor(this.width / 2);
        this.originY = Math.floor(this.height / 2);
    }
    /**
     * Define o nível de zoom (afeta a conversão world/screen).
     * @param {number} level - Nível de zoom (1.0 = 100%)
     */
    setZoom(level) {
        this.zoom = level;
    }

    /**
     * Desloca a origem do sistema de coordenadas (pan).
     * @param {number} dx - Deslocamento em X (pixels da tela)
     * @param {number} dy - Deslocamento em Y (pixels do mundo, já com Y invertido)
     */
    pan(dx, dy) {
        this.originX += dx;
        this.originY -= dy;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exportações
// ──────────────────────────────────────────────────────────────────────────────
export { Renderer };
