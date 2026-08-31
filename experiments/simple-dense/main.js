// data
//
//

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

const bounds = getWorldBounds();

const hopper = new Hopper(10, 40, bounds);
resizeCallbacks.push((c) => hopper.onResize(c));

const flower = new Flower(120, bounds);
resizeCallbacks.push((c) => flower.onResize(c));

const fish = new Fish(100, 100, bounds);
resizeCallbacks.push((c) => fish.onResize(c));

// functions
//
//

// Real-time Multi-Brain Visualizer & Performance Telemetry
const fpsMeter = new FPSMeter({ position: 'bottom-right' });
const visualizer = new BrainVisualizer({ width: 480, height: 320 });
visualizer.track("Fish", fish, (f) => f.brain);
visualizer.track("Hopper", hopper, (h) => h.brain);
visualizer.track("Flower", flower, (fl) => fl.brain);

// Click creature on canvas to inspect solely, or double click to restore all 3
canvas.addEventListener("click", (e) => {
    const mouseWorld = screenToWorld(e.clientX, e.clientY);
    const clickX = mouseWorld.x;
    const clickY = mouseWorld.y;

    if (Math.hypot(clickX - fish.x, clickY - fish.y) < 60) {
        visualizer.inspect("Fish", fish, (f) => f.brain);
    } else if (Math.hypot(clickX - hopper.x, clickY - hopper.y) < 60) {
        visualizer.inspect("Hopper", hopper, (h) => h.brain);
    } else if (Math.hypot(clickX - flower.x, clickY - (flower.y - flower.size)) < 70) {
        visualizer.inspect("Flower", flower, (fl) => fl.brain);
    }
});

canvas.addEventListener("dblclick", () => {
    visualizer.track("Fish", fish, (f) => f.brain);
    visualizer.track("Hopper", hopper, (h) => h.brain);
    visualizer.track("Flower", flower, (fl) => fl.brain);
});

// logic
const logic = (dt) => {
    hopper.act(dt);
    flower.act(dt);
    fish.act(dt);
}

// render
const render = (_, cw, ch) => {
    // clear what was drawn before
    ctx.clearRect(0, 0, cw, ch);

    // draw creatures
    hopper.draw(ctx);
    flower.draw(ctx);
    fish.draw(ctx);
};

// start

loop([logic, render]);
