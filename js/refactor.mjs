import {v4 as uuid} from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));

class Neuron {
    constructor(bias) {
        this.id = uuid();
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
        /** @type string */
        this.b = b || null;
        /** @type number */
        this.weight = weight == undefined ? Math.random() * 2 - 1 : weight;
    }
}

class Network {
    constructor() {
        /** @type Object<string,Neuron> */
        this.neurons = {};
        /** @type Array<Synapse> */
        this.synapses = [];

        /** @type Array<Array<Synapse>>
         * 
         * sequence of nodes to activate
         */
        this.phases = [];
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
        while(phase.length > 0) {
            phase = Array.from(new Set(this.synapses.filter(s => phase.some(p => p == s.a)).map(s => s.b)));
            if (phase.length > 0) {
                phases.push(phase);
            }
        }

        console.log(phases);
    }
}

// test
const nn = new Network();
nn.neurons = {
    "a": new Neuron(),
    "b": new Neuron(),
    "c": new Neuron(),
    "d": new Neuron(),
    "e": new Neuron(),
    "f": new Neuron(),
    "g": new Neuron()
};

nn.synapses = [
    new Synapse("a", "b"),
    new Synapse("a", "c"),
    new Synapse("b", "d"),
    new Synapse("c", "d"),
    new Synapse("d", "e"),
    new Synapse("d", "f"),
    new Synapse("e", "g"),
    new Synapse("f", "g"),
];

nn.computePhases();
