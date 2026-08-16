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
