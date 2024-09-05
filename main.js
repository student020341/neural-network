// data
//
//

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

const hopper = new Hopper(40, 40, {w: canvas.width, h: canvas.height});
resizeCallbacks.push((c) => hopper.onResize(c));

// functions
//
//

// logic
const logic = (dt) => {
    hopper.act(dt);
}

// render
const render = (_, cw, ch) => {
    // clear what was drawn before
    ctx.clearRect(0, 0, cw, ch);

    // draw creatures
    hopper.draw(ctx);
};

// start

loop([render, logic]);
