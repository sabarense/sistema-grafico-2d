/**
 * ============================================================================
 * filling.js — Algoritmos de Preenchimento
 * ============================================================================
 *
 * Implementa algoritmos de preenchimento (Boundary Fill e Flood Fill) 
 * utilizando conectividade-4.
 *
 * Para evitar problemas de limite de recursão (stack overflow), 
 * os algoritmos foram implementados iterativamente com o uso de uma pilha explícita.
 */

import { Renderer } from './renderer.js';

/**
 * Função utilitária para verificar se duas cores (RGBA) são iguais.
 */
function colorsMatch(c1, c2) {
    if (!c1 || !c2) return false;
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];
}

/**
 * Preenchimento por Fronteira (Boundary Fill) usando Pilha
 * 
 * @param {number} startX - Coordenada X inicial (mundo)
 * @param {number} startY - Coordenada Y inicial (mundo)
 * @param {string} fillColorHex - Cor de preenchimento em Hex
 * @param {string} boundaryColorHex - Cor da fronteira (contorno) em Hex
 * @param {Renderer} renderer - O renderizador
 */
function boundaryFill(startX, startY, fillColorHex, boundaryColorHex, renderer) {
    const p = renderer.worldToScreen(startX, startY);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    
    const fillColor = Renderer.hexToRGBA(fillColorHex);
    const boundaryColor = Renderer.hexToRGBA(boundaryColorHex);

    // Cor inicial do pixel clicado
    const startPixelColor = renderer.getPixelScreen(x, y);

    // Se o ponto inicial já é a cor de contorno ou a de preenchimento, não faz nada
    if (!startPixelColor || colorsMatch(startPixelColor, boundaryColor) || colorsMatch(startPixelColor, fillColor)) {
        return;
    }

    // Pilha armazena coordenadas da tela
    const stack = [{ x, y }];

    while (stack.length > 0) {
        const pt = stack.pop();
        const px = pt.x;
        const py = pt.y;

        const currentColor = renderer.getPixelScreen(px, py);
        
        // Verifica se está dentro do canvas e se não é fronteira nem já preenchido
        if (currentColor && !colorsMatch(currentColor, boundaryColor) && !colorsMatch(currentColor, fillColor)) {
            renderer.setPixelScreen(px, py, fillColor);

            // Adiciona vizinhos (Conectividade-4)
            stack.push({ x: px + 1, y: py });
            stack.push({ x: px - 1, y: py });
            stack.push({ x: px, y: py + 1 });
            stack.push({ x: px, y: py - 1 });
        }
    }
}

/**
 * Preenchimento por Inundação (Flood Fill) usando Pilha
 * 
 * @param {number} startX - Coordenada X inicial (mundo)
 * @param {number} startY - Coordenada Y inicial (mundo)
 * @param {string} fillColorHex - Nova cor em Hex
 * @param {string} oldColorHex - Cor antiga a ser substituída em Hex
 * @param {Renderer} renderer - O renderizador
 */
function floodFill(startX, startY, fillColorHex, oldColorHex, renderer) {
    const p = renderer.worldToScreen(startX, startY);
    const x = Math.round(p.x);
    const y = Math.round(p.y);

    const fillColor = Renderer.hexToRGBA(fillColorHex);
    const oldColor = Renderer.hexToRGBA(oldColorHex);

    // Se a cor antiga for igual à nova, não faz nada (evita loop infinito)
    if (colorsMatch(oldColor, fillColor)) {
        return;
    }

    const startPixelColor = renderer.getPixelScreen(x, y);
    if (!startPixelColor || !colorsMatch(startPixelColor, oldColor)) {
        return;
    }

    const stack = [{ x, y }];

    while (stack.length > 0) {
        const pt = stack.pop();
        const px = pt.x;
        const py = pt.y;

        const currentColor = renderer.getPixelScreen(px, py);
        
        if (currentColor && colorsMatch(currentColor, oldColor)) {
            renderer.setPixelScreen(px, py, fillColor);

            // Adiciona vizinhos (Conectividade-4)
            stack.push({ x: px + 1, y: py });
            stack.push({ x: px - 1, y: py });
            stack.push({ x: px, y: py + 1 });
            stack.push({ x: px, y: py - 1 });
        }
    }
}

export { boundaryFill, floodFill };
