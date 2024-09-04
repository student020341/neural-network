// data
//
//

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

const box = {
    x: 20,
    y: 30,
    w: 40,
};

// functions
//
//

// render
const render = (_, cw, ch) => {
    // clear what was drawn before
    ctx.clearRect(0, 0, cw, ch);

    // draw white box outline
    ctx.strokeStyle = "white";
    ctx.strokeRect(box.x, box.y, box.w, box.w);
};

// start

loop([render]);
