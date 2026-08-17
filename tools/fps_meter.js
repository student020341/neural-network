/**
 * FPSMeter - Lightweight, zero-dependency HTML5 Canvas Performance Telemetry Widget
 * 
 * Usage:
 *   const meter = new FPSMeter({ position: 'top-left' });
 */
class FPSMeter {
    /**
     * @param {Object} [options]
     * @param {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'} [options.position='top-left']
     * @param {boolean} [options.autoStart=true]
     */
    constructor(options = {}) {
        this.position = options.position || 'top-left';
        this.isOpen = true;

        // Frame timing state
        this.frames = 0;
        this.fps = 60;
        this.frameTime = 16.6;
        this.lastTime = performance.now();
        this.lastFpsUpdate = performance.now();

        // 60-frame history ring buffer
        this.history = new Float32Array(60).fill(60);
        this.historyHead = 0;

        this._createDOM();
        if (options.autoStart !== false) {
            this.start();
        }
    }

    _createDOM() {
        if (!document.getElementById("fps-meter-styles")) {
            const style = document.createElement("style");
            style.id = "fps-meter-styles";
            style.textContent = `
                .fps-meter-badge {
                    position: fixed;
                    z-index: 99999;
                    background: rgba(13, 17, 23, 0.9);
                    backdrop-filter: blur(8px);
                    border: 1px solid #30363d;
                    border-radius: 6px;
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
                    user-select: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                }
                .fps-meter-top-left { top: 12px; left: 12px; }
                .fps-meter-top-right { top: 12px; right: 12px; }
                .fps-meter-bottom-left { bottom: 12px; left: 12px; }
                .fps-meter-bottom-right { bottom: 12px; right: 12px; }

                .fps-meter-readout {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .fps-meter-val {
                    font-size: 13px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    line-height: 1.1;
                }
                .fps-meter-ms {
                    font-size: 9px;
                    color: #8b949e;
                    font-variant-numeric: tabular-nums;
                }
                .fps-meter-sparkline {
                    width: 50px;
                    height: 20px;
                    display: block;
                }
            `;
            document.head.appendChild(style);
        }

        this.container = document.createElement("div");
        this.container.className = `fps-meter-badge fps-meter-${this.position}`;
        this.container.innerHTML = `
            <div class="fps-meter-readout">
                <span class="fps-meter-val" id="fps-val" style="color: #3fb950;">60 FPS</span>
                <span class="fps-meter-ms" id="fps-ms">16.6 ms</span>
            </div>
            <canvas class="fps-meter-sparkline" id="fps-spark" width="50" height="20"></canvas>
        `;
        document.body.appendChild(this.container);

        this.valEl = this.container.querySelector("#fps-val");
        this.msEl = this.container.querySelector("#fps-ms");
        this.canvas = this.container.querySelector("#fps-spark");
        this.ctx = this.canvas.getContext("2d");
    }

    start() {
        const loop = (now) => {
            const delta = now - this.lastTime;
            this.lastTime = now;
            this.frames++;

            this.frameTime = delta;

            if (now - this.lastFpsUpdate >= 250) {
                this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsUpdate));
                this.frames = 0;
                this.lastFpsUpdate = now;

                this.history[this.historyHead] = this.fps;
                this.historyHead = (this.historyHead + 1) % 60;

                this._render();
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    _render() {
        if (!this.valEl || !this.msEl) return;

        // Color coding
        let color = "#3fb950"; // Green >= 55
        if (this.fps < 30) {
            color = "#f85149"; // Red < 30
        } else if (this.fps < 55) {
            color = "#e3b341"; // Amber 30-54
        }

        this.valEl.textContent = `${this.fps} FPS`;
        this.valEl.style.color = color;
        this.msEl.textContent = `${this.frameTime.toFixed(1)} ms`;

        // Render sparkline
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
            const idx = (this.historyHead + i) % 60;
            const val = this.history[idx] || 0;
            const x = (i / 59) * w;
            const y = h - (Math.min(60, val) / 60) * (h - 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
}
