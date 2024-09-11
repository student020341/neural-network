// classes
//
//

class Thing {
    constructor(bounds, env) {
        this.bounds = bounds;
        this.envRef = env;
        // spawn new things in the center
        this.x = this.bounds.w / 2;
        this.y = this.bounds.h / 2;

        // hive in the center
        this.cx = this.x;
        this.cy = this.y;

        // organism traits
        this.size = 16;
        this.senseDist = 100 + Math.random() * 400;
        this.lifeTime = 5 + Math.random() * 10;

        // neural network related
        this.acc = 0;
        this.accMax = 0.1 + Math.random() * 0.5;

        this.inputs = [
            0, // food left
            0, // food right
            0, // food above
            0, // food below
        ];

        this.outputs = [
            0, // horizontal move
            0, // vertical move
        ];

        // another simple brain, but with a swarm it needs to be for performance
        this.brain = new Network([
            this.inputs.length,
            Math.max(this.inputs.length, this.outputs.length) + 1,
            this.outputs.length
        ]);
    }

    think() {
        // find nearest x and y components
        let nxr = null;
        let nxl = null;
        let nya = null;
        let nyb = null;
        for(const res of this.envRef.resources) {
            const dv = sDistVector(
                res,
                {x: this.x, y: this.y},
            );

            if (dv.x > 0) {
                nxr = nxr == null ? dv.x : Math.min(nxr, dv.x);
            } else {
                nxl = nxl == null ? dv.x : Math.max(nxl, dv.x);
            }

            if (dv.y > 0) {
                nyb = nyb == null ? dv.y : Math.max(nyb, dv.y);
            } else {
                nya = nya == null ? dv.y : Math.min(nya, dv.y);
            }
        }

        if (nxr == null) {
            nxr = 0;
        }
        if (nxl == null) {
            nxl = 0;
        }
        if (nya == null) {
            nya = 0;
        }
        if (nyb == null) {
            nyb = 0;
        }

        nxr = clamp(nxr, 0, this.senseDist) / this.senseDist;
        nxl = clamp(-nxl, 0, this.senseDist) / this.senseDist;
        nya = clamp(-nya, 0, this.senseDist) / this.senseDist;
        nyb = clamp(nyb, 0, this.senseDist) / this.senseDist;

        this.inputs[0] = nxl;
        this.inputs[1] = nxr;
        this.inputs[2] = nya;
        this.inputs[3] = nyb;

        // outputs
        this.outputs = this.brain.activate(this.inputs);
    }

    act(dt) {
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.think();
        }

        this.lifeTime -= dt;
        if (this.lifeTime < 0) {
            this.lifeTime = 0;
            this._remove = true;
        }

        const [mh, mv] = this.outputs;
        if (mh >= 0.5) {
            this.x += dt * 100 * ((mh - 0.5) / 0.5);
        } else {
            this.x -= dt * 100 * (mh / 0.5);
        }

        if (mv >= 0.5) {
            this.y += dt * 100 * ((mv - 0.5) / 0.5);
        } else {
            this.y -= dt * 100 * (mv / 0.5);
        }
        this.x = clamp(this.x, 0, this.bounds.w - this.size);
        this.y = clamp(this.y, 0, this.bounds.h - this.size);
    }
}

class Swarm {
    constructor(bounds, env) {
        this.acc = 0;
        this.accMax = 1;
        this.things = [];

        this.envRef = env;
        this.cx = 0;
        this.cy = 0;
        this.onResize(bounds);
    }

    onResize(bounds) {
        this.bounds = bounds;
        for(const thing of this.things) {
            thing.cx = bounds.w / 2;
            thing.cy = bounds.h / 2;
        }
    }

    tick() {
        if (this.things.length < 10) {
            this.things.push(new Thing(this.bounds, this.envRef));
        }
    }

    act(dt) {
        this.acc += dt;
        if (this.acc >= this.accMax) {
            this.acc = 0;
            this.tick();
        }

        for(const thing of this.things) {
            thing.act(dt);

            if (thing._remove) {
                this.things.splice(this.things.indexOf(thing), 1);
            }
        }
    }
}

class Environment {
    constructor(bounds) {
        this.bounds = bounds;

        // resource tracking
        this.resources = [];

        this.accMax = 1;
        this.acc = 0;
    }

    onResize(bounds) {
        this.bounds = bounds;
    }

    // more of a tick but naming for consistency
    act(dt) {
        this.acc += dt;
        if (this.acc < this.accMax) {
            return;
        }
        this.acc = 0;

        if (this.resources.length < 10) {
            this.resources.push({
                x: 10 + Math.random() * (this.bounds.w - 20),
                y: 10 + Math.random() * (this.bounds.h - 20)
            });
        }
    }
}

// data
//
//

/** @type CanvasRenderingContext2D */
const ctx = canvasContext2D;

const env = new Environment({ w: canvas.width, h: canvas.height });
resizeCallbacks.push((c) => env.onResize(c));

const swarm = new Swarm({ w: canvas.width, h: canvas.height }, env);
resizeCallbacks.push((c) => swarm.onResize(c));

// functions
//
//

// logic
const logic = (dt) => {
    env.act(dt);
    swarm.act(dt);
}

// render
const render = (_, cw, ch) => {
    // clear what was drawn before
    ctx.clearRect(0, 0, cw, ch);

    // draw resources
    ctx.fillStyle = "red"; // apples or something
    for (const resource of env.resources) {
        ctx.fillRect(resource.x, resource.y, 4, 4);
    }

    // draw swarm
    ctx.fillStyle = "green";
    for (const thing of swarm.things) {
        ctx.fillRect(thing.x, thing.y, thing.size, thing.size);
    }
};

// start

loop([render, logic]);
