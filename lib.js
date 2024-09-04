
/**
 * 
 * @param {HTMLCanvasElement} c 
 */
const resize_canvas = (c) => {
    // Get the window width and height
    var w = window.innerWidth;
    var h = window.innerHeight;

    // Set the canvas width and height
    c.width = w;
    c.height = h;
};

/**@type HTMLCanvasElement */
const canvas = document.getElementById("canvas");

/** @type CanvasRenderingContext2D */
const canvasContext2D = canvas.getContext("2d");

// event binding
//
//
window.addEventListener("resize", () => {
    resize_canvas(canvas);
});
resize_canvas(canvas);

// loop related
//
//

// invoke from another function, passing callbacks
const loop = async (calls) => {
    while (true) {
        let t2 = performance.now();
        let p = new Promise((resolve) =>
            requestAnimationFrame((t1) => {
                // time delta in seconds
                let dt = (t1 - t2) / 1000;
                // do not interpolate latency greater than 1 second
                if (dt > 1) {
                    resolve();
                    return;
                }

                // callbacks receive delta time and canvas dimensions
                calls.forEach(fn => fn(dt, canvas.width, canvas.height));

                resolve();
            })
        );

        await p;
    }
};
