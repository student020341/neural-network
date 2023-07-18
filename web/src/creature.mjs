import {Network} from "./network.mjs";
import {dist, lerp, clamp} from "./utils.mjs";

export default class Creature {
    constructor(x, y, w) {
        // inputs
        // danger left
        // danger up
        // danger right
        // danger down
        // x awareness
        // y awareness

        // outputs
        // move left/right
        // move up/down
        // vocalization pitch (todo)
        // vocalization volume (todo)
        this.network = new Network([6, 5, 2]);

        this.x = x;
        this.y = y;
        this.w = w;
    }

    think(dt, danger) {
        // think
        //
        //

        // consider distance to danger point
        const d = dist(this, danger);
        let dc = 0;
        const maxd = 100;
        if (d <= 100) {
            dc = 1 - (d / maxd);
        }

        // determine direction of danger
        let cl = 0, cr = 0, cu = 0, cd = 0;
        if (dc > 0) {
            // left
            const l = this.x - danger.x;
            if (l > 0) {
                cl = 1 - (l / maxd);
            }

            // up
            const u = this.y - danger.y;
            if (u > 0) {
                cu = 1 - (u / maxd);
            }

            // right
            const r = danger.x - this.x;
            if (r > 0) {
                cr = 1 - (r / maxd);
            }

            // down
            const d = danger.y - this.y;
            if (d > 0) {
                cd = 1 - (d / maxd);
            }
        }

        // spatial awareness
        const csx = this.x / 800;
        const csy = this.y / 800;

        const [mlr, mud] = this.network.activate([cl, cu, cr, cd, csx, csy]);

        // act
        //
        //
        const maxMove = 50;
        const dlr = lerp(-maxMove, maxMove, mlr);
        const dud = lerp(-maxMove, maxMove, mud);

        this.x += dlr * dt;
        this.y += dud * dt;

        // TODO include boundaries in considerations
        this.x = clamp(this.x, 0, 800-this.w);
        this.y = clamp(this.y, 0, 800-this.w);
    }

    /**
     * 
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        ctx.fillStyle = "blue";
        ctx.fillRect(this.x, this.y, this.w, this.w);
    }
}
