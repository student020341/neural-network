// a flower thing
class Flower {
    constructor(x, bounds) {
        this.x = x;
        this.y = bounds.h;
        this.bounds = bounds;

        this.size = 10;
        this.maxSize = 100;

        this.acc = 0;
        this.accMax = 0.2;

        this.starPos = 0;
        this.starPosMax = 50;
        this.starDir = 1;

        this.brainScramble = 0;
        this.brainScrambleMax = 4;

        // nn related properties
        this.inputs = [
            0, // consider star distance
        ];

        this.outputs = [
            0, // adjust size
        ];

        this.brain = new Network([
            this.inputs.length,
            Math.max(this.inputs.length, this.outputs.length) + 1,
            this.outputs.length
        ]);
    }

    onResize(canvas) {
        this.bounds = { w: canvas.width, h: canvas.height };
        this.y = this.bounds.h;
    }

    think() {
        // consider distance to sun
        this.inputs[0] = this.starPos / this.starPosMax;

        // grow or shrink
        this.outputs = this.brain.activate(this.inputs);
    }

    act(dt) {
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();

            this.starPos = clamp(this.starPos, 0, this.starPosMax);
            if (Math.random() > 0.6) {
                this.starDir *= -1;
            }
        }

        // randomize star position
        this.starPos += dt * 10 * this.starDir;

        // scramble brains
        this.brainScramble += dt;
        if (this.brainScramble >= this.brainScrambleMax) {
            this.brainScramble = 0;
            this.brain = new Network([
                this.inputs.length,
                Math.max(this.inputs.length, this.outputs.length) + 1,
                this.outputs.length
            ]);
            this.think();
        }

        // grow!
        if (this.outputs[0] > 0.55) {
            this.size += dt * 10;
        } else if (this.outputs[0] < 0.45) {
            this.size -= dt * 10;
        }
        this.size = clamp(this.size, 10, this.maxSize);
    }

    /**
     * draw flower
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(this.x, this.y - this.size, 20, this.size);

        // draw flower head
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(this.x - 4, this.y - this.size - 28, 28, 28);
        ctx.fillStyle = "#ff00bf";
        ctx.fillRect(this.x + 2, this.y - this.size - 20, 16, 14);

        // draw star above head
        ctx.fillStyle = "yellow";
        ctx.fillRect(this.x, this.y - this.size - 60 - this.starPos, 20, 20);

        // draw neural net
        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        // draw input
        ctx.fillRect(this.x + 30, this.y - this.size - (40 * this.inputs[0]), 4, this.inputs[0] * 40);
        ctx.strokeRect(this.x + 30, this.y - this.size - 40, 4, 40);
        // draw output
        ctx.fillRect(this.x + 38, this.y - this.size - (40 * this.outputs[0]), 4, this.outputs[0] * 40);
        ctx.strokeRect(this.x + 38, this.y - this.size - 40, 4, 40);
    }
}
