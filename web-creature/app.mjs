import Fish from "./src/fish.mjs";

//
// world data related
//
/** @type Fish[] */
let fish = [];

//
// dom related
//
/** @type HTMLCanvasElement  */
const canvas = document.getElementById("canvas");
/** @type CanvasRenderingContext2D */
const ctx = canvas.getContext("2d");
/** @type HTMLButtonElement */
const resetButton = document.getElementById("reset");

/** @type HTMLInputElement */
const domFishNum = document.getElementById("num_fish");
const domFishNumLabel = document.getElementById("num_fish_label")
/** @type HTMLInputElement */
const domFishBrain = document.getElementById("brain_shape");
/** @type HTMLInputElement */
const domTPS = document.getElementById("thought_delay");
const domRandomizeBrain = document.getElementById("random_brain");
const domBrainContainer = document.getElementById("brain-container");
const domBrainCanvas = document.getElementById("brain-canvas");
/** @type CanvasRenderingContext2D */
const brainCtx = domBrainCanvas.getContext("2d");

// event binding
let spawning = false; // outside control var
let requestedFishCount = 0;
let curFishCount = 0;
const reset = async () => {
    if (spawning) {
        return;
    }
    spawning = true;
    [domFishNum, domFishBrain, domTPS, resetButton].forEach(e => { e.disabled = true; });
    fish = [];
    render();
    const cFish = Number(domFishNum.value);

    const cThoughts = Number(domTPS.value);
    let to_spawn = cFish;
    requestedFishCount = cFish;
    curFishCount = 0;

    const brainArr = domFishBrain.value.replace(/\s/g, "").split(",");
    let hidden = [];
    if (brainArr.some(v => isNaN(v))) {
        hidden = [3, 3];
        domFishBrain.value = hidden.join(", ");
    } else {
        hidden = brainArr.map(v => Number(v));
    }

    // async spawn for performance
    while (to_spawn > 0) {
        fish.push(new Fish(50 + Math.random() * 30, hidden, cThoughts));
        to_spawn--;
        curFishCount++;
    }

    spawning = false;
    [domFishNum, domTPS, domFishBrain, resetButton].forEach(e => { e.disabled = false; });
};
resetButton.addEventListener("click", () => {
    reset();
});

domFishNum.addEventListener("input", () => {
    domFishNumLabel.innerText = domFishNum.value;
});

domRandomizeBrain.addEventListener("click", () => {
    domFishBrain.value = Array.from(new Array(Math.floor(1 + Math.random() * 4))).map(() => 1 + Math.floor(Math.random() * 15)).join(", ");
});

canvas.addEventListener("click", ev => {
    const {clientX: x, clientY: y} = ev;
    const grab_fish = fish.find(f => {
        if (x < f.position.x) {
            return false;
        }
        if (y < f.position.y) {
            return false;
        }
        if (x > f.position.x + f.size) {
            return false;
        }
        if (y > f.position.y + f.size) {
            return false;
        }

        return true;
    });

    updateFishTracking(grab_fish);
});

// something
//
//
let tracked_fish = null;
const updateFishTracking = (f) => {
    if (!f) {
        tracked_fish = null;
        domBrainContainer.classList.remove("show");
        brainCtx.clearRect(0, 0, 800, 600);
        return;
    }
    domBrainContainer.classList.add("show");

    tracked_fish = f;
};

//
// loop related
//
const render = () => {
    // clear
    ctx.clearRect(0, 0, 800, 600);

    // draw fish
    fish.forEach(f => f.draw(ctx));

    // draw fish brain
    if (tracked_fish) {
        brainCtx.clearRect(0, 0, 800, 600);
        // neural network
        // TODO draw synapse
        brainCtx.fillStyle = "white";
        const nw = 800 / tracked_fish.brain.layers.length;
        const nh = 600 / tracked_fish.brain.layers.reduce((acc, n) => n.length > acc ? n.length : acc, 0);
        tracked_fish.brain.layers.forEach((layer, layerIndex) => {
            layer.forEach((id, index) => {
                const led = 255 - (tracked_fish.brain.neurons[id].output * 250);
                brainCtx.fillStyle = `hsl(${led}, 100%, 50%)`;
                brainCtx.fillRect(layerIndex * nw, index * nh, nw * tracked_fish.brain.neurons[id].output, nh);
            });
        });
    }
};

const logic = (dt) => {
    // fish think
    const to_remove = [];
    fish.forEach((f, i) => {
        f.doSomething(dt, { x: 0, y: 0 });
        if (f.flag_dead) {
            to_remove.unshift(i);
        }
    });

    // remove dead fish
    to_remove.forEach(index => {
        fish.splice(index, 1);
    });
};

// loop
async function loop() {
    while (true) {
        let t2 = performance.now();
        let p = new Promise((resolve) =>
            requestAnimationFrame((t1) => {
                // time delta in seconds
                let dt = (t1 - t2) / 1000;
                // do not interpolate latency greater than 1 second
                if (dt > 1 || spawning) {
                    resolve();
                    return;
                }

                // stuff
                logic(dt);
                render();

                resolve();
            })
        );

        await p;
    }
}
loop();

// big TODO - switch from chaos network to dense hidden or create a switch so both can be tested
// TODO represent more neural states visually
// TODO performance diagnostic
// better color representation - maybe having 3 major colors where each rgb value is made of adding other values together
// neural network vis when click on fish
