// data
//
//

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

const bounds = getWorldBounds();

const fish = new TurnFish(100, 100, bounds);
resizeCallbacks.push((c) => fish.onResize(c));

// functions
//
//

// Real-time Multi-Brain Visualizer & Performance Telemetry
const fpsMeter = new FPSMeter({ position: 'bottom-right' });
const visualizer = new BrainVisualizer({ width: 480, height: 320, open: false });
// visualizer.track("Fish", fish, (f) => f.brain);
// visualizer.track("Hopper", hopper, (h) => h.brain);
// visualizer.track("Flower", flower, (fl) => fl.brain);

// Click creature on canvas to inspect solely, or double click to restore all 3
canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (Math.hypot(clickX - fish.x, clickY - fish.y) < 60) {
        visualizer.inspect("Fish", fish, (f) => f.brain);
    }
});

// logic
const logic = (dt) => {
    fish.act(dt);
};

// render
const render = (_, cw, ch) => {
    // clear what was drawn before
    ctx.clearRect(0, 0, cw, ch);

    // draw creatures
    fish.draw(ctx);
};

// start

loop([logic, render]);
