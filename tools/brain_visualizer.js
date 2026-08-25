/**
 * BrainVisualizer - Picture-in-Picture Real-Time Multi-Brain HUD
 * 
 * Features:
 * - Multi-Brain rendering (DenseNetwork and SparseNetwork) with dynamic card sizing.
 * - 4 Distinct View Modes: Full Connectome, Activity Gauges, Flow Hub, I/O Endpoints.
 * - Interactive Chip Tag Search & Label Filtering with Cached Graph Dependency Pruning.
 * - Pan, zoom, pointer-captured dual corner resizing, and native OS Document PiP window support.
 */
class BrainVisualizer {
    /**
     * @param {Object} [options]
     * @param {number} [options.width=500] Default HUD width
     * @param {number} [options.height=380] Default HUD height
     * @param {string} [options.viewMode="full"] Default view mode: 'full' | 'eeg' | 'flow' | 'io'
     * @param {boolean} [options.autoLoop=true] Automatically animate via requestAnimationFrame
     * @param {boolean} [options.closed=false] Start closed/hidden until opened or inspected
     * @param {boolean} [options.open=true] Alternative to closed (set false to start closed)
     * @param {boolean} [options.startClosed=false] Alias for closed
     */
    constructor(options = {}) {
        this.width = options.width || 500;
        this.height = options.height || 380;
        this.globalViewMode = options.viewMode || "full";
        this.minWeightThreshold = 0.05;
        const startClosed = Boolean(options.closed || options.startClosed || options.open === false);
        this.isOpen = !startClosed;
        this.pipWindow = null;

        // Registry of tracked brain providers: [{ label, entity, accessor, viewMode? }]
        this.providers = [];

        // Label Filtering State
        this.filterTags = [];
        this.rawFilterText = "";
        this.isFiltering = false;
        this.filterCache = new WeakMap(); // Map<brain, { activeNodes: Set<number>, activeConns: Set<string> }>
        this.historyRing = new WeakMap(); // Map<brain, { buffer: Float32Array, head: number, size: number }>

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
                    min-width: 340px;
                    min-height: 220px;
                }
                .brain-viz-header {
                    padding: 6px 10px;
                    background: rgba(22, 27, 34, 0.95);
                    border-bottom: 1px solid #30363d;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    user-select: none;
                    cursor: move;
                    touch-action: none;
                    gap: 8px;
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
                .brain-viz-select {
                    background: #21262d;
                    border: 1px solid #30363d;
                    color: #c9d1d9;
                    border-radius: 4px;
                    padding: 2px 6px;
                    font-size: 11px;
                    cursor: pointer;
                    outline: none;
                }
                .brain-viz-select:focus {
                    border-color: #58a6ff;
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
                    gap: 6px;
                    color: #8b949e;
                    font-size: 11px;
                }
                .brain-viz-slider-box input {
                    width: 65px;
                    cursor: pointer;
                }
                .brain-viz-slider-val {
                    font-variant-numeric: tabular-nums;
                    color: #79c0ff;
                    min-width: 26px;
                }
                .brain-viz-search-bar {
                    padding: 4px 10px;
                    background: rgba(18, 22, 28, 0.9);
                    border-bottom: 1px solid #21262d;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .brain-viz-chips {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                .brain-viz-chip {
                    background: #1f6feb33;
                    border: 1px solid #1f6feb88;
                    color: #79c0ff;
                    border-radius: 12px;
                    padding: 1px 8px;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .brain-viz-chip-remove {
                    cursor: pointer;
                    color: #8b949e;
                    font-weight: bold;
                    font-size: 12px;
                }
                .brain-viz-chip-remove:hover {
                    color: #f85149;
                }
                .brain-viz-search-input {
                    flex: 1;
                    min-width: 120px;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: #c9d1d9;
                    font-size: 11px;
                }
                .brain-viz-search-input::placeholder {
                    color: #484f58;
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
        if (!this.isOpen) {
            this.container.style.display = "none";
        }
        this.container.innerHTML = `
            <div class="brain-viz-header" id="brain-viz-drag">
                <div class="brain-viz-title" id="brain-viz-name">🧠 Neural Telemetry</div>
                <div class="brain-viz-controls">
                    <select class="brain-viz-select" id="brain-viz-view-select" title="Switch Visualization Mode">
                        <option value="full">Full Connectome</option>
                        <option value="eeg">EEG Heatmap</option>
                        <option value="flow">Flow Hub</option>
                        <option value="io">I/O Endpoints</option>
                    </select>
                    <div class="brain-viz-slider-box" title="Hide faint connections below threshold (1% - 99%)">
                        <span>Filter:</span>
                        <input type="range" id="brain-viz-thresh" min="0.01" max="0.99" step="0.01" value="0.05" />
                        <span class="brain-viz-slider-val" id="brain-viz-thresh-val">5%</span>
                    </div>
                    <button class="brain-viz-btn" id="brain-viz-popout" title="Pop Out Window">⧉</button>
                    <button class="brain-viz-btn" id="brain-viz-reset" title="Center / Frame View">⌖</button>
                    <button class="brain-viz-btn brain-viz-close-btn" id="brain-viz-close" title="Close (Re-opens on selecting creature)">✕</button>
                </div>
            </div>
            <div class="brain-viz-search-bar">
                <div class="brain-viz-chips" id="brain-viz-chips"></div>
                <input type="text" class="brain-viz-search-input" id="brain-viz-search" placeholder="🔍 Filter labels (e.g. wall, steer)..." />
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
        this.searchInput = this.container.querySelector("#brain-viz-search");
        this.chipsContainer = this.container.querySelector("#brain-viz-chips");
        this.viewSelect = this.container.querySelector("#brain-viz-view-select");
        this.viewSelect.value = this.globalViewMode;
    }

    _setupEvents() {
        const header = this.container.querySelector("#brain-viz-drag");
        const closeBtn = this.container.querySelector("#brain-viz-close");
        const resetBtn = this.container.querySelector("#brain-viz-reset");
        const popoutBtn = this.container.querySelector("#brain-viz-popout");
        const threshSlider = this.container.querySelector("#brain-viz-thresh");
        const resizeBl = this.container.querySelector("#brain-viz-resize-bl");
        const resizeBr = this.container.querySelector("#brain-viz-resize-br");

        // Global View Mode Select
        this.viewSelect.addEventListener("change", (e) => {
            this.globalViewMode = e.target.value;
            for (const p of this.providers) {
                p.viewMode = e.target.value;
            }
        });

        // Search Input & Tag Chips
        this.searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const val = this.searchInput.value.trim().replace(/^,|,$/g, "");
                if (val && !this.filterTags.includes(val.toLowerCase())) {
                    this.filterTags.push(val.toLowerCase());
                    this.searchInput.value = "";
                    this.rawFilterText = "";
                    this._renderChips();
                    this._recomputeFilterCache();
                }
            } else if (e.key === "Backspace" && this.searchInput.value === "" && this.filterTags.length > 0) {
                this.filterTags.pop();
                this._renderChips();
                this._recomputeFilterCache();
            }
        });

        this.searchInput.addEventListener("input", (e) => {
            this.rawFilterText = e.target.value.trim().toLowerCase();
            this._recomputeFilterCache();
        });

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
                const newW = Math.max(340, blStartW + deltaX);
                const newH = Math.max(220, blStartH + deltaY);
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
                const newW = Math.max(340, brStartW + deltaX);
                const newH = Math.max(220, brStartH + deltaY);

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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || this.pipWindow) return;
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

        const threshVal = this.container.querySelector("#brain-viz-thresh-val");

        // Threshold slider (1% - 99%)
        threshSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            this.minWeightThreshold = val;
            if (threshVal) {
                threshVal.textContent = `${Math.round(val * 100)}%`;
            }
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

        this.mouseWorldX = null;
        this.mouseWorldY = null;
        this.hoveredNode = null;

        this.canvas.addEventListener("pointermove", (e) => {
            if (this.isDragging) {
                this.panX = e.clientX - this.dragStartX;
                this.panY = e.clientY - this.dragStartY;
            }
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.mouseWorldX = (mouseX - this.panX) / this.zoom;
            this.mouseWorldY = (mouseY - this.panY) / this.zoom;
        });

        this.canvas.addEventListener("pointerleave", () => {
            this.mouseWorldX = null;
            this.mouseWorldY = null;
            this.hoveredNode = null;
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

    _renderChips() {
        this.chipsContainer.innerHTML = "";
        this.filterTags.forEach((tag, idx) => {
            const chip = document.createElement("div");
            chip.className = "brain-viz-chip";
            chip.innerHTML = `<span>${tag}</span><span class="brain-viz-chip-remove" data-idx="${idx}">✕</span>`;
            this.chipsContainer.appendChild(chip);
        });

        this.chipsContainer.querySelectorAll(".brain-viz-chip-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.target.getAttribute("data-idx"));
                this.filterTags.splice(idx, 1);
                this._renderChips();
                this._recomputeFilterCache();
            });
        });
    }

    _getFilterData(brain) {
        if (!this.isFiltering || !brain) return null;
        let data = this.filterCache.get(brain);
        if (!data) {
            data = this._computeFilterDataForBrain(brain);
            this.filterCache.set(brain, data);
        }
        return data;
    }

    _recomputeFilterCache() {
        const terms = [...this.filterTags];
        if (this.rawFilterText) terms.push(this.rawFilterText);

        if (terms.length === 0) {
            this.isFiltering = false;
            this.filterCache = new WeakMap();
            return;
        }

        this.isFiltering = true;
        this.filterCache = new WeakMap();

        for (const p of this.providers) {
            let brain = null;
            try { brain = p.accessor(p.entity); } catch (_) {}
            if (!brain) continue;
            const data = this._computeFilterDataForBrain(brain);
            this.filterCache.set(brain, data);
        }
    }

    _computeFilterDataForBrain(brain) {
        const terms = [...this.filterTags];
        if (this.rawFilterText) terms.push(this.rawFilterText);
        if (terms.length === 0) return null;

        const isDense = brain instanceof DenseNetwork || Boolean(brain.layerSizes);
        const activeNodes = new Set();
        const activeConns = new Set();

        const matchesAnyTerm = (str) => {
            if (!str) return false;
            const lower = str.toLowerCase();
            return terms.some(t => lower.includes(t));
        };

        if (isDense) {
            const layers = brain.layerSizes;
            const inCount = layers[0];
            const outCount = layers[layers.length - 1];

            const matchedInIndices = new Set();
            const matchedOutIndices = new Set();

            for (let i = 0; i < inCount; i++) {
                const label = brain.inputLabels?.[i] || `In ${i}`;
                if (matchesAnyTerm(label)) {
                    matchedInIndices.add(i);
                    activeNodes.add(`0_${i}`);
                }
            }

            for (let i = 0; i < outCount; i++) {
                const label = brain.outputLabels?.[i] || `Out ${i}`;
                if (matchesAnyTerm(label)) {
                    matchedOutIndices.add(i);
                    activeNodes.add(`${layers.length - 1}_${i}`);
                }
            }

            // If matched inputs, trace downstream
            if (matchedInIndices.size > 0) {
                for (let l = 0; l < layers.length - 1; l++) {
                    const inSize = layers[l];
                    const outSize = layers[l + 1];
                    const w = brain.weights[l];
                    let wIdx = 0;
                    for (let o = 0; o < outSize; o++) {
                        for (let i = 0; i < inSize; i++) {
                            const weight = w[wIdx++];
                            if (activeNodes.has(`${l}_${i}`) && Math.abs(weight) >= this.minWeightThreshold) {
                                activeNodes.add(`${l + 1}_${o}`);
                                activeConns.add(`${l}_${i}->${l + 1}_${o}`);
                            }
                        }
                    }
                }
            }

            // If matched outputs, trace upstream
            if (matchedOutIndices.size > 0) {
                for (let l = layers.length - 2; l >= 0; l--) {
                    const inSize = layers[l];
                    const outSize = layers[l + 1];
                    const w = brain.weights[l];
                    let wIdx = 0;
                    for (let o = 0; o < outSize; o++) {
                        for (let i = 0; i < inSize; i++) {
                            const weight = w[wIdx++];
                            if (activeNodes.has(`${l + 1}_${o}`) && Math.abs(weight) >= this.minWeightThreshold) {
                                activeNodes.add(`${l}_${i}`);
                                activeConns.add(`${l}_${i}->${l + 1}_${o}`);
                            }
                        }
                    }
                }
            }
        } else {
            // Sparse Network BFS Trace
            const numIn = brain.numInputs;
            const numOut = brain.numOutputs;

            for (let i = 0; i < numIn; i++) {
                const label = brain.inputLabels?.[i] || `In ${i}`;
                if (matchesAnyTerm(label)) activeNodes.add(i);
            }

            for (let i = 0; i < numOut; i++) {
                const label = brain.outputLabels?.[i] || `Out ${i}`;
                if (matchesAnyTerm(label)) activeNodes.add(numIn + i);
            }

            let expanded = true;
            let passes = 0;
            while (expanded && passes < 4) {
                expanded = false;
                passes++;
                for (const conn of (brain.connections || [])) {
                    if (!conn.enabled || Math.abs(conn.weight) < this.minWeightThreshold) continue;
                    if (activeNodes.has(conn.src) || activeNodes.has(conn.tgt)) {
                        if (!activeNodes.has(conn.src)) { activeNodes.add(conn.src); expanded = true; }
                        if (!activeNodes.has(conn.tgt)) { activeNodes.add(conn.tgt); expanded = true; }
                        activeConns.add(`${conn.src}->${conn.tgt}`);
                    }
                }
            }
        }

        return { activeNodes, activeConns };
    }

    /**
     * Track a brain provider closure or entity directly.
     * Supports flexible signatures:
     * - track(entity)
     * - track(label, entity)
     * - track(label, entity, accessor, viewMode, isReplay)
     * 
     * @param {string|Object} label Human-readable label or the entity itself
     * @param {Object} [entity] Host creature/agent object
     * @param {function(Object): (DenseNetwork|SparseNetwork)} [accessor] Function to retrieve the brain from the entity
     * @param {string} [viewMode] Optional per-card view override: 'full' | 'eeg' | 'flow' | 'io'
     * @param {boolean} [isReplay=false] True if displaying a recorded highlight replay reel
     */
    track(label, entity, accessor, viewMode, isReplay = false) {
        if (label && typeof label === 'object') {
            isReplay = Boolean(viewMode);
            viewMode = accessor;
            accessor = entity;
            entity = label;
            label = entity.brain?.name || entity.name || entity.label || "Agent";
        } else if (!label && entity) {
            label = entity.brain?.name || entity.name || entity.label || "Agent";
        }

        this.untrack(label);

        this.providers.push({
            label: label || "Brain",
            entity,
            accessor: typeof accessor === 'function' ? accessor : (e) => e?.brain || e,
            viewMode: viewMode || null,
            isReplay: Boolean(isReplay)
        });

        this._updateTitle();
        this._recomputeFilterCache();
    }

    untrack(label) {
        this.providers = this.providers.filter(p => p.label !== label);
        this._updateTitle();
        this._recomputeFilterCache();
    }

    clear() {
        this.providers = [];
        this._updateTitle();
        this._recomputeFilterCache();
    }

    inspect(label, entity, accessor, viewMode, isReplay = false) {
        this.clear();
        this.track(label, entity, accessor, viewMode, isReplay);
        this.open();
    }

    _updateTitle() {
        if (!this.titleEl) return;
        if (this.providers.length === 0) {
            this.titleEl.textContent = `🧠 No Targets`;
        } else if (this.providers.length === 1) {
            const p = this.providers[0];
            const net = p.network;
            let compStr = "";
            if (net && typeof net.getComplexity === "function") {
                const c = net.getComplexity();
                const maxC = net.maxComplexity;
                compStr = maxC ? ` [Comp: ${c.toFixed(1)}/${maxC}]` : ` [Comp: ${c.toFixed(1)}]`;
            }
            this.titleEl.textContent = `🧠 ${p.label}${compStr}`;
        } else {
            this.titleEl.textContent = `🧠 Telemetry (${this.providers.length} Brains)`;
        }
    }

    open() {
        this.isOpen = true;
        this.container.style.display = "flex";
    }

    close() {
        this.isOpen = false;
        if (this.pipWindow) {
            this.pipWindow.close();
            this.pipWindow = null;
        }
        this.container.style.display = "none";
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * @param {Object} stats
     * @param {number} [stats.fps]
     * @param {number} [stats.frameTime]
     * @param {number} [stats.physTime]
     * @param {number} [stats.brainTime]
     * @param {number} [stats.drawTime]
     * @param {number} [stats.queueLength]
     * @param {number} [stats.brainRate]
     */
    updatePerformanceStats(stats = {}) {
        if (!this.isOpen || !this.perfFps) return;

        const fps = stats.fps !== undefined ? Math.round(stats.fps) : 60;
        const frameTime = stats.frameTime !== undefined ? stats.frameTime.toFixed(1) : "0.0";
        const physTime = stats.physTime !== undefined ? stats.physTime.toFixed(1) : "0.0";
        const brainTime = stats.brainTime !== undefined ? stats.brainTime.toFixed(1) : "0.0";
        const drawTime = stats.drawTime !== undefined ? stats.drawTime.toFixed(1) : "0.0";
        const queueLength = stats.queueLength !== undefined ? stats.queueLength : 0;
        const brainRate = stats.brainRate !== undefined ? Math.round(stats.brainRate) : 0;

        if (this.perfFps) this.perfFps.textContent = `${fps} FPS`;
        if (this.perfFrameTime) this.perfFrameTime.textContent = `(${frameTime}ms)`;
        if (this.perfPhysTime) this.perfPhysTime.textContent = `${physTime}ms`;
        if (this.perfBrainTime) this.perfBrainTime.textContent = `${brainTime}ms`;
        if (this.perfDrawTime) this.perfDrawTime.textContent = `${drawTime}ms`;
        if (this.perfQueue) this.perfQueue.textContent = `${queueLength}`;
        if (this.perfRate) this.perfRate.textContent = `${brainRate} Hz`;

        if (this.perfDot) {
            this.perfDot.className = "perf-dot" + (fps >= 55 ? "" : (fps >= 35 ? " yellow" : " red"));
        }
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
                    height: Math.max(380, this.container.clientHeight)
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

                this.pipWindow.document.body.style.margin = "0";
                this.pipWindow.document.body.style.background = "#090d13";
                this.pipWindow.document.body.appendChild(this.container);

                this.pipWindow.addEventListener("pagehide", () => {
                    this._restoreDockedContainer();
                });
                return;
            }

            const popWin = window.open("", "BrainVisualizerPopout", `width=${Math.max(500, this.width)},height=${Math.max(380, this.height)},resizable=yes`);
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
            if (!p || p.entity == null) { pruned = true; return false; }
            if (p.entity._remove || p.entity.isDead || p.entity.dead || p.entity.pooled) { pruned = true; return false; }
            try {
                const brain = p.accessor(p.entity);
                if (brain == null) { pruned = true; return false; }
            } catch (_) {
                pruned = true;
                return false;
            }
            return true;
        });
        if (pruned) {
            this._updateTitle();
            this._recomputeFilterCache();
        }

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

        if (this.providers.length === 0) {
            ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillStyle = "#484f58";
            ctx.textAlign = "center";
            ctx.fillText("🧠 No Active Brains Tracked", cw / 2, ch / 2 - 8);
            ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillStyle = "#30363d";
            ctx.fillText("Select a preset or instantiate a brain in the builder", cw / 2, ch / 2 + 14);
            ctx.restore();
            return;
        }

        // Apply Camera Pan & Zoom Transform
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        let currentY = 0;
        const cardGapY = 24;

        const viewLeft = -this.panX / this.zoom;
        const viewRight = (cw - this.panX) / this.zoom;
        const viewTop = -this.panY / this.zoom;
        const viewBottom = (ch - this.panY) / this.zoom;

        for (let idx = 0; idx < this.providers.length; idx++) {
            const p = this.providers[idx];
            let brain = null;
            try {
                brain = p.accessor(p.entity);
            } catch (_) {}
            if (!brain) continue;

            const mode = p.viewMode || this.globalViewMode || "full";
            const filterData = this._getFilterData(brain);

            // Compute dynamic card dimensions for this mode
            const layout = this._computeCardLayout(ctx, brain, mode, p.entity);

            // --- Whole-Card Viewport Frustum Culling ---
            const cardTop = currentY;
            const cardBottom = currentY + layout.height;
            const cardLeft = 0;
            const cardRight = layout.width;

            if (cardBottom < viewTop || cardTop > viewBottom || cardRight < viewLeft || cardLeft > viewRight) {
                currentY += layout.height + cardGapY;
                continue; // Skip rendering completely when card is outside camera viewport!
            }

            ctx.save();
            ctx.translate(0, currentY);

            // Draw Card Container
            this._drawCardBackground(ctx, p.label, layout.netWidth, layout.netHeight, mode);

            const cardView = {
                viewLeft: viewLeft,
                viewRight: viewRight,
                viewTop: viewTop - currentY,
                viewBottom: viewBottom - currentY,
                mouseX: this.mouseWorldX,
                mouseY: this.mouseWorldY !== null ? this.mouseWorldY - currentY : null
            };

            // Draw based on chosen View Mode
            if (mode === "eeg") {
                this._drawEEGHeatmapMode(ctx, brain, layout, filterData);
            } else if (mode === "flow") {
                this._drawFlowMode(ctx, brain, layout, filterData);
            } else if (mode === "io") {
                this._drawIOMode(ctx, brain, layout, filterData);
            } else {
                // Full Connectome
                if (brain instanceof DenseNetwork || brain.layerSizes) {
                    this._drawDenseNetwork(ctx, brain, layout, filterData, cardView);
                } else {
                    this._drawSparseNetwork(ctx, brain, layout, filterData, cardView);
                }
            }

            // Draw Standalone Square Creature Camera Viewport Card next to the network view
            if (layout.entityBoxSize > 0) {
                this._drawEntityCamera(ctx, p, layout.netWidth + 12, 0, layout.entityBoxSize, layout.entityBoxSize);
            }

            ctx.restore();

            currentY += layout.height + cardGapY;
        }

        ctx.restore();
    }

    _drawEntityCamera(ctx, p, boxX, boxY, boxW, boxH) {
        ctx.save();

        // Standalone Glassmorphic Camera Container Frame
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fillStyle = "rgba(10, 16, 26, 0.88)";
        ctx.fill();
        ctx.strokeStyle = p.isReplay ? "#f59e0b" : "#38bdf8";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Header Title Banner
        ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = p.isReplay ? "#fbbf24" : "#7dd3fc";
        ctx.textAlign = "left";
        const badge = p.isReplay ? "🎞️ REPLAY" : "🔴 LIVE VIEW";
        ctx.fillText(badge, boxX + 10, boxY + 16);

        // Viewport Clip Area
        const viewportTop = boxY + 22;
        const viewportBottom = boxY + boxH - 28;
        const viewportH = Math.max(20, viewportBottom - viewportTop);

        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX + 4, viewportTop, boxW - 8, viewportH);
        ctx.clip();

        // Subtle circular radar / depth guide
        const cx = boxX + boxW / 2;
        const cy = viewportTop + viewportH / 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(34, (boxW - 16) / 2), 0, Math.PI * 2);
        ctx.stroke();

        // Draw Entity Centered
        const ent = p.entity;
        if (ent) {
            if (typeof ent.drawPreview === "function") {
                ent.drawPreview(ctx, cx, cy);
            } else if (typeof ent.draw === "function") {
                const origX = ent.x;
                const origY = ent.y;
                ent.x = cx;
                ent.y = cy;
                try { ent.draw(ctx); } catch (_) {}
                ent.x = origX;
                ent.y = origY;
            }
        }
        ctx.restore();

        // Clean Numeric Multi-Line Footer Telemetry
        ctx.font = "9.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";

        // Line 1: Points & Fullness/Hunger
        const scoreVal = ent?.score !== undefined ? `Pts: ${ent.score}` : (ent?.size ? `S:${Math.round(ent.size)}` : "");
        const hungerVal = ent?.hunger !== undefined ? ` • H: ${Math.round(ent.hunger * 100)}%` : "";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`${scoreVal}${hungerVal}`, cx, boxY + boxH - 16);

        // Line 2: Numeric Age & Physical Size
        const ageVal = ent?.age !== undefined ? `Age: ${Math.floor(ent.age)}s` : "";
        const sizeVal = ent?.size !== undefined ? ` • Sz: ${Math.round(ent.size)}` : "";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`${ageVal}${sizeVal}`, cx, boxY + boxH - 5);

        ctx.restore();
    }

    _computeCardLayout(ctx, brain, mode, entity = null) {
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

        let maxInTextWidth = 50;
        const inLabels = brain.inputLabels || entity?.inputLabels || entity?.brain?.inputLabels;
        for (let i = 0; i < numInputs; i++) {
            const label = inLabels?.[i] || `In ${i}`;
            const metrics = ctx.measureText(`${label} [0.00]`);
            if (metrics.width > maxInTextWidth) maxInTextWidth = metrics.width;
        }

        let maxOutTextWidth = 50;
        const outLabels = brain.outputLabels || entity?.outputLabels || entity?.brain?.outputLabels;
        for (let i = 0; i < numOutputs; i++) {
            const label = outLabels?.[i] || `Out ${i}`;
            const metrics = ctx.measureText(`[0.00] ${label}`);
            if (metrics.width > maxOutTextWidth) maxOutTextWidth = metrics.width;
        }

        const leftMargin = maxInTextWidth + 24;
        const rightMargin = maxOutTextWidth + 24;
        const rowSpacing = 42;
        const topPadding = 46;
        const bottomPadding = 18;

        let colSpacing = 160;
        let width = 420;
        let height = 200;

        if (mode === "io") {
            const maxIONodes = Math.max(numInputs, numOutputs, 1);
            colSpacing = 180;
            width = Math.max(360, leftMargin + colSpacing + rightMargin);
            height = Math.max(140, topPadding + maxIONodes * rowSpacing + bottomPadding);
        } else if (mode === "eeg") {
            colSpacing = 165;
            width = 560;
            height = 195;
        } else if (mode === "flow") {
            const maxIONodes = Math.max(numInputs, numOutputs, 1);
            colSpacing = 160;
            width = Math.max(400, leftMargin + 2 * colSpacing + rightMargin);
            height = Math.max(160, topPadding + Math.max(maxIONodes, 3) * rowSpacing + bottomPadding);
        } else {
            // Full Connectome
            width = Math.max(380, leftMargin + (numCols - 1) * colSpacing + rightMargin);
            height = Math.max(160, topPadding + maxNodesInCol * rowSpacing + bottomPadding);
        }

        // Standalone Entity Viewport Cube next to the network view
        const hasEntity = entity && (typeof entity.draw === "function" || typeof entity.drawPreview === "function");
        const entityBoxSize = hasEntity ? Math.max(140, Math.min(220, height)) : 0;
        const totalRowWidth = width + (hasEntity ? entityBoxSize + 12 : 0);
        const totalRowHeight = Math.max(height, entityBoxSize);

        return {
            netWidth: width,
            netHeight: height,
            entityBoxSize: entityBoxSize,
            width: totalRowWidth,
            height: totalRowHeight,
            leftMargin,
            rightMargin,
            colSpacing,
            rowSpacing,
            topPadding,
            maxNodesInCol
        };
    }

    _drawCardBackground(ctx, label, width, height, mode) {
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, 8);
        ctx.fillStyle = "rgba(22, 27, 34, 0.75)";
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Card Title Banner & Mode Badge
        ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#58a6ff";
        ctx.textAlign = "left";
        ctx.fillText(`🧠 ${label}`, 14, 22);

        // Mode badge on right of header
        ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.textAlign = "right";
        ctx.fillText(`Mode: ${mode.toUpperCase()}`, width - 14, 22);

        // Divider
        ctx.beginPath();
        ctx.moveTo(12, 32);
        ctx.lineTo(width - 12, 32);
        ctx.strokeStyle = "rgba(48, 54, 61, 0.6)";
        ctx.stroke();
    }

    _drawDenseNetwork(ctx, brain, layout, filterData, cardView) {
        const layers = brain.layerSizes;
        if (!layers || layers.length < 2) return;
        const { leftMargin, colSpacing, rowSpacing, topPadding, maxNodesInCol } = layout;
        const { viewLeft, viewRight, viewTop, viewBottom, mouseX, mouseY } = cardView || {};

        const nodePos = [];
        for (let l = 0; l < layers.length; l++) {
            nodePos[l] = [];
            const count = layers[l];
            const startY = topPadding + ((maxNodesInCol - count) * rowSpacing) / 2 + rowSpacing / 2;
            for (let i = 0; i < count; i++) {
                nodePos[l][i] = { x: leftMargin + l * colSpacing, y: startY + i * rowSpacing };
            }
        }

        // Detect Hovered Node Spotlight & Build Connected Neighbor Set
        let hoveredLayer = -1, hoveredIdx = -1;
        const spotlightNodes = new Set();

        if (mouseX !== null && mouseY !== null && mouseX !== undefined && mouseY !== undefined) {
            for (let l = 0; l < layers.length; l++) {
                const colX = nodePos[l][0].x;
                if (Math.abs(mouseX - colX) < 18) {
                    for (let i = 0; i < layers[l]; i++) {
                        const pos = nodePos[l][i];
                        if (Math.hypot(mouseX - pos.x, mouseY - pos.y) < 14) {
                            hoveredLayer = l;
                            hoveredIdx = i;
                            break;
                        }
                    }
                }
                if (hoveredLayer >= 0) break;
            }
        }

        if (hoveredLayer >= 0) {
            spotlightNodes.add(`${hoveredLayer}_${hoveredIdx}`);
            if (hoveredLayer > 0) {
                for (let i = 0; i < layers[hoveredLayer - 1]; i++) {
                    spotlightNodes.add(`${hoveredLayer - 1}_${i}`);
                }
            }
            if (hoveredLayer < layers.length - 1) {
                for (let o = 0; o < layers[hoveredLayer + 1]; o++) {
                    spotlightNodes.add(`${hoveredLayer + 1}_${o}`);
                }
            }
        }

        // Temporal Wave Progress (2.2s pulse sweeping from left to right)
        const sweepPeriod = 2200;
        const sweepPhase = (performance.now() % sweepPeriod) / sweepPeriod;

        // 10-Tier Style-Bucketed Batched Path Rendering
        const BUCKETS = [
            // Negative (Red)
            { color: "rgba(248, 81, 73, 0.22)", width: 1.0 },  // 0: Neg Light
            { color: "rgba(248, 81, 73, 0.55)", width: 1.8 },  // 1: Neg Med
            { color: "rgba(248, 81, 73, 0.85)", width: 2.8 },  // 2: Neg Heavy
            { color: "rgba(255, 95, 85, 1.00)", width: 3.8 },  // 3: Neg Ultra
            // Positive (Green)
            { color: "rgba(63, 185, 80, 0.22)", width: 1.0 },   // 4: Pos Light
            { color: "rgba(63, 185, 80, 0.55)", width: 1.8 },   // 5: Pos Med
            { color: "rgba(63, 185, 80, 0.85)", width: 2.8 },   // 6: Pos Heavy
            { color: "rgba(80, 230, 100, 1.00)", width: 3.8 },  // 7: Pos Ultra
            // Filtered Ghost Synapses
            { color: "rgba(248, 81, 73, 0.04)", width: 1.0 },  // 8: Neg Ghost
            { color: "rgba(63, 185, 80, 0.04)", width: 1.0 }   // 9: Pos Ghost
        ];

        const paths = Array.from({ length: 10 }, () => new Path2D());
        const hasLines = new Uint8Array(10);

        const activationsL = brain.activations;

        for (let l = 0; l < layers.length - 1; l++) {
            const inX = nodePos[l][0].x;
            const outX = nodePos[l + 1][0].x;

            // Horizontal Layer Frustum Cull
            if (cardView && (outX < viewLeft || inX > viewRight)) continue;

            const inCount = layers[l];
            const outCount = layers[l + 1];
            const w = brain.weights[l];
            const srcActs = activationsL ? activationsL[l] : null;
            let wIdx = 0;

            // Temporal wave proximity for layer l
            const layerDepth = (layers.length > 1) ? (l / (layers.length - 1)) : 0;
            let d = Math.abs(layerDepth - sweepPhase);
            if (d > 0.5) d = 1.0 - d;
            const waveBoost = Math.exp(-(d * d) / 0.015) * 0.45; // Traveling wavefront

            for (let o = 0; o < outCount; o++) {
                const tgt = nodePos[l + 1][o];
                for (let i = 0; i < inCount; i++) {
                    const src = nodePos[l][i];
                    const weight = w[wIdx++];

                    if (Math.abs(weight) < this.minWeightThreshold) continue;

                    const connKey = `${l}_${i}->${l + 1}_${o}`;
                    const isFiltered = this.isFiltering && filterData && !filterData.activeConns.has(connKey);
                    const isSpotlighted = (hoveredLayer >= 0) && ((l === hoveredLayer && i === hoveredIdx) || (l + 1 === hoveredLayer && o === hoveredIdx));
                    const isGhosted = (hoveredLayer >= 0 && !isSpotlighted) || isFiltered;

                    let bucketIdx = 0;
                    if (isGhosted) {
                        bucketIdx = weight >= 0 ? 9 : 8;
                    } else {
                        const absW = Math.abs(weight);
                        const srcAct = srcActs ? srcActs[i] : 0;
                        const transmittedSignal = Math.abs(srcAct * weight);

                        // Live Dynamic Intensity: Base weight + Live electrical transmission + spotlight/wave
                        const effectiveW = (absW * 0.35) + (transmittedSignal * 0.85) + (isSpotlighted ? 0.5 : waveBoost * 0.35);

                        let tier = 0;
                        if (effectiveW >= 1.15) tier = 3;
                        else if (effectiveW >= 0.68) tier = 2;
                        else if (effectiveW >= 0.32) tier = 1;
                        bucketIdx = (weight >= 0 ? 4 : 0) + tier;
                    }

                    paths[bucketIdx].moveTo(src.x, src.y);
                    paths[bucketIdx].lineTo(tgt.x, tgt.y);
                    hasLines[bucketIdx] = 1;
                }
            }
        }

        // Interleaved Draw Order: Ghost -> Light (Neg, Pos) -> Med (Neg, Pos) -> Heavy (Neg, Pos) -> Ultra (Neg, Pos)
        const DRAW_ORDER = [8, 9, 0, 4, 1, 5, 2, 6, 3, 7];
        for (const b of DRAW_ORDER) {
            if (hasLines[b]) {
                ctx.strokeStyle = BUCKETS[b].color;
                ctx.lineWidth = BUCKETS[b].width;
                ctx.stroke(paths[b]);
            }
        }

        // Draw nodes with Frustum Culling
        for (let l = 0; l < layers.length; l++) {
            const colX = nodePos[l][0].x;
            if (cardView && (colX < viewLeft - 50 || colX > viewRight + 50)) continue;

            const isInput = l === 0;
            const isOutput = l === layers.length - 1;
            const activations = brain.activations[l];

            for (let i = 0; i < layers[l]; i++) {
                const pos = nodePos[l][i];
                if (cardView && (pos.y < viewTop - 20 || pos.y > viewBottom + 20)) continue;

                const act = activations ? activations[i] : 0;
                const isFiltered = (this.isFiltering && filterData && !filterData.activeNodes.has(`${l}_${i}`)) ||
                                   (hoveredLayer >= 0 && !spotlightNodes.has(`${l}_${i}`));
                this._drawNode(ctx, pos.x, pos.y, act, isInput, isOutput, i, brain, isFiltered);
            }
        }
    }

    _drawSparseNetwork(ctx, brain, layout, filterData, cardView) {
        const numInputs = brain.numInputs;
        const numOutputs = brain.numOutputs;
        const totalNodes = brain.totalNodes;
        const { leftMargin, colSpacing, rowSpacing, topPadding, maxNodesInCol } = layout;
        const { viewLeft, viewRight, viewTop, viewBottom, mouseX, mouseY } = cardView || {};

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

        // Detect Hovered Node Spotlight & Connected Neighbor Set
        let hoveredNodeIdx = -1;
        const spotlightNodes = new Set();

        if (mouseX !== null && mouseY !== null && mouseX !== undefined && mouseY !== undefined) {
            for (let i = 0; i < totalNodes; i++) {
                const pos = nodePositions[i];
                if (pos && Math.hypot(mouseX - pos.x, mouseY - pos.y) < 14) {
                    hoveredNodeIdx = i;
                    break;
                }
            }
        }

        if (hoveredNodeIdx >= 0) {
            spotlightNodes.add(hoveredNodeIdx);
            const conns = brain.connections || [];
            for (const c of conns) {
                if (c.enabled) {
                    if (c.src === hoveredNodeIdx) spotlightNodes.add(c.tgt);
                    if (c.tgt === hoveredNodeIdx) spotlightNodes.add(c.src);
                }
            }
        }

        // Temporal Wave Progress (2.2s pulse sweeping from left to right)
        const sweepPeriod = 2200;
        const sweepPhase = (performance.now() % sweepPeriod) / sweepPeriod;
        const invSpan = 0.5 / Math.max(1, outX - inX);

        // 10-Tier Style-Bucketed Batched Path Rendering
        const BUCKETS = [
            { color: "rgba(248, 81, 73, 0.22)", width: 1.0 },
            { color: "rgba(248, 81, 73, 0.55)", width: 1.8 },
            { color: "rgba(248, 81, 73, 0.85)", width: 2.8 },
            { color: "rgba(255, 95, 85, 1.00)", width: 3.8 },
            { color: "rgba(63, 185, 80, 0.22)", width: 1.0 },
            { color: "rgba(63, 185, 80, 0.55)", width: 1.8 },
            { color: "rgba(63, 185, 80, 0.85)", width: 2.8 },
            { color: "rgba(80, 230, 100, 1.00)", width: 3.8 },
            { color: "rgba(248, 81, 73, 0.04)", width: 1.0 },
            { color: "rgba(63, 185, 80, 0.04)", width: 1.0 }
        ];

        const paths = Array.from({ length: 10 }, () => new Path2D());
        const hasLines = new Uint8Array(10);

        const connections = brain.connections || [];
        const currentVals = brain.currentValues;

        for (const conn of connections) {
            if (!conn.enabled || Math.abs(conn.weight) < this.minWeightThreshold) continue;

            const src = nodePositions[conn.src];
            const tgt = nodePositions[conn.tgt];
            if (!src || !tgt) continue;

            const connKey = `${conn.src}->${conn.tgt}`;
            const isFiltered = this.isFiltering && filterData && !filterData.activeConns.has(connKey);
            const isSpotlighted = (hoveredNodeIdx >= 0) && (conn.src === hoveredNodeIdx || conn.tgt === hoveredNodeIdx);
            const isGhosted = (hoveredNodeIdx >= 0 && !isSpotlighted) || isFiltered;

            let bucketIdx = 0;
            if (isGhosted) {
                bucketIdx = conn.weight >= 0 ? 9 : 8;
            } else {
                const absW = Math.abs(conn.weight);
                const srcAct = currentVals ? (currentVals[conn.src] || 0) : 0;
                const transmittedSignal = Math.abs(srcAct * conn.weight);

                // Zero-allocation polynomial bell wave pulse
                const connDepth = (src.x + tgt.x - 2 * inX) * invSpan;
                let d = Math.abs(connDepth - sweepPhase);
                if (d > 0.5) d = 1.0 - d;
                const waveBoost = d < 0.18 ? (1.0 - (d / 0.18) * (d / 0.18)) * 0.45 : 0;

                const effectiveW = (absW * 0.35) + (transmittedSignal * 0.85) + (isSpotlighted ? 0.5 : waveBoost * 0.35);
                let tier = 0;
                if (effectiveW >= 1.15) tier = 3;
                else if (effectiveW >= 0.68) tier = 2;
                else if (effectiveW >= 0.32) tier = 1;
                bucketIdx = (conn.weight >= 0 ? 4 : 0) + tier;
            }

            const p = paths[bucketIdx];
            hasLines[bucketIdx] = 1;

            if (conn.src === conn.tgt) {
                p.moveTo(src.x + 10, src.y - 12);
                p.arc(src.x, src.y - 12, 10, 0, Math.PI * 2);
            } else if (conn.src >= conn.tgt) {
                p.moveTo(src.x, src.y);
                p.quadraticCurveTo((src.x + tgt.x) / 2, Math.max(src.y, tgt.y) + 24, tgt.x, tgt.y);
            } else {
                p.moveTo(src.x, src.y);
                p.lineTo(tgt.x, tgt.y);
            }
        }

        // Interleaved Draw Order: Ghost -> Light -> Med -> Heavy -> Ultra
        const DRAW_ORDER = [8, 9, 0, 4, 1, 5, 2, 6, 3, 7];
        for (const b of DRAW_ORDER) {
            if (hasLines[b]) {
                ctx.strokeStyle = BUCKETS[b].color;
                ctx.lineWidth = BUCKETS[b].width;
                ctx.stroke(paths[b]);
            }
        }

        // Draw nodes with Frustum Culling
        for (let i = 0; i < totalNodes; i++) {
            const pos = nodePositions[i];
            if (!pos) continue;

            if (cardView && (pos.x < viewLeft - 40 || pos.x > viewRight + 40 || pos.y < viewTop - 20 || pos.y > viewBottom + 20)) continue;

            const act = brain.currentValues ? brain.currentValues[i] : 0;
            const isInput = i < numInputs;
            const isOutput = i >= numInputs && i < numInputs + numOutputs;
            const isFiltered = (this.isFiltering && filterData && !filterData.activeNodes.has(i)) ||
                               (hoveredNodeIdx >= 0 && !spotlightNodes.has(i));

            const localIdx = isInput ? i : (isOutput ? (i - numInputs) : (i - numInputs - numOutputs));
            this._drawNode(ctx, pos.x, pos.y, act, isInput, isOutput, localIdx, brain, isFiltered);
        }
    }

    _drawEEGHeatmapMode(ctx, brain, layout, filterData) {
        const { topPadding } = layout;
        const cardW = layout.netWidth || layout.width;
        const isDense = brain instanceof DenseNetwork || Boolean(brain.layerSizes);

        const numInputs = isDense ? (brain.layerSizes[0] || 0) : (brain.numInputs || 0);
        const numOutputs = isDense ? (brain.layerSizes[brain.layerSizes.length - 1] || 0) : (brain.numOutputs || 0);

        const stripY = topPadding + 14;
        const stripH = 96;
        const stripW = 54;

        // 1. Left Vertical Input Array Spectrogram Strip
        const inX = 14;
        const getInputVal = isDense
            ? (i) => brain.activations[0]?.[i] || 0
            : (i) => brain.currentValues?.[i] || 0;
        const getInputLabel = (i) => brain.inputLabels?.[i] || `I${i}`;

        this._drawVerticalHeatmap(ctx, inX, stripY, stripW, stripH, "INPUTS", numInputs, getInputVal, getInputLabel);

        // 2. Right Vertical Output Array Spectrogram Strip
        const outX = cardW - 14 - stripW;
        const getOutputVal = isDense
            ? (i) => brain.activations[brain.layerSizes.length - 1]?.[i] || 0
            : (i) => brain.currentValues?.[numInputs + i] || 0;
        const getOutputLabel = (i) => brain.outputLabels?.[i] || `O${i}`;

        this._drawVerticalHeatmap(ctx, outX, stripY, stripW, stripH, "OUTPUTS", numOutputs, getOutputVal, getOutputLabel);

        // 3. Center Area: Dual-Strip EEG Spectrogram HUD
        const hudX = inX + stripW + 16;
        const hudW = outX - 16 - hudX;

        // --- Strip 1: Live Spatial Cortex Depth Heatmap ---
        const topStripY = stripY;
        const topStripH = 34;

        ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.textAlign = "left";
        ctx.fillText("SPATIAL CORTEX SNAPSHOT (DEPTH 0 ──► L)", hudX, topStripY - 4);

        // Background box
        ctx.beginPath();
        ctx.roundRect(hudX, topStripY, hudW, topStripH, 4);
        ctx.fillStyle = "#161b22";
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Clip strictly inside the top strip inner bounds
        ctx.save();
        ctx.beginPath();
        ctx.rect(hudX + 1, topStripY + 1, hudW - 2, topStripH - 2);
        ctx.clip();

        let meanArousal = 0;

        if (isDense) {
            const layers = brain.layerSizes || [];
            const numLayers = layers.length;

            let totalSum = 0;
            let totalCount = 0;

            if (numLayers <= hudW) {
                // Slices are 1px or wider
                const sliceW = (hudW - 2) / Math.max(numLayers, 1);
                for (let l = 0; l < numLayers; l++) {
                    const acts = brain.activations[l] || [];
                    const sum = acts.reduce((a, b) => a + Math.abs(b), 0);
                    const avg = acts.length > 0 ? (sum / acts.length) : 0;
                    totalSum += sum;
                    totalCount += acts.length;

                    const sx = hudX + 1 + l * sliceW;
                    const sw = Math.max(1, sliceW - (numLayers < 24 ? 1 : 0));

                    ctx.fillStyle = this._getHeatColor(avg);
                    ctx.fillRect(sx, topStripY + 1, sw, topStripH - 2);
                }
            } else {
                // High density pixel binning (e.g. 500 layers in 200px)
                const innerW = hudW - 2;
                for (let px = 0; px < innerW; px++) {
                    const startL = Math.floor((px / innerW) * numLayers);
                    const endL = Math.min(numLayers, Math.floor(((px + 1) / innerW) * numLayers) + 1);

                    let binSum = 0;
                    let binCount = 0;
                    for (let l = startL; l < endL; l++) {
                        const acts = brain.activations[l] || [];
                        for (let k = 0; k < acts.length; k++) {
                            const mag = Math.abs(acts[k]);
                            binSum += mag;
                            binCount++;
                            totalSum += mag;
                            totalCount++;
                        }
                    }
                    const avg = binCount > 0 ? (binSum / binCount) : 0;
                    ctx.fillStyle = this._getHeatColor(avg);
                    ctx.fillRect(hudX + 1 + px, topStripY + 1, 1, topStripH - 2);
                }
            }

            meanArousal = totalCount > 0 ? (totalSum / totalCount) : 0;
        } else {
            // Sparse network: accurately slice across totalNodes (Inputs -> Outputs -> Hidden)
            const totalNodes = brain.totalNodes || (brain.numInputs + brain.numOutputs);
            let totalSum = 0;

            if (totalNodes <= hudW) {
                const sliceW = (hudW - 2) / Math.max(totalNodes, 1);
                for (let i = 0; i < totalNodes; i++) {
                    const rawAct = brain.currentValues ? brain.currentValues[i] : 0;
                    const act = Math.abs(rawAct);
                    totalSum += act;
                    const sx = hudX + 1 + i * sliceW;
                    const sw = Math.max(1, sliceW - (totalNodes < 24 ? 1 : 0));

                    ctx.fillStyle = this._getHeatColor(act);
                    ctx.fillRect(sx, topStripY + 1, sw, topStripH - 2);
                }
            } else {
                // High density sparse binning
                const innerW = hudW - 2;
                for (let px = 0; px < innerW; px++) {
                    const startN = Math.floor((px / innerW) * totalNodes);
                    const endN = Math.min(totalNodes, Math.floor(((px + 1) / innerW) * totalNodes) + 1);

                    let binSum = 0;
                    let binCount = 0;
                    for (let n = startN; n < endN; n++) {
                        const act = brain.currentValues ? Math.abs(brain.currentValues[n]) : 0;
                        binSum += act;
                        binCount++;
                        totalSum += act;
                    }
                    const avg = binCount > 0 ? (binSum / binCount) : 0;
                    ctx.fillStyle = this._getHeatColor(avg);
                    ctx.fillRect(hudX + 1 + px, topStripY + 1, 1, topStripH - 2);
                }
            }
            meanArousal = totalNodes > 0 ? (totalSum / totalNodes) : 0;
        }

        ctx.restore();

        // --- Strip 2: Rolling Temporal Brainwave Waveform ---
        const botStripY = topStripY + topStripH + 20;
        const botStripH = 42;

        ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.textAlign = "left";
        ctx.fillText(`ROLLING BRAINWAVE (3s HISTORY | AROUSAL: ${(meanArousal * 100).toFixed(0)}%)`, hudX, botStripY - 4);

        // Background box & grid lines
        ctx.beginPath();
        ctx.roundRect(hudX, botStripY, hudW, botStripH, 4);
        ctx.fillStyle = "#0d1117";
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();

        // 50% dashed baseline
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(hudX, botStripY + botStripH / 2);
        ctx.lineTo(hudX + hudW, botStripY + botStripH / 2);
        ctx.strokeStyle = "rgba(48, 54, 61, 0.8)";
        ctx.stroke();
        ctx.setLineDash([]);

        // Ring Buffer History Processing
        const historyLen = 100;
        let ring = this.historyRing.get(brain);
        if (!ring) {
            ring = { buffer: new Float32Array(historyLen), head: 0 };
            this.historyRing.set(brain, ring);
        }

        ring.buffer[ring.head] = meanArousal;
        ring.head = (ring.head + 1) % historyLen;

        // Draw glowing wave spline
        ctx.save();
        ctx.beginPath();
        ctx.rect(hudX + 1, botStripY + 1, hudW - 2, botStripH - 2);
        ctx.clip();

        ctx.beginPath();
        for (let i = 0; i < historyLen; i++) {
            const bufferIdx = (ring.head + i) % historyLen;
            const val = ring.buffer[bufferIdx] || 0;
            const x = hudX + (i / (historyLen - 1)) * hudW;
            const y = botStripY + botStripH - 2 - val * (botStripH - 6);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = "#2ec4b6";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Area gradient fill under wave
        ctx.lineTo(hudX + hudW, botStripY + botStripH);
        ctx.lineTo(hudX, botStripY + botStripH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, botStripY, 0, botStripY + botStripH);
        grad.addColorStop(0, "rgba(46, 196, 182, 0.35)");
        grad.addColorStop(1, "rgba(46, 196, 182, 0.0)");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
    }

    _drawVerticalHeatmap(ctx, x, y, width, height, title, count, getValueFn, getLabelFn) {
        // 1. Header
        ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.textAlign = "left";
        ctx.fillText(`${title} (${count})`, x, y - 4);

        // 2. Outer container
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 4);
        ctx.fillStyle = "#161b22";
        ctx.fill();
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 1;
        ctx.stroke();

        const barW = width - 2;
        const innerH = height - 2;

        // 3. Heatmap Bar Rendering (with high-density downsampling for arbitrary bounds)
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, barW, innerH);
        ctx.clip();

        let peakVal = 0;
        let peakIdx = 0;
        let totalSum = 0;

        if (count <= 0) {
            // Empty
        } else if (count <= innerH) {
            // Slices are 1px or taller
            const sliceH = innerH / Math.max(count, 1);
            for (let i = 0; i < count; i++) {
                const val = Math.abs(getValueFn(i));
                if (val > peakVal) {
                    peakVal = val;
                    peakIdx = i;
                }
                totalSum += val;

                const sy = y + 1 + i * sliceH;
                const sh = Math.max(1, sliceH - (count < 24 ? 1 : 0));

                ctx.fillStyle = this._getHeatColor(val);
                ctx.fillRect(x + 1, sy, barW, sh);
            }
        } else {
            // High-density vertical pixel binning (e.g. 500, 10,000, 100,000+ channels)
            for (let py = 0; py < innerH; py++) {
                const startN = Math.floor((py / innerH) * count);
                const endN = Math.min(count, Math.floor(((py + 1) / innerH) * count) + 1);

                let binSum = 0;
                let binCount = 0;
                for (let n = startN; n < endN; n++) {
                    const val = Math.abs(getValueFn(n));
                    binSum += val;
                    binCount++;
                    totalSum += val;
                    if (val > peakVal) {
                        peakVal = val;
                        peakIdx = n;
                    }
                }

                const avg = binCount > 0 ? (binSum / binCount) : 0;
                ctx.fillStyle = this._getHeatColor(avg);
                ctx.fillRect(x + 1, y + 1 + py, barW, 1);
            }
        }

        ctx.restore();

        // 4. Peak Telemetry Subtext below box
        ctx.font = "8px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.textAlign = "left";
        ctx.fillText(`Pk:#${peakIdx}`, x, y + height + 10);
        ctx.fillStyle = peakVal > 0.5 ? "#58a6ff" : "#6e7681";
        ctx.fillText(`[${peakVal.toFixed(2)}]`, x + 30, y + height + 10);
    }

    _getHeatColor(ratio) {
        const norm = Math.max(0, Math.min(1, ratio));
        if (norm < 0.25) {
            const t = norm / 0.25;
            return `rgb(${Math.floor(13 + 14 * t)}, ${Math.floor(27 + 45 * t)}, ${Math.floor(42 + 60 * t)})`;
        } else if (norm < 0.6) {
            const t = (norm - 0.25) / 0.35;
            return `rgb(${Math.floor(27 + 19 * t)}, ${Math.floor(72 + 124 * t)}, ${Math.floor(102 + 80 * t)})`;
        } else if (norm < 0.85) {
            const t = (norm - 0.6) / 0.25;
            return `rgb(${Math.floor(46 + 209 * t)}, ${Math.floor(196 - 37 * t)}, ${Math.floor(182 - 154 * t)})`;
        } else {
            const t = (norm - 0.85) / 0.15;
            return `rgb(255, ${Math.floor(159 + 96 * t)}, ${Math.floor(28 + 227 * t)})`;
        }
    }

    _drawFlowMode(ctx, brain, layout, filterData) {
        const { leftMargin, colSpacing, rowSpacing, topPadding } = layout;
        const isDense = brain instanceof DenseNetwork || Boolean(brain.layerSizes);
        const inX = leftMargin;
        const midX = leftMargin + colSpacing;
        const outX = leftMargin + 2 * colSpacing;

        const numInputs = isDense ? brain.layerSizes[0] : brain.numInputs;
        const numOutputs = isDense ? brain.layerSizes[brain.layerSizes.length - 1] : brain.numOutputs;
        const maxIONodes = Math.max(numInputs, numOutputs, 1);
        const centerY = topPadding + (maxIONodes * rowSpacing) / 2;

        // Draw Central Processing Core Hub
        ctx.beginPath();
        ctx.arc(midX, centerY, 28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(31, 111, 235, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "#58a6ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#58a6ff";
        ctx.textAlign = "center";
        ctx.fillText("CORE", midX, centerY - 4);
        ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#8b949e";
        ctx.fillText("PROCESSOR", midX, centerY + 8);

        // Draw Inputs with Thick Flow Tubes into Hub
        const inStartY = topPadding + ((maxIONodes - numInputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numInputs; i++) {
            const y = inStartY + i * rowSpacing;
            const act = isDense ? (brain.activations[0]?.[i] || 0) : (brain.currentValues?.[i] || 0);
            const isFiltered = this.isFiltering && filterData && !filterData.activeNodes.has(isDense ? `0_${i}` : i);

            // Flow cable
            ctx.beginPath();
            ctx.moveTo(inX + 10, y);
            ctx.quadraticCurveTo((inX + midX) / 2, y, midX - 28, centerY);
            ctx.strokeStyle = isFiltered ? "rgba(63, 185, 80, 0.05)" : `rgba(63, 185, 80, ${Math.max(0.15, act * 0.8)})`;
            ctx.lineWidth = isFiltered ? 1 : Math.max(1.5, act * 5);
            ctx.stroke();

            this._drawNode(ctx, inX, y, act, true, false, i, brain, isFiltered);
        }

        // Draw Outputs with Thick Flow Tubes out of Hub
        const outStartY = topPadding + ((maxIONodes - numOutputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numOutputs; i++) {
            const y = outStartY + i * rowSpacing;
            const act = isDense
                ? (brain.activations[brain.layerSizes.length - 1]?.[i] || 0)
                : (brain.currentValues?.[numInputs + i] || 0);
            const isFiltered = this.isFiltering && filterData && !filterData.activeNodes.has(isDense ? `${brain.layerSizes.length - 1}_${i}` : numInputs + i);

            // Flow cable
            ctx.beginPath();
            ctx.moveTo(midX + 28, centerY);
            ctx.quadraticCurveTo((midX + outX) / 2, y, outX - 10, y);
            ctx.strokeStyle = isFiltered ? "rgba(248, 81, 73, 0.05)" : `rgba(248, 81, 73, ${Math.max(0.15, act * 0.8)})`;
            ctx.lineWidth = isFiltered ? 1 : Math.max(1.5, act * 5);
            ctx.stroke();

            this._drawNode(ctx, outX, y, act, false, true, i, brain, isFiltered);
        }
    }

    _drawIOMode(ctx, brain, layout, filterData) {
        const { leftMargin, colSpacing, rowSpacing, topPadding } = layout;
        const isDense = brain instanceof DenseNetwork || Boolean(brain.layerSizes);
        const inX = leftMargin;
        const outX = leftMargin + colSpacing;

        const numInputs = isDense ? brain.layerSizes[0] : brain.numInputs;
        const numOutputs = isDense ? brain.layerSizes[brain.layerSizes.length - 1] : brain.numOutputs;
        const maxIONodes = Math.max(numInputs, numOutputs, 1);

        // Draw Inputs
        const inStartY = topPadding + ((maxIONodes - numInputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numInputs; i++) {
            const y = inStartY + i * rowSpacing;
            const act = isDense ? (brain.activations[0]?.[i] || 0) : (brain.currentValues?.[i] || 0);
            const isFiltered = this.isFiltering && filterData && !filterData.activeNodes.has(isDense ? `0_${i}` : i);
            this._drawNode(ctx, inX, y, act, true, false, i, brain, isFiltered);
        }

        // Draw Outputs
        const outStartY = topPadding + ((maxIONodes - numOutputs) * rowSpacing) / 2 + rowSpacing / 2;
        for (let i = 0; i < numOutputs; i++) {
            const y = outStartY + i * rowSpacing;
            const act = isDense
                ? (brain.activations[brain.layerSizes.length - 1]?.[i] || 0)
                : (brain.currentValues?.[numInputs + i] || 0);
            const isFiltered = this.isFiltering && filterData && !filterData.activeNodes.has(isDense ? `${brain.layerSizes.length - 1}_${i}` : numInputs + i);
            this._drawNode(ctx, outX, y, act, false, true, i, brain, isFiltered);
        }

        // Minimal bridge arrow in center
        ctx.beginPath();
        const midX = (inX + outX) / 2;
        const midY = topPadding + (maxIONodes * rowSpacing) / 2;
        ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#30363d";
        ctx.textAlign = "center";
        ctx.fillText("───►", midX, midY + 4);
    }

    _drawNode(ctx, x, y, activation, isInput, isOutput, index, brain, isFiltered) {
        const radius = 8;
        const normAct = Math.max(0, Math.min(1, Math.abs(activation)));

        ctx.save();
        if (isFiltered) {
            ctx.globalAlpha = 0.12;
        }

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
        const inLabels = brain.inputLabels || brain._inputLabels || brain.entity?.inputLabels;
        const outLabels = brain.outputLabels || brain._outputLabels || brain.entity?.outputLabels;
        if (isInput) {
            labelText = inLabels?.[index] || `In ${index}`;
        } else if (isOutput) {
            labelText = outLabels?.[index] || `Out ${index}`;
        } else {
            labelText = `H ${index}`;
        }

        const valStr = activation.toFixed(2);

        ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = isFiltered ? "#484f58" : "#e6edf3";

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

        ctx.restore();
    }
}
