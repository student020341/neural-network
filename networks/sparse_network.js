/**
 * Sparse / Topology-Evolving Neural Network
 * Supports direct sensor-to-motor skip connections, arbitrary hidden topologies,
 * and recurrent memory loops (feedback connections) with zero-allocation activations.
 */
class SparseNetwork {
    /**
     * @param {number} numInputs Number of input nodes
     * @param {number} numOutputs Number of output nodes
     * @param {Object} [options]
     * @param {number} [options.initialHidden=0] Number of initial hidden nodes
     * @param {number} [options.initialConnectivity=0.5] Chance of initial random links [0, 1]
     */
    constructor(numInputs, numOutputs, options = {}) {
        if (numInputs && typeof numInputs === 'object') {
            options = numInputs;
            numOutputs = options.numOutputs;
            this.name = options.name || "";
            this.inputLabels = options.inputLabels || null;
            this.outputLabels = options.outputLabels || null;
            numInputs = options.numInputs;
        }
        this.numInputs = numInputs || 0;
        this.numOutputs = numOutputs || 0;
        this.numHidden = options.initialHidden || 0;
        this.totalNodes = this.numInputs + this.numOutputs + this.numHidden;

        // Node indexing convention:
        // [0 ... numInputs - 1]                            : Inputs
        // [numInputs ... numInputs + numOutputs - 1]       : Outputs
        // [numInputs + numOutputs ... totalNodes - 1]      : Hidden / Memory nodes

        /** @type Array<{src: number, tgt: number, weight: number, enabled: boolean}> */
        this.connections = [];

        // Per-node bias values
        this.biases = new Float32Array(Math.max(32, this.totalNodes * 2));
        for (let i = this.numInputs; i < this.totalNodes; i++) {
            this.biases[i] = Math.random() * 2 - 1;
        }

        // Fast runtime execution buffers
        this.currentValues = new Float32Array(Math.max(32, this.totalNodes * 2));
        this.previousValues = new Float32Array(Math.max(32, this.totalNodes * 2));
        this.outputBuffer = new Float32Array(this.numOutputs);

        // Compiled flat typed arrays for zero-overhead execution
        this.sources = new Int16Array(0);
        this.targets = new Int16Array(0);
        this.weights = new Float32Array(0);
        this.numActiveConnections = 0;

        if (options.initialConnectivity !== undefined) {
            this._initializeRandomConnections(options.initialConnectivity);
        }
    }

    _initializeRandomConnections(density = 0.5) {
        // Connect inputs directly to outputs with probability = density
        for (let i = 0; i < this.numInputs; i++) {
            for (let o = 0; o < this.numOutputs; o++) {
                if (Math.random() < density) {
                    this.addConnection(i, this.numInputs + o, Math.random() * 2 - 1);
                }
            }
        }

        // If there are hidden nodes, connect them
        for (let h = 0; h < this.numHidden; h++) {
            const hIdx = this.numInputs + this.numOutputs + h;
            // Connect a random input to this hidden node
            const randIn = Math.floor(Math.random() * this.numInputs);
            this.addConnection(randIn, hIdx, Math.random() * 2 - 1);

            // Connect this hidden node to a random output
            const randOut = this.numInputs + Math.floor(Math.random() * this.numOutputs);
            this.addConnection(hIdx, randOut, Math.random() * 2 - 1);
        }

        // Ensure at least one connection exists
        if (this.connections.length === 0) {
            this.addConnection(0, this.numInputs, Math.random() * 2 - 1);
        }

        this.compile();
    }

    /**
     * Add a directed connection between two nodes.
     * Supports feedforward (src < tgt), skip connections, and recurrent loops (src >= tgt).
     */
    addConnection(src, tgt, weight = Math.random() * 2 - 1) {
        // Avoid duplicate connection
        const existing = this.connections.find(c => c.src === src && c.tgt === tgt);
        if (existing) {
            existing.weight = weight;
            existing.enabled = true;
            this.compile();
            return existing;
        }

        const conn = { src, tgt, weight, enabled: true };
        this.connections.push(conn);
        this.compile();
        return conn;
    }

    /**
     * Add a new hidden node or splice a connection (NEAT style).
     * @param {boolean} [splitConnection=false] If true and active connections exist, splits one
     * @returns {number} The newly created node's index
     */
    addNode(splitConnection = false) {
        const activeConns = this.connections.filter(c => c.enabled);
        const newHiddenIdx = this.totalNodes;
        this.totalNodes++;
        this.numHidden++;

        // Resize buffers if necessary
        if (this.totalNodes > this.biases.length) {
            const newCap = this.totalNodes * 2;
            const newBiases = new Float32Array(newCap);
            newBiases.set(this.biases);
            this.biases = newBiases;

            this.currentValues = new Float32Array(newCap);
            this.previousValues = new Float32Array(newCap);
        }

        this.biases[newHiddenIdx] = Math.random() * 2 - 1;

        if (splitConnection && activeConns.length > 0) {
            // Pick a random active connection to split
            const connToSplit = activeConns[Math.floor(Math.random() * activeConns.length)];
            connToSplit.enabled = false;

            // In -> New (weight 1.0) and New -> Out (original weight)
            this.connections.push({ src: connToSplit.src, tgt: newHiddenIdx, weight: 1.0, enabled: true });
            this.connections.push({ src: newHiddenIdx, tgt: connToSplit.tgt, weight: connToSplit.weight, enabled: true });
        }

        this.compile();
        return newHiddenIdx;
    }

    /**
     * Compile active connections into contiguous TypedArrays for maximum activate() speed.
     */
    compile() {
        // Sort feedforward connections first, recurrent connections (src >= tgt) second
        const active = this.connections.filter(c => c.enabled);
        active.sort((a, b) => (a.src >= a.tgt ? 1 : 0) - (b.src >= b.tgt ? 1 : 0));

        this.numActiveConnections = active.length;
        this.sources = new Int16Array(this.numActiveConnections);
        this.targets = new Int16Array(this.numActiveConnections);
        this.weights = new Float32Array(this.numActiveConnections);

        for (let i = 0; i < this.numActiveConnections; i++) {
            this.sources[i] = active[i].src;
            this.targets[i] = active[i].tgt;
            this.weights[i] = active[i].weight;
        }
    }

    /**
     * Highly optimized forward pass with temporal recurrence (memory).
     * Zero heap allocations during execution.
     * 
     * @param {number[] | Float32Array} inputs
     * @returns {Float32Array} output node activations [0, 1]
     */
    activate(inputs) {
        if (inputs.length !== this.numInputs) {
            console.warn(`Expected ${this.numInputs} inputs, got ${inputs.length}`);
            return null;
        }

        // 1. Snapshot previous state into previousValues (creates recurrent memory)
        this.previousValues.set(this.currentValues);

        // 2. Set input node values
        for (let i = 0; i < this.numInputs; i++) {
            this.currentValues[i] = inputs[i];
        }

        // 3. Initialize hidden and output nodes with their bias values
        for (let i = this.numInputs; i < this.totalNodes; i++) {
            this.currentValues[i] = this.biases[i];
        }

        // 4. Propagate signals through active connections
        for (let c = 0; c < this.numActiveConnections; c++) {
            const src = this.sources[c];
            const tgt = this.targets[c];
            const w = this.weights[c];

            // If src >= tgt, it's a recurrent feedback loop (reads from previous frame t-1)
            // If src < tgt, it's a direct feedforward connection (reads from current frame t)
            const srcVal = (src >= tgt) ? this.previousValues[src] : this.currentValues[src];
            this.currentValues[tgt] += srcVal * w;
        }

        // 5. Activation functions:
        // Hidden / Memory nodes: Fast Tanh [-1, 1]
        for (let i = this.numInputs + this.numOutputs; i < this.totalNodes; i++) {
            const v = this.currentValues[i];
            this.currentValues[i] = v / (1 + (v < 0 ? -v : v));
        }

        // Output nodes: Fast Sigmoid [0, 1]
        for (let i = 0; i < this.numOutputs; i++) {
            const nodeIdx = this.numInputs + i;
            const v = this.currentValues[nodeIdx];
            const activated = 0.5 + 0.5 * (v / (1 + (v < 0 ? -v : v)));
            this.currentValues[nodeIdx] = activated;
            this.outputBuffer[i] = activated;
        }

        return this.outputBuffer;
    }

    /**
     * Mutate weights, biases, or topology (add/remove links or nodes).
     * @param {Object} [options]
     * @param {number} [options.addConnectionRate]
     * @param {number} [options.addNodeRate]
     */
    mutate(rate = 0.1, options = {}) {
        const strength = options.strength || 0.2;
        const halfStrength = strength / 2;
        const addConnRate = options.addConnectionRate || 0.05;
        const addNodeRate = options.addNodeRate || 0.02;
        const toggleRate = options.toggleRate || 0.01;

        // 1. Mutate connection weights
        for (const conn of this.connections) {
            if (Math.random() < rate) {
                conn.weight += Math.random() * strength - halfStrength;
            }
            if (Math.random() < toggleRate) {
                conn.enabled = !conn.enabled;
            }
        }

        // 2. Mutate biases
        for (let i = this.numInputs; i < this.totalNodes; i++) {
            if (Math.random() < rate) {
                this.biases[i] += Math.random() * strength - halfStrength;
            }
        }

        // 3. Mutate topology: add new connection
        if (Math.random() < addConnRate) {
            const randSrc = Math.floor(Math.random() * this.totalNodes);
            // Target cannot be an input node
            const randTgt = this.numInputs + Math.floor(Math.random() * (this.totalNodes - this.numInputs));
            this.addConnection(randSrc, randTgt, Math.random() * 2 - 1);
        }

        // 4. Mutate topology: add new node (split link)
        if (Math.random() < addNodeRate) {
            this.addNode();
        }

        this.compile();
    }

    /**
     * Re-randomize all connection weights and biases.
     */
    scramble() {
        for (const conn of this.connections) {
            conn.weight = (Math.random() * 2 - 1) * 1.5;
        }
        for (let i = this.numInputs; i < this.totalNodes; i++) {
            this.biases[i] = Math.random() * 2 - 1;
        }
        this.compile();
    }

    _initWeights() {
        this.scramble();
    }

    /**
     * Deep copy of sparse network topology and memory state.
     * @returns {SparseNetwork}
     */
    clone() {
        const cloneNet = new SparseNetwork(this.numInputs, this.numOutputs, { initialConnectivity: 0 });
        cloneNet.totalNodes = this.totalNodes;
        cloneNet.numHidden = this.numHidden;

        // Clone connections
        cloneNet.connections = this.connections.map(c => ({ ...c }));

        // Clone biases and state buffers
        cloneNet.biases = new Float32Array(this.biases.length);
        cloneNet.biases.set(this.biases);

        cloneNet.currentValues = new Float32Array(this.currentValues.length);
        cloneNet.currentValues.set(this.currentValues);

        cloneNet.previousValues = new Float32Array(this.previousValues.length);
        cloneNet.previousValues.set(this.previousValues);

        cloneNet.compile();
        return cloneNet;
    }

    /**
     * Clear recurrent memory buffers (reset to 0).
     */
    resetMemory() {
        this.currentValues.fill(0);
        this.previousValues.fill(0);
    }

    /**
     * Export network configuration to JSON.
     */
    toJSON() {
        return {
            type: 'SparseNetwork',
            numInputs: this.numInputs,
            numOutputs: this.numOutputs,
            numHidden: this.numHidden,
            totalNodes: this.totalNodes,
            connections: this.connections,
            biases: Array.from(this.biases.subarray(0, this.totalNodes)),
        };
    }

    /**
     * Import JSON configuration.
     */
    importJSON(jsonStr) {
        const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (!obj) return;

        this.numInputs = obj.numInputs;
        this.numOutputs = obj.numOutputs;
        this.numHidden = obj.numHidden || 0;
        this.totalNodes = obj.totalNodes || (this.numInputs + this.numOutputs + this.numHidden);
        this.connections = obj.connections || [];

        this.biases = new Float32Array(Math.max(32, this.totalNodes * 2));
        if (obj.biases) {
            this.biases.set(obj.biases);
        }

        this.currentValues = new Float32Array(Math.max(32, this.totalNodes * 2));
        this.previousValues = new Float32Array(Math.max(32, this.totalNodes * 2));
        this.outputBuffer = new Float32Array(this.numOutputs);

        this.compile();
    }
}
