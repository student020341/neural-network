let resizeCallbacks = [];

/** @type HTMLCanvasElement */
const canvas = document.getElementById("canvas");

/** @type CanvasRenderingContext2D */
const canvasContext2D = canvas.getContext("2d");

// Virtual World Space config
let world = {
    w: 0, // 0 = match window width in CSS pixels
    h: 0, // 0 = match window height in CSS pixels
    mode: 'fill', // 'fill' (stretch) or 'fit' (uniform aspect ratio)
    showOutline: true // Draw 1px white outline when world is letterboxed in 'fit' mode
};

const getWorldBounds = () => {
    const w = world.w || window.innerWidth;
    const h = world.h || window.innerHeight;
    return { width: w, height: h, w: w, h: h };
};

let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;

const applyTransform = () => {
    // Cap devicePixelRatio to 1.5 on high-DPI mobile devices to prevent GPU rasterization fill-rate bottlenecks
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    // Physical pixel dimensions for high-DPI / Retina sharpness
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";

    const targetW = world.w || cw;
    const targetH = world.h || ch;

    if (world.mode === 'fill' || !world.w || !world.h) {
        // Stretch to fill screen
        const scaleX = (cw * dpr) / targetW;
        const scaleY = (ch * dpr) / targetH;
        currentScale = Math.min(scaleX, scaleY);
        currentOffsetX = 0;
        currentOffsetY = 0;
        canvasContext2D.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    } else {
        // Uniform fit: preserves square aspect ratio, centered
        const scale = Math.min((cw * dpr) / targetW, (ch * dpr) / targetH);
        currentScale = scale;
        currentOffsetX = ((cw * dpr) - targetW * scale) / 2;
        currentOffsetY = ((ch * dpr) - targetH * scale) / 2;
        canvasContext2D.setTransform(scale, 0, 0, scale, currentOffsetX, currentOffsetY);
    }
};

/**
 * Converts screen/client coordinates (e.g. from mouse events) into virtual world coordinates.
 * @param {number} clientX 
 * @param {number} clientY 
 * @returns {{x: number, y: number}}
 */
const screenToWorld = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return {
        x: (px - currentOffsetX) / currentScale,
        y: (py - currentOffsetY) / currentScale
    };
};

/**
 * Draw 1px white outline around the virtual world bounds if letterboxed.
 * @param {CanvasRenderingContext2D} [ctx=canvasContext2D]
 */
const drawWorldBounds = (ctx = canvasContext2D) => {
    if (world.mode === 'fit' && world.w > 0 && world.h > 0) {
        ctx.save();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1 / currentScale; // Exact 1 physical pixel width
        ctx.strokeRect(0, 0, world.w, world.h);
        ctx.restore();
    }
};

/**
 * Configure virtual world resolution and scaling mode.
 * @param {number} w Virtual width (e.g. 100 or 1000, 0 for 1:1 window size)
 * @param {number} h Virtual height (e.g. 100 or 1000, 0 for 1:1 window size)
 * @param {'fill' | 'fit'} [mode='fill'] Scaling mode: 'fill' (stretch) or 'fit' (preserve aspect ratio)
 * @param {boolean} [showOutline=true] Whether to draw a 1px outline when letterboxed
 */
const setWorld = (w = 0, h = 0, mode = 'fill', showOutline = true) => {
    world.w = w;
    world.h = h;
    world.mode = mode;
    world.showOutline = showOutline;
    applyTransform();
    const bounds = getWorldBounds();
    resizeCallbacks.forEach(fn => fn(bounds));
};

const resize_canvas = () => {
    applyTransform();
};

window.addEventListener("resize", () => {
    applyTransform();
    const bounds = getWorldBounds();
    resizeCallbacks.forEach(fn => fn(bounds));
});
applyTransform();

// High-performance game loop (zero garbage collection, accurate dt)
const loop = (calls) => {
    let lastTime = performance.now();

    const tick = (now) => {
        // Delta time in seconds, clamped to max 0.1s to avoid huge physics jumps when tab is inactive
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        const bounds = getWorldBounds();
        for (let i = 0; i < calls.length; i++) {
            calls[i](dt, bounds.width, bounds.height);
        }

        // Draw 1px white outline if the world space is letterboxed
        if (world.showOutline) {
            drawWorldBounds();
        }

        requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
};
