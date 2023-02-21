import { v4 as uuid } from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));

const names = Array.from("abcdefghijklmnopqrstuvwxyz").reduce((acc, char) => {
    return acc.concat(Array.from(new Array(50)).map((_, n) => char + `${1 + n}`));
}, []);

class Neuron {
    /**
     * 
     * @param {number | undefined} bias optional bias
     */
    constructor(bias) {
        // this.id = uuid();
        this.id = names.shift();
        this.bias = bias == undefined ? Math.random() * 2 - 1 : bias;
        this.output = 0;
        this._output = 0;
        this.error = 0;
    }
}

class Synapse {
    constructor(a, b, weight) {
        /** @type string | null */
        this.a = a || null;
        /** @type string | null */
        this.b = b || null;
        /** @type number */
        this.weight = weight == undefined ? Math.random() * 2 - 1 : weight;
    }
}

class Network {
    /**
     * 
     * @param {number} inputs number of inputs
     * @param {number} outputs number of outputs
     */
    constructor(inputs, outputs) {
        /** @type Object<string,Neuron> */
        this.neurons = {};
        /** @type Array<Synapse> */
        this.synapses = [];

        /** @type Array<Array<Synapse>>
         * 
         * sequence of nodes to activate
         */
        this.phases = [];

        this._initializeNetwork(inputs, outputs);
    }

    _initializeNetwork(num_in, num_out) {
        this.neurons = {};
        this.synapses = [];
        this.phases = [];

        const inputs = Array.from(new Array(num_in)).map(() => new Neuron());
        const outputs = Array.from(new Array(num_out)).map(() => new Neuron());

        // set network neurons
        this.neurons = [...inputs, ...outputs].reduce((acc, next) => Object.assign(acc, { [next.id]: next }), {});
        // create initial synapses straight from inputs to outputs
        this.synapses = this.denseConnect(inputs, outputs);
    }

    getSynapseIndex(a, b) {
        return this.synapses.findIndex(s => s.a == a && s.b == b);
    }

    getSynapseIndexByAEnd(a) {
        return this.synapses.reduce((acc, next, index) => {
            if (next.a == a) {
                acc.push(index);
            }
            return acc;
        }, []);
    }

    getSynapseIndexByBEnd(b) {
        return this.synapses.reduce((acc, next, index) => {
            if (next.b == b) {
                acc.push(index);
            }
            return acc;
        }, []);
    }

    /**
     * connect all neurons in col1 to col2
     * 
     * @param {Neuron[]} col1 
     * @param {Neuron[]} col2 
     * @returns 
     */
    denseConnect(col1, col2) {
        let syn = [];

        col1.forEach(n1 => {
            col2.forEach(n2 => {
                syn.push(new Synapse(n1.id, n2.id));
            });
        });

        return syn;
    }

    /**
     * 
     * @param {number} si index of synapse to split
     * @param {number | undefined} bias
     * @param {number | undefined} weightA weight from neuron A to new neuron, undefined to use existing
     * @param {number | undefined} weightB weight from new neuron to B neuron, undefined to use existing
     */
    insertNeuron(si, bias, weightA, weightB) {
        const w1 = weightA == undefined ? this.synapses[si].weight : weightA;
        const w2 = weightB == undefined ? this.synapses[si].weight : weightB;
        // get synapse and remove it from list
        const [synapse] = this.synapses.splice(si, 1);
        // create 2 new synapses with new neuron at center
        const n = new Neuron(bias);
        this.neurons[n.id] = n;
        this.synapses.push(
            new Synapse(synapse.a, n.id, w1),
            new Synapse(n.id, synapse.b, w2)
        );

        return n;
    }

    // an input is a neuron that has outputs but no inputs
    getInputs() {
        return Object.keys(this.neurons).filter(id => !this.synapses.some(s => s.b == id));
    }

    //
    getOutputs() {
        return Object.keys(this.neurons).filter(id => !this.synapses.some(s => s.a == id));
    }

    // compute and cache phases
    // this is probably unnecessary, on the fly good enough, but will be useful code reference for the network activation
    computePhases() {
        let phase = this.getInputs();
        let phases = [phase];
        while (phase.length > 0) {
            phase = Array.from(new Set(this.synapses.filter(s => phase.some(p => p == s.a)).map(s => s.b)));
            if (phase.length > 0) {
                phases.push(phase);
            }
        }

        this.phases = phases;
        return this.phases;
    }
}

// test
// const nn = new Network();
// nn.neurons = {
//     "a": new Neuron(),
//     "b": new Neuron(),
// };

// nn.synapses = [
//     new Synapse("a", "b"),
// ];

// nn.computePhases();

const gt = new Network(2, 1);
console.log(gt.computePhases());
console.log("\n\n\n");

// add neurons to random spots
for (let i = 1; i > 0; i--) {
    const randomSynapseIndex = Math.floor(Math.random() * gt.synapses.length);
    gt.insertNeuron(randomSynapseIndex);
}

// add random connections
// TODO

// recompute
gt.computePhases();

console.log(gt);
