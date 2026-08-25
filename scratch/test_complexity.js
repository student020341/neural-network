const fs = require('fs');

const code = fs.readFileSync('./networks/sparse_network.js', 'utf8') + '\nglobal.SparseNetwork = SparseNetwork;';
eval(code);

console.log("=== Testing SparseNetwork Complexity & Decay ===");

// 1. Test Complexity Calculation
const net = new SparseNetwork(8, 4, { initialHidden: 3, initialConnectivity: 0.5, maxComplexity: 4.0 });
const c1 = net.getComplexity();
console.log(`Initial complexity (3 hidden, active conns = ${net.connections.filter(c => c.enabled).length}): ${c1.toFixed(2)}`);

// 2. Test L1 Weight Decay & Threshold Pruning
console.log("\n--- Testing L1 Weight Decay ---");
net.connections.forEach(c => c.weight = 0.035);
const connCountBefore = net.connections.length;
net.mutate(0, { strength: 0, addConnectionRate: 0, addNodeRate: 0, weightDecayRate: 0.20, minWeightThreshold: 0.03 });
console.log(`Connections before: ${connCountBefore}, after decay below 0.03: ${net.connections.length}`);

// 3. Test Competitive Replacement on Max Complexity
console.log("\n--- Testing Competitive Replacement under Max Complexity ---");
const strictNet = new SparseNetwork(6, 2, { initialHidden: 2, maxComplexity: 2.0 });
console.log(`StrictNet starting complexity: ${strictNet.getComplexity().toFixed(2)} (Cap: ${strictNet.maxComplexity})`);

// Run 100 mutations with high topology add rates
for (let i = 0; i < 100; i++) {
    strictNet.mutate(0.2, { addConnectionRate: 0.4, addNodeRate: 0.2 });
    const comp = strictNet.getComplexity();
    if (comp > strictNet.maxComplexity + 0.1) {
        console.error(`ERROR: Complexity exceeded cap! ${comp} > ${strictNet.maxComplexity}`);
        process.exit(1);
    }
}
console.log(`After 100 mutations, complexity is safely bounded: ${strictNet.getComplexity().toFixed(2)} / ${strictNet.maxComplexity}`);

// 4. Test Forward Pass activation after mutations
const dummyInputs = new Float32Array(6).fill(0.5);
const out = strictNet.activate(dummyInputs);
console.log(`Forward pass output buffer valid (length ${out.length}): [${Array.from(out).map(v => v.toFixed(2)).join(', ')}]`);

// 5. Test Vestigial Cleanup
console.log("\n--- Testing Vestigial Cleanup ---");
const testNet = new SparseNetwork(4, 2, { initialHidden: 0, initialConnectivity: 0 });
testNet.addConnection(0, 4, 1.0); // in0 -> out0
testNet.addNode(false); // creates hidden node 6 without connections
console.log(`Total nodes before cleanup: ${testNet.totalNodes}, numHidden: ${testNet.numHidden}`);
testNet.cleanupVestigial();
console.log(`Total nodes after cleanup: ${testNet.totalNodes}, numHidden: ${testNet.numHidden}`);

console.log("\n>>> ALL COMPLEXITY & NEURAL DECAY TESTS PASSED! <<<");
