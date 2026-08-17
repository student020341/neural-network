/**
 * BrainVisualizer - Picture-in-Picture Real-Time Multi-Brain HUD
 * 
 * Supports rendering multiple DenseNetworks and SparseNetworks stacked vertically.
 * Dynamically sizes cards and margins based on node counts and label text lengths to prevent overlaps.
 * Uses provider closures: visualizer.track("Label", entity, (e) => e.brain)
 */
class BrainVisualizer {
    /**
     * @param {Object} [options]
     * @param {number} [options.width=460] Default HUD width
     * @param {number} [options.height=340] Default HUD height
     * @param {boolean} [options.autoLoop=true] Automatically animate via requestAnimationFrame
     */
    constructor(options = {}) {
        this.width = options.width || 460;
        this.height = options.height || 340;
        this.minWeightThreshold = 0.05;
        this.isOpen = true;
        this.pipWindow = null;

        // Registry of tracked brain providers: [{ label, entity, accessor }]
        this.providers = [];

        // Camera Pan & Zoom state
        this.panX = 24;
        this.panY = 24;
        this.zoom = 1.0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this._createDOM();
        this._setupEvents();

        if (options.autoLoop !== false) {
            this._startLoop();
        }
    }

    _createDOM() {
        if (!document.getElementById("brain-viz-styles")) {
            const style = document.createElement("style");
            style.id = "brain-viz-styles";
            style.textContent = `
                .brain-viz-container {
                    position: fixed;
                    top: 16px;
                    right: 16px;
                    width: ${this.width}px;
                    height: ${this.height}px;
                    background: rgba(13, 17, 23, 0.94);
                    backdrop-filter: blur(10px);
                    border: 1px solid #30363d;
                    border-radius: 8px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                    display: flex;
                    flex-direction: column;
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    overflow: hidden;
                    min-width: 300px;
                    min-height: 200px;
                }
                .brain-viz-header {
                    padding: 8px 12px;
                    background: rgba(22, 27, 34, 0.95);
                    border-bottom: 1px solid #30363d;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    user-select: none;
                    cursor: move;
                    touch-action: none;
                }
                .brain-viz-title {
                    color: #58a6ff;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .brain-viz-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .brain-viz-btn {
                    background: #21262d;
                    border: 1px solid #30363d;
                    color: #c9d1d9;
                    border-radius: 4px;
                    padding: 2px 7px;
                    font-size: 12px;
                    cursor: pointer;
                    line-height: 1.2;
                    transition: background 0.15s, color 0.15s;
                }
                .brain-viz-btn:hover {
                    background: #30363d;
                    color: #fff;
                }
                .brain-viz-close-btn:hover {
                    background: #da3633;
                    border-color: #f85149;
                    color: #fff;
                }
                .brain-viz-slider-box {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #8b949e;
                    font-size: 11px;
                }
                .brain-viz-slider-box input {
                    width: 45px;
                    cursor: pointer;
                }
                .brain-viz-body {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    background: #090d13;
                }
                .brain-viz-canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    cursor: grab;
                    touch-action: none;
                }
                .brain-viz-canvas:active {
                    cursor: grabbing;
                }
                .brain-viz-resize-bl, .brain-viz-resize-br {
                    position: absolute;
                    bottom: 0;
                    width: 18px;
                    height: 18px;
                    z-index: 20;
                    touch-action: none;
                }
                .brain-viz-resize-bl {
                    left: 0;
                    cursor: nesw-resize;
                }
                .brain-viz-resize-bl::after {
                    content: '';
                    position: absolute;
                    bottom: 4px;
                    left: 4px;
                    width: 8px;
                    height: 8px;
                    border-bottom: 2px solid #8b949e;
                    border-left: 2px solid #8b949e;
                    border-bottom-left-radius: 2px;
                    transition: border-color 0.15s;
                }
                .brain-viz-resize-br {
                    right: 0;
                    cursor: nwse-resize;
                }
                .brain-viz-resize-br::after {
                    content: '';
                    position: absolute;
                    bottom: 4px;
                    right: 4px;
                    width: 8px;
                    height: 8px;
                    border-bottom: 2px solid #8b949e;
                    border-right: 2px solid #8b949e;
                    border-bottom-right-radius: 2px;
                    transition: border-color 0.15s;
                }
                .brain-viz-resize-bl:hover::after, .brain-viz-resize-br:hover::after {
                    border-color: #58a6ff;
                }
            `;
            document.head.appendChild(style);
        }

        this.container = document.createElement("div");
        this.container.className = "brain-viz-container";
        this.container.innerHTML = `
            <div class="brain-viz-header" id="brain-viz-drag">
                <div class="brain-viz-title" id="brain-viz-name">🧠 Neural Telemetry</div>
                <div class="brain-viz-controls">
                    <div class="brain-viz-slider-box" title="Hide faint connections below threshold">
                        <span>Filter:</span>
                        <input type="range" id="brain-viz-thresh" min="0" max="0.5" step="0.05" value="0.05" />
                    </div>
                    <button class="brain-viz-btn" id="brain-viz-popout" title="Pop Out Window">⧉</button>
                    <button class="brain-viz-btn" id="brain-viz-reset" title="Center / Frame View">⌖</button>
                    <button class="brain-viz-btn brain-viz-close-btn" id="brain-viz-close" title="Close (Re-opens on selecting creature)">✕</button>
                </div>
            </div>
            <div class="brain-viz-body">
                <canvas class="brain-viz-canvas" id="brain-viz-cvs"></canvas>
                <div class="brain-viz-resize-bl" id="brain-viz-resize-bl" title="Resize Bottom-Left"></div>
                <div class="brain-viz-resize-br" id="brain-viz-resize-br" title="Resize Bottom-Right"></div>
            </div>
        `;
        document.body.appendChild(this.container);

        this.canvas = this.container.querySelector("#brain-viz-cvs");
        this.ctx = this.canvas.getContext("2d");
        this.titleEl = this.container.querySelector("#brain-viz-name");
    }

    _setupEvents() {
        const header = this.container.querySelector("#brain-viz-drag");
        const closeBtn = this.container.querySelector("#brain-viz-close");
        const resetBtn = this.container.querySelector("#brain-viz-reset");
        const popoutBtn = this.container.querySelector("#brain-viz-popout");
        const threshSlider = this.container.querySelector("#brain-viz-thresh");
        const resizeBl = this.container.querySelector("#brain-viz-resize-bl");
        const resizeBr = this.container.querySelector("#brain-viz-resize-br");

        // Bottom-Left Resize Handle (Top-Right Anchor Locked)
        let isResizingBl = false;
        let blStartX = 0, blStartY = 0, blStartW = 0, blStartH = 0, blStartLeft = 0;

        resizeBl.addEventListener("pointerdown", (e) => {
            if (this.pipWindow) return;
            isResizingBl = true;
            blStartX = e.clientX;
            blStartY = e.clientY;
            blStartW = this.container.offsetWidth;
            blStartH = this.container.offsetHeight;
            blStartLeft = this.container.getBoundingClientRect().left;
            resizeBl.setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
        });

        resizeBl.addEventListener("pointermove", (e) => {
            if (isResizingBl) {
                const deltaX = blStartX - e.clientX;
                const deltaY = e.clientY - blStartY;
                const newW = Math.max(280, blStartW + deltaX);
                const newH = Math.max(180, blStartH + deltaY);
                const actualDeltaX = newW - blStartW;

                this.container.style.width = `${newW}px`;
                this.container.style.height = `${newH}px`;
                this.container.style.left = `${blStartLeft - actualDeltaX}px`;
                this.container.style.right = "auto";
            }
        });

        resizeBl.addEventListener("pointerup", (e) => {
            isResizingBl = false;
            try { resizeBl.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        resizeBl.addEventListener("pointercancel", () => {
            isResizingBl = false;
        });

        // Bottom-Right Resize Handle (Top-Left Anchor Locked)
        let isResizingBr = false;
        let brStartX = 0, brStartY = 0, brStartW = 0, brStartH = 0, brStartLeft = 0;

        resizeBr.addEventListener("pointerdown", (e) => {
            if (this.pipWindow) return;
            isResizingBr = true;
            brStartX = e.clientX;
            brStartY = e.clientY;
            brStartW = this.container.offsetWidth;
            brStartH = this.container.offsetHeight;
            brStartLeft = this.container.getBoundingClientRect().left;
            resizeBr.setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
        });

        resizeBr.addEventListener("pointermove", (e) => {
            if (isResizingBr) {
                const deltaX = e.clientX - brStartX;
                const deltaY = e.clientY - brStartY;
                const newW = Math.max(280, brStartW + deltaX);
                const newH = Math.max(180, brStartH + deltaY);

                this.container.style.width = `${newW}px`;
                this.container.style.height = `${newH}px`;
                this.container.style.left = `${brStartLeft}px`;
                this.container.style.right = "auto";
            }
        });

        resizeBr.addEventListener("pointerup", (e) => {
            isResizingBr = false;
            try { resizeBr.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        resizeBr.addEventListener("pointercancel", () => {
            isResizingBr = false;
        });

        // Window drag repositioning
        let isWindowDragging = false;
        let winOffsetX = 0, winOffsetY = 0;

        header.addEventListener("pointerdown", (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || this.pipWindow) return;
            isWindowDragging = true;
            winOffsetX = e.clientX - this.container.offsetLeft;
            winOffsetY = e.clientY - this.container.offsetTop;
            header.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        header.addEventListener("pointermove", (e) => {
            if (isWindowDragging && !this.pipWindow) {
                this.container.style.left = `${Math.max(10, e.clientX - winOffsetX)}px`;
                this.container.style.top = `${Math.max(10, e.clientY - winOffsetY)}px`;
                this.container.style.right = "auto";
            }
        });

        header.addEventListener("pointerup", (e) => {
            isWindowDragging = false;
            try { header.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        // Threshold slider
        threshSlider.addEventListener("input", (e) => {
            this.minWeightThreshold = parseFloat(e.target.value);
        });

        // Pop-Out Window toggle
        popoutBtn.addEventListener("click", () => {
            this.togglePopout();
        });

        // Close / Dismiss button
        closeBtn.addEventListener("click", () => {
            this.close();
        });

        // Reset Camera View
        resetBtn.addEventListener("click", () => {
            this.resetView();
        });

        // Canvas Pan with Pointer Capture
        this.canvas.addEventListener("pointerdown", (e) => {
            this.isDragging = true;
            this.dragStartX = e.clientX - this.panX;
            this.dragStartY = e.clientY - this.panY;
            this.canvas.setPointerCapture(e.pointerId);
        });

        this.canvas.addEventListener("pointermove", (e) => {
            if (this.isDragging) {
                this.panX = e.clientX - this.dragStartX;
                this.panY = e.clientY - this.dragStartY;
            }
        });

        this.canvas.addEventListener("pointerup", (e) => {
            this.isDragging = false;
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        this.canvas.addEventListener("pointercancel", () => {
            this.isDragging = false;
        });

        // Canvas Zoom on Wheel
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
            const newZoom = Math.max(0.15, Math.min(4.0, this.zoom * zoomFactor));

            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
            this.zoom = newZoom;
        }, { passive: false });

        // Double click to reset
        this.canvas.addEventListener("dblclick", () => this.resetView());
    }

    /**
     * Track a brain provider closure.
     * @param {string} label Human-readable label for the brain/creature
     * @param {Object} entity Host creature/agent object
     * @param {function(Object): (DenseNetwork|SparseNetwork)} accessor Function to retrieve the brain from the entity
     */
    track(label, entity, accessor) {
        this.untrack(label);

        this.providers.push({
            label: label || "Brain",
            entity,
            accessor: typeof accessor === 'function' ? accessor : (e) => e?.brain || e
        });

        this._updateTitle();

        if (!this.isOpen) {
            this.isOpen = true;
            this.container.style.display = "flex";
        }
    }

    /**
     * Stop tracking a specific brain by label.
     * @param {string} label
     */
    untrack(label) {
        this.providers = this.providers.filter(p => p.label !== label);
        this._updateTitle();
    }

    /**
     * Clear all tracked brain providers.
     */
    clear() {
        this.providers = [];
        this._updateTitle();
    }

    /**
     * Single-brain convenience inspector: clears previous tracks and tracks this single brain.
     * @param {string} label
     * @param {Object} entity
     * @param {function(Object): (DenseNetwork|SparseNetwork)} [accessor]
     */
    inspect(label, entity, accessor) {
        this.clear();
        this.track(label, entity, accessor);
    }

    _updateTitle() {
        if (!this.titleEl) return;
        if (this.providers.length === 0) {
            this.titleEl.textContent = `🧠 No Targets`;
        } else if (this.providers.length === 1) {
            this.titleEl.textContent = `🧠 ${this.providers[0].label}`;
        } else {
            this.titleEl.textContent = `🧠 Telemetry (${this.providers.length} Brains)`;
        }
    }

    close() {
        this.isOpen = false;
        if (this.pipWindow) {
            this.pipWindow.close();
            this.pipWindow = null;
        }
        this.container.style.display = "none";
    }

    async togglePopout() {
        if (this.pipWindow) {
            this.pipWindow.close();
            this.pipWindow = null;
            return;
        }

        try {
            if ("documentPictureInPicture" in window) {
                this.pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: Math.max(500, this.container.clientWidth),
                    height: Math.max(360, this.container.clientHeight)
                });

                const styles = document.getElementById("brain-viz-styles");
                if (styles) {
                    this.pipWindow.document.head.appendChild(styles.cloneNode(true));
                }

                this.container.style.position = "absolute";
                this.container.style.top = "0";
                this.container.style.left = "0";
                this.container.style.width = "100%";
                this.container.style.height = "100%";
                this.container.style.borderRadius = "0";
                this.container.style.border = "none";
                this.container.style.resize = "none";

                this.pipWindow.document.body.style.margin = "0";
                this.pipWindow.document.body.style.background = "#090d13";
                this.pipWindow.document.body.appendChild(this.container);

                this.pipWindow.addEventListener("pagehide", () => {
                    this._restoreDockedContainer();
                });
                return;
            }

            const popWin = window.open("", "BrainVisualizerPopout", `width=${Math.max(500, this.width)},height=${Math.max(360, this.height)},resizable=yes`);
            if (popWin) {
                this.pipWindow = popWin;
                const styles = document.getElementById("brain-viz-styles");
                if (styles) popWin.document.head.appendChild(styles.cloneNode(true));

                this.container.style.position = "absolute";
                this.container.style.top = "0";
                this.container.style.left = "0";
                this.container.style.width = "100vw";
                this.container.style.height = "100vh";
                this.container.style.borderRadius = "0";
                this.container.style.border = "none";
                this.container.style.resize = "none";

                popWin.document.body.style.margin = "0";
                popWin.document.body.style.background = "#090d13";
                popWin.document.body.appendChild(this.container);

                popWin.addEventListener("beforeunload", () => {
                    this._restoreDockedContainer();
                });
            }
        } catch (err) {
            console.warn("Pop-out window could not be opened:", err);
        }
    }

    _restoreDockedContainer() {
        this.container.style.position = "fixed";
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.container.style.top = "16px";
        this.container.style.right = "16px";
        this.container.style.left = "auto";
        this.container.style.borderRadius = "8px";
        this.container.style.border = "1px solid #30363d";
        this.container.style.resize = "both";
        document.body.appendChild(this.container);
        this.pipWindow = null;
    }

    resetView() {
        this.panX = 24;
        this.panY = 24;
        this.zoom = 1.0;
    }

    _startLoop() {
        const renderLoop = () => {
            this.draw();
            requestAnimationFrame(renderLoop);
        };
        requestAnimationFrame(renderLoop);
    }

    draw() {
        if (!this.isOpen) return;

        // Auto-prune providers whose entity or brain has been nulled, dead, or returned to pool
        let pruned = false;
        this.providers = this.providers.filter(p => {
            if (!p || p.entity == null) {
                pruned = true;
                return false;
            }
            if (p.entity._remove || p.entity.isDead || p.entity.pooled) {
                pruned = true;
                return false;
            }
            try {
                const brain = p.accessor(p.entity);
                if (brain == null) {
                    pruned = true;
                    return false;
                }
            } catch (_) {
                pruned = true;
                return false;
            }
            return true;
        });

        if (pruned) {
            this._updateTitle();
        }

        if (this.providers.length === 0) return;

        const cw = this.canvas.clientWidth;
        const ch = this.canvas.clientHeight;
        if (cw === 0 || ch === 0) return;

        const dpr = (this.pipWindow?.devicePixelRatio) || window.devicePixelRatio || 1;

        if (this.canvas.width !== Math.floor(cw * dpr) || this.canvas.height !== Math.floor(ch * dpr)) {
            this.canvas.width = Math.floor(cw * dpr);
            this.canvas.height = Math.floor(ch * dpr);
        }

        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        // Apply Camera Pan & Zoom Transform
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        // Render each tracked brain stacked strictly vertically
        let currentY = 0;
        const cardGapY = 24;

        for (let idx = 0; idx < this.providers.length; idx++) {
            const p = this.providers[idx];
            let brain = null;
            try {
                brain = p.accessor(p.entity);
            } catch (_) {}
            if (!brain) continue;

            // Measure dimensions dynamically to prevent any text or node overlapping
            const layout = this._computeCardLayout(ctx, brain);

            ctx.save();
            ctx.translate(0, currentY);

            // Draw Brain Card Container
            this._drawCardBackground(ctx, p.label, layout.width, layout.height);

            // Draw Brain Topology
            if (brain instanceof DenseNetwork || brain.layerSizes) {
                this._drawDenseNetwork(ctx, brain, layout);
            } else if (brain instanceof SparseNetwork || brain.connections) {
                this._drawSparseNetwork(ctx, brain, layout);
            }

            ctx.restore();

            currentY += layout.height + cardGapY;
        }

        ctx.restore();
    }

    _computeCardLayout(ctx, brain) {
        ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";

        const isDense = brain instanceof DenseNetwork || Boolean(brain.layerSizes);
        let numInputs = 0, numOutputs = 0, maxNodesInCol = 0, numCols = 2;

        if (isDense) {
            const layers = brain.layerSizes || [];
            numInputs = layers[0] || 0;
            numOutputs = layers[layers.length - 1] || 0;
            maxNodesInCol = Math.max(...layers, 1);
            numCols = Math.max(2, layers.length);
        } else {
            numInputs = brain.numInputs || 0;
            numOutputs = brain.numOutputs || 0;
            const numHidden = (brain.totalNodes || 0) - (numInputs + numOutputs);
            maxNodesInCol = Math.max(numInputs, numOutputs, numHidden, 1);
            numCols = numHidden > 0 ? 3 : 2;
        }

        // Measure maximum text width for inputs
        let maxInTextWidth = 50;
        for (let i = 0; i < numInputs; i++) {
            const label = brain.inputLabels?.[i] || `In ${i}`;
            const metrics = ctx.measureText(`${label} [0.00]`);
            if (metrics.width > maxInTextWidth) maxInTextWidth = metrics.width;
        }

        // Measure maximum text width for outputs
        let maxOutTextWidth = 50;
        for (let i = 0; i < numOutputs; i++) {
            const label = brain.outputLabels?.[i] || `Out ${i}`;
            const metrics = ctx.measureText(`[0.00] ${label}`);
            if (metrics.width > maxOutTextWidth) maxOutTextWidth = metrics.width;
        }

        const leftMargin = maxInTextWidth + 24;
        const rightMargin = maxOutTextWidth + 24;
        const colSpacing = 160; // Generous space between node columns
        const rowSpacing = 42;  // Generous vertical space per node
        const topPadding = 46;  // Title bar + divider space
        const bottomPadding = 18;

        const width = Math.max(360, leftMargin + (numCols - 1) * colSpacing + rightMargin);
        const height = Math.max(160, topPadding + maxNodesInCol * rowSpacing + bottomPadding);

        return {
            width,
            height,
            leftMargin,
            rightMargin,
            colSpacing,
            rowSpacing,
            topPadding,
            maxNodesInCol
        };
    }

    _drawCardBackground(ctx, label, width, height) {
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, 8);
        ctx.fillStyle = "rgba(22, 27, 34, 0.75)";
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Card Title Banner
        ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#58a6ff";
        ctx.textAlign = "left";
        ctx.fillText(`🧠 ${label}`, 14, 22);

        // Divider
        ctx.beginPath();
        ctx.moveTo(12, 32);
        ctx.lineTo(width - 12, 32);
        ctx.strokeStyle = "rgba(48, 54, 61, 0.6)";
        ctx.stroke();
    }

    _drawDenseNetwork(ctx, brain, layout) {
        const layers = brain.layerSizes;
        if (!layers || layers.length < 2) return;

        const { leftMargin, colSpacing, rowSpacing, topPadding, maxNodesInCol } = layout;

        // Calculate node positions with vertical centering per column
        const nodePos = [];
        for (let l = 0; l < layers.length; l++) {
            nodePos[l] = [];
            const count = layers[l];
            const startY = topPadding + ((maxNodesInCol - count) * rowSpacing) / 2 + rowSpacing / 2;
            for (let i = 0; i < count; i++) {
                nodePos[l][i] = {
                    x: leftMargin + l * colSpacing,
                    y: startY + i * rowSpacing
                };
            }
        }

        // Draw connections
        for (let l = 0; l < layers.length - 1; l++) {
            const inCount = layers[l];
            const outCount = layers[l + 1];
            const w = brain.weights[l];
            let wIdx = 0;

            for (let o = 0; o < outCount; o++) {
                const tgt = nodePos[l + 1][o];
                for (let i = 0; i < inCount; i++) {
                    const src = nodePos[l][i];
                    const weight = w[wIdx++];

                    if (Math.abs(weight) < this.minWeightThreshold) continue;

                    ctx.beginPath();
                    ctx.moveTo(src.x, src.y);
                    ctx.lineTo(tgt.x, tgt.y);

                    const isPositive = weight >= 0;
                    const alpha = Math.min(1, Math.max(0.15, Math.abs(weight)));
                    ctx.strokeStyle = isPositive
                        ? `rgba(63, 185, 80, ${alpha})`
                        : `rgba(248, 81, 73, ${alpha})`;
                    ctx.lineWidth = Math.max(1, Math.min(4, Math.abs(weight) * 2.2));
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        for (let l = 0; l < layers.length; l++) {
            const isInput = l === 0;
            const isOutput = l === layers.length - 1;
            const activations = brain.activations[l];

            for (let i = 0; i < layers[l]; i++) {
                const pos = nodePos[l][i];
                const act = activations ? activations[i] : 0;
                this._drawNode(ctx, pos.x, pos.y, act, isInput, isOutput, i, brain);
            }
        }
    }

    _drawSparseNetwork(ctx, brain, layout) {
        const numInputs = brain.numInputs;
        const numOutputs = brain.numOutputs;
        const totalNodes = brain.totalNodes;
        const { leftMargin, colSpacing, rowSpacing, topPadding, maxNodesInCol } = layout;

        const inX = leftMargin;
        const outX = leftMargin + (totalNodes > (numInputs + numOutputs) ? 2 : 1) * colSpacing;
        const midX = (inX + outX) / 2;

        const nodePositions = [];
        const inStartY = topPadding + ((maxNodesInCol - numInputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numInputs; i++) {
            nodePositions[i] = { x: inX, y: inStartY + i * rowSpacing, type: 'in' };
        }

        const outStartY = topPadding + ((maxNodesInCol - numOutputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numOutputs; i++) {
            nodePositions[numInputs + i] = { x: outX, y: outStartY + i * rowSpacing, type: 'out' };
        }

        const numHidden = totalNodes - (numInputs + numOutputs);
        const hidStartY = topPadding + ((maxNodesInCol - numHidden) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numHidden; i++) {
            const idx = numInputs + numOutputs + i;
            nodePositions[idx] = { x: midX, y: hidStartY + i * rowSpacing, type: 'hidden' };
        }

        // Draw connections
        const connections = brain.connections || [];
        for (const conn of connections) {
            if (!conn.enabled || Math.abs(conn.weight) < this.minWeightThreshold) continue;

            const src = nodePositions[conn.src];
            const tgt = nodePositions[conn.tgt];
            if (!src || !tgt) continue;

            const isPositive = conn.weight >= 0;
            const alpha = Math.min(1, Math.max(0.2, Math.abs(conn.weight)));
            ctx.strokeStyle = isPositive
                ? `rgba(63, 185, 80, ${alpha})`
                : `rgba(248, 81, 73, ${alpha})`;
            ctx.lineWidth = Math.max(1, Math.min(4, Math.abs(conn.weight) * 2.2));

            ctx.beginPath();
            if (conn.src === conn.tgt) {
                ctx.arc(src.x, src.y - 12, 10, 0, Math.PI * 2);
            } else if (conn.src >= conn.tgt) {
                ctx.moveTo(src.x, src.y);
                ctx.quadraticCurveTo((src.x + tgt.x) / 2, Math.max(src.y, tgt.y) + 24, tgt.x, tgt.y);
            } else {
                ctx.moveTo(src.x, src.y);
                ctx.lineTo(tgt.x, tgt.y);
            }
            ctx.stroke();
        }

        // Draw nodes
        for (let i = 0; i < totalNodes; i++) {
            const pos = nodePositions[i];
            if (!pos) continue;

            const act = brain.currentValues ? brain.currentValues[i] : 0;
            const isInput = i < numInputs;
            const isOutput = i >= numInputs && i < numInputs + numOutputs;

            this._drawNode(ctx, pos.x, pos.y, act, isInput, isOutput, i, brain);
        }
    }

    _drawNode(ctx, x, y, activation, isInput, isOutput, index, brain) {
        const radius = 8;
        const normAct = Math.max(0, Math.min(1, activation));

        // Node Glow & Body
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const brightness = Math.floor(normAct * 200 + 40);
        ctx.fillStyle = isInput
            ? `rgb(${brightness}, ${brightness}, 255)`
            : (isOutput ? `rgb(255, ${brightness}, ${brightness})` : `rgb(${brightness}, 255, ${brightness})`);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Node Label resolution
        let labelText = "";
        if (isInput) {
            labelText = brain.inputLabels?.[index] || `In ${index}`;
        } else if (isOutput) {
            const outIdx = brain.layerSizes ? index : (index - brain.numInputs);
            labelText = brain.outputLabels?.[outIdx] || `Out ${outIdx}`;
        } else {
            labelText = `H ${index}`;
        }

        const valStr = normAct.toFixed(2);

        ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#e6edf3";

        if (isInput) {
            ctx.textAlign = "right";
            ctx.fillText(`${labelText} [${valStr}]`, x - 13, y + 4);
        } else if (isOutput) {
            ctx.textAlign = "left";
            ctx.fillText(`[${valStr}] ${labelText}`, x + 13, y + 4);
        } else {
            ctx.textAlign = "left";
            ctx.fillText(`${labelText} [${valStr}]`, x + 10, y - 6);
        }
    }
}
