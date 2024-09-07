// a fish thing
class Fish {
    constructor(x, y, bounds) {
        this.x = x;
        this.y = y;
        this.bounds = bounds;

        this.acc = 0;
        this.accMax = 0.33;
        this.dir = 1;
        this.size = 32;
        this.brainScramble = 0;
        this.brainScrambleMax = 8;
        this.maxXSpeed = 180;
        this.maxYSpeed = 60;
        this.sightDist = 200;
        this.ceilingClamp = 32;
        this.bubbleSinAcc = 0;

        // nn related properties
        this.inputs = [
            0, // closeness to wall forward
            0, // closeness to wall above
        ];

        this.outputs = [
            0, // direction (0 to 1, left or right)
            0, // move forward
            0, // move up
        ];

        this.brain = new Network([
            this.inputs.length,
            Math.max(this.inputs.length, this.outputs.length) + 1,
            this.outputs.length
        ]);

        this.think();
    }

    onResize(canvas) {
        this.bounds = { w: canvas.width, h: canvas.height };
    }

    think() {
        // closeness to forward wall up to 50 units
        if (this.dir == 1) {
            // facing right
            const wallDist = clamp(this.bounds.w - this.x - this.size, 0, this.sightDist);
            this.inputs[0] = wallDist / this.sightDist;
        } else {
            // facing left
            const wallDist = clamp(this.x, 0, this.sightDist);
            this.inputs[0] = wallDist / this.sightDist;
        }

        // closeness to ceiling up to 75 units, minus 32 px of ceiling
        const ceilDist = clamp(this.y - this.ceilingClamp, 0, 75);
        this.inputs[1] = ceilDist / 75;

        this.outputs = this.brain.activate(this.inputs);
    }

    act(dt) {
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();
        }

        this.brainScramble += dt;
        if (this.brainScramble >= this.brainScrambleMax) {
            this.brainScramble = 0;
            this.brain = new Network([
                this.inputs.length,
                Math.max(this.inputs.length, this.outputs.length) + 1,
                this.outputs.length
            ]);
        }

        this.bubbleSinAcc += dt;
        if (this.bubbleSinAcc >= Math.PI * 2) {
            this.bubbleSinAcc = 0;
        }

        const [direction, forward, up] = this.outputs;
        // change direction
        this.dir = direction >= 0.5 ? 1 : -1;

        // move
        this.x += this.dir * this.maxXSpeed * dt * forward;
        if (up < 0.5) {
            this.y += dt * 10;
        } else {
            this.y -= this.maxYSpeed * dt * up;
        }

        // constrain to bounds
        this.x = clamp(this.x, 0, this.bounds.w - this.size);
        this.y = clamp(this.y, this.ceilingClamp, this.bounds.h * 0.67);
    }

    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        // draw blue to grey as age scale (brain scramble)
        const rg = 110 * this.brainScramble / this.brainScrambleMax;
        ctx.fillStyle = `rgb(${rg}, ${rg}, 255)`;
        ctx.fillRect(this.x, this.y, this.size, this.size / 2);

        // draw eye
        ctx.fillStyle = "white";
        const xOffset = this.x + (this.dir == 1 ? this.size - 8 : 4);
        ctx.fillRect(xOffset, this.y + 4, 4, 4);

        // draw vision line
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        if (this.dir == 1) {
            ctx.fillRect(this.x + this.size, this.y + (this.size / 8), this.sightDist, 2);
        } else {
            ctx.fillRect(this.x - this.sightDist, this.y + (this.size / 8), this.sightDist, 2);
        }

        // draw neural net
        // closeness to ceiling input = top fin
        ctx.fillStyle = `hsl(${(this.inputs[1]) * 120}, 100%, 50%)`;
        ctx.fillRect(this.x, this.y - 4, this.size, 4);

        // closeness to forward wall input = bottom fin
        ctx.fillStyle = `hsl(${(this.inputs[0]) * 120}, 100%, 50%)`;
        ctx.fillRect(this.x, this.y + this.size / 2, this.size, 4);

        // output 0 visualized by fish direction
        // output 1 visualized by fish movement
        const [,, up] = this.outputs;

        // output 2 visualized by bubbles below fish
        if (up >= 0.5) {
            ctx.strokeStyle = "white";
            const bubblePoints = [
                [this.x + 4, this.y + this.size + 4],
                [this.x + 12, this.y + this.size + 12],
                [this.x + 20, this.y + this.size + 8],
            ];
            for(const bp of bubblePoints) {
                const [x, y] = bp;
                ctx.strokeRect(
                    x + Math.sin(this.bubbleSinAcc * 6) * 4, 
                    y + (Math.sin(this.bubbleSinAcc * 8) * 6),
                    4, 
                    4
                );
            }
        }
    }
}