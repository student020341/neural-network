import {Network} from "./network.mjs";
import {box_intersect} from "./utils.mjs";

export default class Creature {
    constructor(x, y, w) {
        // inputs
        // danger left
        // danger up
        // danger right
        // danger down

        // outputs
        // move left/right
        // move up/down
        this.network = new Network([4, 5, 2]);

        this.x = x;
        this.y = y;
        this.w = w;
    }

    think(dt, pointsOfDoom) {
        // think


        // act
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
