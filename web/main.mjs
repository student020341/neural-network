import loop from "./src/loop.mjs";
import Mob from "./src/creature.mjs";

// dev only
new EventSource("/esbuild").addEventListener("change", e => {
    location.reload();
});

// data
const mobs = [];
for (let i = 0; i < 50; i++) {
    mobs.push(new Mob(Math.random() * 800, Math.random() * 800, 10));
}

const point = { x: 100, y: 100, w: 10 };

// canvas
/** @type HTMLCanvasElement */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// logic
const logic = (dt) => {
    mobs.forEach(mob => mob.think(dt, point));
};

// render
const render = (dt) => {
    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, 800, 800);

    // draw dangers
    ctx.fillStyle = "red";
    ctx.fillRect(point.x, point.y, point.w, point.w);

    // draw mobs on top
    mobs.forEach(mob => mob.draw(ctx));
};

// loop
loop(logic, render);
