// import { v4 as uuid } from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));
const cmpsyn = (s, a, b) => (s.a == a && s.b == b) || (s.a == b && s.b == a);

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
        this.inOutCache = {};

        this.inputs = [];
        this.outputs = [];

        this._initializeNetwork(inputs, outputs);
    }

    _initializeNetwork(num_in, num_out) {
        this.neurons = {};
        this.synapses = [];

        // computed phases to store execution sequence
        this.phases = [];
        // computed connections for fast lookups during execution
        this.inOutCache = {};

        const inputs = Array.from(new Array(num_in)).map(() => new Neuron());
        const outputs = Array.from(new Array(num_out)).map(() => new Neuron());
        this.inputs = inputs.map(i => i.id);
        this.outputs = outputs.map(i => i.id);

        // set network neurons
        this.neurons = [...inputs, ...outputs].reduce((acc, next) => Object.assign(acc, { [next.id]: next }), {});
        // create initial synapses straight from inputs to outputs
        this.synapses = this.denseConnect(inputs, outputs);
    }

    getSynapseIndex(a, b) {
        return this.synapses.findIndex(s => cmpsyn(s, a, b));
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

    // returns true if new synapse is made
    connect(a, b, weight) {
        // prevent connection to inputs, because inputs are defined as not existing as any synapse b end
        const inputs = this.inputs;
        if (inputs.includes(b)) {
            return false;
        }

        // prevent connection to outputs, because outputs are defined as not existing as any synapse a end
        const outputs = this.outputs;
        if (outputs.includes(a)) {
            return false;
        }

        const existing = this.getSynapseIndex(a, b);
        if (existing != -1) {
            return false;
        }

        this.synapses.push(new Synapse(a, b, weight));
        return true;
    }

    // returns list of all neurons that are not directly connected
    getNotConnected() {
        // TODO this needs to also check that infinite loops aren't created
        const all_neurons = Object.keys(this.neurons);
        const not_connected = [];
        for (let i = 0; i < all_neurons.length - 1; i++) {
            for (let j = i + 1; j < all_neurons.length; j++) {
                const n1 = all_neurons[i];
                const n2 = all_neurons[j];
                const existing_synapse = this.getSynapseIndex(n1, n2);
                if (existing_synapse == -1) {
                    not_connected.push([n1, n2]);
                }
            }
        }
        return not_connected;
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

    // compute and cache phases, the sequence to look up and activate neurons without repeated filter calls to the synapses array on every call
    computePhases() {
        this.phases = [];
        this.inOutCache = {};

        let phase = this.inputs;
        let phases = [phase];
        while (phase.length > 0) {
            phase = Array.from(new Set(this.synapses.filter(s => phase.some(p => p == s.a)).map(s => s.b)));
            // console.log({phase});
            // console.log({phases});
            if (phases.some(p => {
                if (p.length == phase.length) {
                    for (let i = 0; i < p.length; i++) {
                        if (p[i] != phase[i]) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            })) {
                break;
            }
            if (phase.length > 0) {
                phases.push(phase);
            }
        }

        this.phases = phases;

        // also compute cache thing :)
        this.phases.forEach(phase => {
            phase.forEach(id => {
                const synapseIn = this.getSynapseIndexByBEnd(id);
                const synapseOut = this.getSynapseIndexByAEnd(id);
                
                this.inOutCache[id] = {
                    in: synapseIn,
                    out: synapseOut
                };
            });
        });

        return this.phases;
    }

    /**
     * 
     * @param {number[]} inputs array of input values for the input nodes
     */
    activate(inputs) {
        const input_nodes = this.inputs;
        if (inputs.length != input_nodes.length) {
            console.log("input length does not match number of inputs");
            return;
        }

        // activate inputs
        input_nodes.forEach((inode, i) => {
            this.neurons[inode]._output = 1;
            this.neurons[inode].output = inputs[i];
        });

        // activate hidden layers, following phases, includes outputs
        for (let i = 0; i < this.phases.length; i++) {
            this.phases[i].forEach(node_id => {
                // for each node in this phase, get downstream synapses
                // const synapses = this.getSynapseIndexByAEnd(node_id).map(s => this.synapses[s]);
                // get downstream neurons?
                // const neurons = synapses.map(s => this.neurons[s.b]);
                const neurons = this.inOutCache[node_id].out.map(si => this.neurons[ this.synapses[si].b ]);
                for (let ni = 0; ni < neurons.length; ni++) {
                    // get all upstream neurons from downstream neuron
                    // const upstream_synapses = this.getSynapseIndexByBEnd(neurons[ni].id).map(s => this.synapses[s]);
                    const upstream_synapses = this.inOutCache[neurons[ni].id].in.map(si => this.synapses[si]);
                    let upstream_totals = 0;
                    // sum
                    upstream_synapses.forEach(s => {
                        upstream_totals += s.weight * this.neurons[s.a].output;
                    });

                    neurons[ni].output = sigmoid(upstream_totals);
                    neurons[ni]._output = _sigmoid(upstream_totals);
                }
            });
        }

        // return outputs
        return this.outputs.map(id => this.neurons[id].output);
    }

    //
    propagate(targets, rate = 0.3) {
        const outputs = this.outputs;
        if (outputs.length != targets.length) {
            console.log("number of targets does not match number of outputs");
            return;
        }

        // outputs
        outputs.forEach((id, i) => {
            let sum = this.neurons[id].output - targets[i];
            this.neurons[id].error = sum * this.neurons[id]._output;
            this.neurons[id].bias -= rate * this.neurons[id].error;
        });

        // hidden + input, iterate phases backwards
        for(let i = this.phases.length-1; i >= 0; i--) {
            this.phases[i].forEach(id => {
                const synapses = this.inOutCache[id].in.map(si => this.synapses[si]);
                const neurons = synapses.map(s => this.neurons[s.a]);
                neurons.forEach(n => {
                    // get nodes downstream of n
                    // TODO cache this info on neurons, maybe during phase computation
                    let downstream_total = 0;
                    const downstream_synapses = this.inOutCache[n.id].out.map(index => this.synapses[index]);
                    downstream_synapses.forEach(s => {
                        const targetDownstreamNode = this.neurons[s.b];
                        const newWeight = s.weight - rate * targetDownstreamNode.error * n.output;
                        s.weight = newWeight; // actual improvement in refactor
                        downstream_total += newWeight * targetDownstreamNode.error;
                    });

                    n.error = downstream_total * n._output;
                    n.bias -= rate * n.error;
                });
            });
        }
    }

    //
    train(data, iter){
        while(iter > 0) {
            data.forEach((d) => {
                this.activate(d.inputs);
                this.propagate(d.outputs);
            });
            iter--;
        }
    }

    /**
     * will add new neurons and connections following these steps in a loop:
     * 1. pick a random synapse in the network and then place a node in the center
     * 2. pick 2 random neurons that are not directly connected and make a new connection between them
     * 
     * @param {number} count 
     */
    randomNewNeuronsAndSynapses(count) {
        for (let i = count; i > 0; i--) {
            const randomSynapseIndex = Math.floor(Math.random() * this.synapses.length);
            // console.log(`split synapse ${gt.synapses[randomSynapseIndex].a}->${gt.synapses[randomSynapseIndex].b}`);
            this.insertNeuron(randomSynapseIndex);

            const not_connected = this.getNotConnected();
            const random_candidate = Math.floor(Math.random() * not_connected.length);
            const [pair] = not_connected.splice(random_candidate, 1);
            // console.log(`connect ${pair[0]} to ${pair[1]}`);
            this.connect(pair[0], pair[1]);
        }
    }
}

// example of making a simple 2 x 10 x 10 x 10 x 1 dense network that approximates a "greater than" algorithm
// const gt = new Network(2, 1);

// // create 3 hidden layers
// const hiddenHeight = 10;
// const col1 = Array.from(new Array(hiddenHeight)).map(() => new Neuron());
// const col2 = Array.from(new Array(hiddenHeight)).map(() => new Neuron());
// const col3 = Array.from(new Array(hiddenHeight)).map(() => new Neuron());

// // inputs and outputs
// const inputs = gt.inputs.map(id => gt.neurons[id]);
// const outputs = gt.outputs.map(id => gt.neurons[id]);

// // add neurons to network - after above step so new neurons are not mistaken for inputs or outputs
// [...col1, ...col2, ...col3].forEach(n => gt.neurons[n.id] = n);

// // remove all existing synapses because this will be a dense network
// gt.synapses = [];
// gt.synapses.push(...gt.denseConnect(inputs, col1));
// gt.synapses.push(...gt.denseConnect(col1, col2));
// gt.synapses.push(...gt.denseConnect(col2, col3));
// gt.synapses.push(...gt.denseConnect(col3, outputs));
// gt.computePhases();

// // train
// const gtTrainingData = [];
// for (let i = 0; i < 1; i += 0.01) {
//   for (let z = 0; z < 1; z += 0.1) {
//     gtTrainingData.push({
//       inputs: [i, z],
//       outputs: [i > z ? 1 : 0]
//     });
//   }
// }

// gt.train(gtTrainingData, 10);

