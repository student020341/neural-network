/**
 * Sparse / Topology-Evolving Neural Network
 * Supports direct sensor-to-motor skip connections, arbitrary hidden topologies,
 * recurrent memory loops (feedback connections), unified complexity metrics,
 * and automatic neural decay & competitive pruning.
 */
class SparseNetwork {
    /**
     * @param {number} numInputs Number of input nodes
     * @param {number} numOutputs Number of output nodes
     * @param {Object} [options]
     * @param {number} [options.initialHidden=0] Number of initial hidden nodes
     * @param {number} [options.initialConnectivity=0.5] Chance of initial random links [0, 1]
     * @param {number|null} [options.maxComplexity=null] Maximum allowed complexity score (null for uncapped)
     * @param {number} [options.weightDecayRate=0.012] L1 synaptic decay rate per mutation
     * @param {number} [options.minWeightThreshold=0.03] Minimum weight magnitude before pruning
     */
    constructor(numInputs, numOutputs, options = {}) {
        if (numInputs && typeof numInputs === 'object') {
            options = numInputs;
            numOutputs = options.numOutputs;
            this.name = options.name || "";
            this.inputLabels = options.inputLabels ? [...options.inputLabels] : null;
            this.outputLabels = options.outputLabels ? [...options.outputLabels] : null;
            numInputs = options.numInputs;
        } else {
            this.name = options.name || "";
            this.inputLabels = options.inputLabels ? [...options.inputLabels] : null;
            this.outputLabels = options.outputLabels ? [...options.outputLabels] : null;
        }
        this.numInputs = numInputs || 0;
        this.numOutputs = numOutputs || 0;
        this.numHidden = options.initialHidden || 0;
        this.totalNodes = this.numInputs + this.numOutputs + this.numHidden;

        // Complexity & Neural Decay Configuration
        this.maxComplexity = options.maxComplexity !== undefined ? options.maxComplexity : null;
        this.weightDecayRate = options.weightDecayRate !== undefined ? options.weightDecayRate : 0.012;
        this.minWeightThreshold = options.minWeightThreshold !== undefined ? options.minWeightThreshold : 0.03;

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

    /**
     * Computes the unified network complexity score.
     * Hidden nodes cost 0.35 each, active connections cost 0.10 each.
     * @returns {number}
     */
    getComplexity() {
        const activeConns = this.connections.filter(c => c.enabled).length;
        return (this.numHidden * 0.35) + (activeConns * 0.10);
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
     * Prunes a specific connection from the network.
     */
    pruneConnection(src, tgt) {
        const idx = this.connections.findIndex(c => c.src === src && c.tgt === tgt);
        if (idx !== -1) {
            this.connections.splice(idx, 1);
            this.compile();
            return true;
        }
        return false;
    }

    /**
     * Prunes the connection with the smallest absolute weight magnitude.
     */
    pruneWeakestConnection() {
        if (this.connections.length === 0) return null;
        let minIdx = 0;
        let minWeight = Math.abs(this.connections[0].weight);

        for (let i = 1; i < this.connections.length; i++) {
            const w = Math.abs(this.connections[i].weight);
            if (w < minWeight) {
                minWeight = w;
                minIdx = i;
            }
        }

        const removed = this.connections.splice(minIdx, 1)[0];
        this.compile();
        return removed;
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
     * Prunes a hidden node and remaps all subsequent node indices.
     * @param {number} nodeIdx Absolute index of the hidden node to remove
     */
    pruneNode(nodeIdx) {
        const hiddenStart = this.numInputs + this.numOutputs;
        if (nodeIdx < hiddenStart || nodeIdx >= this.totalNodes) return false;

        // 1. Remove all connections attached to this node
        this.connections = this.connections.filter(c => c.src !== nodeIdx && c.tgt !== nodeIdx);

        // 2. Remap remaining connection source and target indices
        for (const conn of this.connections) {
            if (conn.src > nodeIdx) conn.src--;
            if (conn.tgt > nodeIdx) conn.tgt--;
        }

        // 3. Shift biases and state buffers left
        for (let i = nodeIdx; i < this.totalNodes - 1; i++) {
            this.biases[i] = this.biases[i + 1];
            this.currentValues[i] = this.currentValues[i + 1];
            this.previousValues[i] = this.previousValues[i + 1];
        }

        this.totalNodes--;
        this.numHidden--;
        this.compile();
        return true;
    }

    /**
     * Garbage collection pass: detects and prunes disconnected/vestigial hidden nodes.
     * A hidden node is vestigial if it has 0 incoming connections or 0 outgoing connections.
     * @returns {number} Count of pruned vestigial nodes
     */
    cleanupVestigial() {
        let prunedCount = 0;
        let changed = true;
        const hiddenStart = this.numInputs + this.numOutputs;

        while (changed) {
            changed = false;
            for (let i = this.totalNodes - 1; i >= hiddenStart; i--) {
                const hasIncoming = this.connections.some(c => c.enabled && c.tgt === i);
                const hasOutgoing = this.connections.some(c => c.enabled && c.src === i);

                if (!hasIncoming || !hasOutgoing) {
                    this.pruneNode(i);
                    prunedCount++;
                    changed = true;
                    break; // Restart scan after index shift
                }
            }
        }

        return prunedCount;
    }

    /**
     * Enforces the maximum complexity budget by pruning weakest connections and nodes.
     * @param {number} maxC 
     */
    enforceComplexityCap(maxC) {
        if (!maxC || maxC <= 0) return;

        // 1. First prune weakest connections while above budget
        while (this.getComplexity() > maxC && this.connections.length > 1) {
            this.pruneWeakestConnection();
        }

        // 2. If still above budget, prune least connected hidden nodes
        while (this.getComplexity() > maxC && this.numHidden > 0) {
            const hiddenStart = this.numInputs + this.numOutputs;
            let lowestNode = hiddenStart;
            let minConnCount = Infinity;

            for (let h = hiddenStart; h < this.totalNodes; h++) {
                const count = this.connections.filter(c => c.src === h || c.tgt === h).length;
                if (count < minConnCount) {
                    minConnCount = count;
                    lowestNode = h;
                }
            }
            this.pruneNode(lowestNode);
        }

        this.compile();
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
     * Mutate weights, biases, or topology (add/remove links or nodes),
     * applying L1 weight decay, progressive pruning pressure, and competitive replacement.
     * 
     * @param {number} rate Base mutation probability
     * @param {Object} [options]
     * @param {number} [options.strength] Weight mutation range
     * @param {number} [options.addConnectionRate] Probability of adding a new connection
     * @param {number} [options.addNodeRate] Probability of adding a new hidden node
     * @param {number} [options.weightDecayRate] L1 shrinkage rate
     * @param {number} [options.minWeightThreshold] Sub-threshold pruning cut-off
     * @param {number} [options.basePruneConnRate] Baseline stochastic connection prune rate
     * @param {number} [options.basePruneNodeRate] Baseline stochastic node prune rate
     */
    mutate(rate = 0.1, options = {}) {
        const strength = options.strength || 0.2;
        const halfStrength = strength / 2;
        const addConnRate = options.addConnectionRate || 0.05;
        const addNodeRate = options.addNodeRate || 0.02;
        const toggleRate = options.toggleRate || 0.01;

        const weightDecay = options.weightDecayRate !== undefined ? options.weightDecayRate : this.weightDecayRate;
        const minWeightThresh = options.minWeightThreshold !== undefined ? options.minWeightThreshold : this.minWeightThreshold;
        const maxC = (options.maxComplexity !== undefined ? options.maxComplexity : this.maxComplexity);

        // 1. Mild L1 Synaptic Weight Decay & Threshold Pruning
        if (weightDecay > 0) {
            for (const conn of this.connections) {
                conn.weight *= (1.0 - weightDecay);
            }
        }
        if (minWeightThresh > 0 && this.connections.length > 1) {
            this.connections = this.connections.filter(c => Math.abs(c.weight) >= minWeightThresh);
        }

        // 2. Mutate connection weights
        for (const conn of this.connections) {
            if (Math.random() < rate) {
                conn.weight += Math.random() * strength - halfStrength;
            }
            if (Math.random() < toggleRate) {
                conn.enabled = !conn.enabled;
            }
        }

        // 3. Mutate biases
        for (let i = this.numInputs; i < this.totalNodes; i++) {
            if (Math.random() < rate) {
                this.biases[i] += Math.random() * strength - halfStrength;
            }
        }

        // 4. Progressive Pruning Pressure (Scales up as complexity nears maxComplexity)
        if (maxC !== null && maxC > 0) {
            const currentC = this.getComplexity();
            const congestionRatio = Math.min(1.0, currentC / maxC);
            const pressureMultiplier = 1.0 + 3.0 * Math.pow(congestionRatio, 2);

            const pruneConnRate = (options.basePruneConnRate || 0.03) * pressureMultiplier;
            const pruneNodeRate = (options.basePruneNodeRate || 0.01) * pressureMultiplier;

            // Stochastic connection pruning
            if (this.connections.length > 1 && Math.random() < pruneConnRate) {
                this.pruneWeakestConnection();
            }

            // Stochastic hidden node pruning
            if (this.numHidden > 0 && Math.random() < pruneNodeRate) {
                const hiddenStart = this.numInputs + this.numOutputs;
                const randHidden = hiddenStart + Math.floor(Math.random() * this.numHidden);
                this.pruneNode(randHidden);
            }
        }

        // 5. Mutate topology: Add new connection (with Competitive Replacement)
        if (Math.random() < addConnRate) {
            if (maxC !== null && maxC > 0 && (this.getComplexity() + 0.10) > maxC) {
                // Competitive Replacement: Prune weakest existing connection to pay budget
                this.pruneWeakestConnection();
            }

            const randSrc = Math.floor(Math.random() * this.totalNodes);
            // Target cannot be an input node
            const randTgt = this.numInputs + Math.floor(Math.random() * (this.totalNodes - this.numInputs));
            this.addConnection(randSrc, randTgt, Math.random() * 2 - 1);
        }

        // 6. Mutate topology: Add new node (with Competitive Replacement)
        if (Math.random() < addNodeRate) {
            if (maxC !== null && maxC > 0 && (this.getComplexity() + 0.45) > maxC) {
                if (this.numHidden > 0) {
                    // Prune least connected hidden node
                    const hiddenStart = this.numInputs + this.numOutputs;
                    let lowestNode = hiddenStart;
                    let minConnCount = Infinity;

                    for (let h = hiddenStart; h < this.totalNodes; h++) {
                        const count = this.connections.filter(c => c.src === h || c.tgt === h).length;
                        if (count < minConnCount) {
                            minConnCount = count;
                            lowestNode = h;
                        }
                    }
                    this.pruneNode(lowestNode);
                } else {
                    // Prune connections to pay budget
                    this.pruneWeakestConnection();
                    this.pruneWeakestConnection();
                }
            }

            this.addNode(true);
        }

        // 7. Vestigial Dead-End Compaction
        this.cleanupVestigial();

        // 8. Enforce final strict complexity cap
        if (maxC !== null && maxC > 0) {
            this.enforceComplexityCap(maxC);
        }

        // 9. Recompile flat arrays
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
        const cloneNet = new SparseNetwork(this.numInputs, this.numOutputs, {
            name: this.name,
            inputLabels: this.inputLabels ? [...this.inputLabels] : null,
            outputLabels: this.outputLabels ? [...this.outputLabels] : null,
            maxComplexity: this.maxComplexity,
            weightDecayRate: this.weightDecayRate,
            minWeightThreshold: this.minWeightThreshold,
            initialConnectivity: 0
        });
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
            name: this.name,
            inputLabels: this.inputLabels,
            outputLabels: this.outputLabels,
            numInputs: this.numInputs,
            numOutputs: this.numOutputs,
            numHidden: this.numHidden,
            totalNodes: this.totalNodes,
            maxComplexity: this.maxComplexity,
            weightDecayRate: this.weightDecayRate,
            minWeightThreshold: this.minWeightThreshold,
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

        this.name = obj.name || this.name;
        this.inputLabels = obj.inputLabels || this.inputLabels;
        this.outputLabels = obj.outputLabels || this.outputLabels;
        this.numInputs = obj.numInputs;
        this.numOutputs = obj.numOutputs;
        this.numHidden = obj.numHidden || 0;
        this.totalNodes = obj.totalNodes || (this.numInputs + this.numOutputs + this.numHidden);
        this.maxComplexity = obj.maxComplexity !== undefined ? obj.maxComplexity : this.maxComplexity;
        this.weightDecayRate = obj.weightDecayRate !== undefined ? obj.weightDecayRate : this.weightDecayRate;
        this.minWeightThreshold = obj.minWeightThreshold !== undefined ? obj.minWeightThreshold : this.minWeightThreshold;
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
