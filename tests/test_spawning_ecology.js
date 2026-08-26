// Automated Unit & Ecological Scenario Test Suite for Spawning Rules

const assert = require('assert');

// 1. Load Species Size Constants
const TURNFISH_SIZES = [12.0, 13.5, 15.0, 17.0, 18.5, 20.0, 22.0, 24.0, 26.0];
const CRAB_SIZES     = [12.0, 13.5, 15.0, 17.0, 19.0, 21.0, 24.0, 27.0, 30.0];
const JELLY_SIZES    = [20.0, 23.0, 26.0, 32.0, 36.0, 40.0, 46.0, 50.0, 55.0];
const PREDATOR_SIZES = [26.0, 29.0, 32.0, 36.0, 39.0, 42.0, 46.0, 50.0, 54.0];
const EEL_SIZES      = [20.0, 22.5, 25.0, 28.0, 31.0, 34.0, 38.0, 42.0, 46.0];

const CAPS = {
    TurnFish: 35,
    Crab: 18,
    Jellyfish: 16,
    Predator: 8,
    Eel: 12,
    Global: 85
};

// Spawning Prosperity Engine Function
function rollEcologicalSize(allowMedium, allowLarge) {
    if (!allowMedium) {
        const idx = Math.floor(Math.random() * 3);
        return { sizeIndex: idx, tier: "small" };
    }
    if (!allowLarge) {
        if (Math.random() < 0.65) {
            const idx = Math.floor(Math.random() * 3);
            return { sizeIndex: idx, tier: "small" };
        } else {
            const idx = 3 + Math.floor(Math.random() * 3);
            return { sizeIndex: idx, tier: "medium" };
        }
    }
    const roll = Math.random();
    if (roll < 0.50) {
        const idx = Math.floor(Math.random() * 3);
        return { sizeIndex: idx, tier: "small" };
    } else if (roll < 0.85) {
        const idx = 3 + Math.floor(Math.random() * 3);
        return { sizeIndex: idx, tier: "medium" };
    } else {
        const idx = 6 + Math.floor(Math.random() * 3);
        return { sizeIndex: idx, tier: "large" };
    }
}

// Evaluate ecological conditions for a given environment state
function evaluateSpawningRules(species, state) {
    let allowMedium = false;
    let allowLarge = false;
    let sizeArray = null;

    if (species === "TurnFish") {
        sizeArray = TURNFISH_SIZES;
        allowMedium = state.foods >= 6;
        allowLarge = state.foods >= 12;
    } else if (species === "Crab") {
        sizeArray = CRAB_SIZES;
        const settledDebris = state.settledDebris || 0;
        const carcassCount = state.carcasses ? state.carcasses.length : 0;
        allowMedium = settledDebris >= 2;
        allowLarge = settledDebris >= 5 || carcassCount >= 4;
    } else if (species === "Jellyfish") {
        sizeArray = JELLY_SIZES;
        allowMedium = state.predators >= 1 || state.turnFishes >= 8;
        allowLarge = state.predators >= 2 || state.jellies >= 4;
    } else if (species === "Predator") {
        sizeArray = PREDATOR_SIZES;
        const preyCount = state.turnFishes + state.crabs;
        allowMedium = preyCount >= 8;
        allowLarge = preyCount >= 14 && (state.predatorKillCount || 0) >= 3;
    } else if (species === "Eel") {
        sizeArray = EEL_SIZES;
        const carcassCount = state.carcasses ? state.carcasses.length : 0;
        allowMedium = carcassCount >= 2;
        allowLarge = carcassCount >= 4;
    }

    const { sizeIndex, tier } = rollEcologicalSize(allowMedium, allowLarge);
    return {
        allowMedium,
        allowLarge,
        sizeIndex,
        tier,
        size: sizeArray[sizeIndex]
    };
}

// Can a species spawn taking into account living + carcasses?
function canSpawnSpecies(species, state) {
    const carcasses = state.carcasses || [];
    const deadOfSpecies = carcasses.filter(c => c.species === species).length;
    const livingOfSpecies = state[species === "TurnFish" ? "turnFishes" : (species === "Predator" ? "predators" : (species === "Jellyfish" ? "jellies" : (species === "Crab" ? "crabs" : "eels")))] || 0;
    
    const livingTotal = (state.turnFishes || 0) + (state.crabs || 0) + (state.jellies || 0) + (state.predators || 0) + (state.eels || 0);
    const globalTotal = livingTotal + carcasses.length;

    if (globalTotal >= CAPS.Global) return false;
    return (livingOfSpecies + deadOfSpecies) < CAPS[species];
}

console.log("==================================================");
console.log("🧪 RUNNING ECOLOGICAL SPAWNING TEST SUITE");
console.log("==================================================");

let totalPassed = 0;

// Test Suite 1: Mathematical Distribution & Tier Boundaries
console.log("\n[TEST 1] Testing rollEcologicalSize statistical distributions (10,000 runs)...");
{
    // A. Lean
    const countsLean = { small: 0, medium: 0, large: 0 };
    for (let i = 0; i < 10000; i++) {
        const { sizeIndex, tier } = rollEcologicalSize(false, false);
        countsLean[tier]++;
        assert(sizeIndex >= 0 && sizeIndex <= 2, "Lean state must only roll indices 0..2");
    }
    assert.strictEqual(countsLean.small, 10000, "Lean state must be 100% small");
    assert.strictEqual(countsLean.medium, 0, "Lean state must have 0% medium");
    assert.strictEqual(countsLean.large, 0, "Lean state must have 0% large");
    console.log("  ✓ Lean Scenario: 100% Small, 0% Medium, 0% Large (Indices 0..2)");
    totalPassed++;

    // B. Moderate
    const countsMod = { small: 0, medium: 0, large: 0 };
    for (let i = 0; i < 10000; i++) {
        const { sizeIndex, tier } = rollEcologicalSize(true, false);
        countsMod[tier]++;
        assert(sizeIndex >= 0 && sizeIndex <= 5, "Moderate state must only roll indices 0..5");
    }
    assert.strictEqual(countsMod.large, 0, "Moderate state must have 0% large");
    assert(countsMod.small > 6000 && countsMod.small < 7000, `Moderate small should be ~65% (got ${countsMod.small})`);
    assert(countsMod.medium > 3000 && countsMod.medium < 4000, `Moderate medium should be ~35% (got ${countsMod.medium})`);
    console.log(`  ✓ Moderate Scenario: ${countsMod.small / 100}% Small, ${countsMod.medium / 100}% Medium, 0% Large (Indices 0..5)`);
    totalPassed++;

    // C. Flourishing / Surplus
    const countsSurplus = { small: 0, medium: 0, large: 0 };
    const indexSeen = new Array(9).fill(0);
    for (let i = 0; i < 10000; i++) {
        const { sizeIndex, tier } = rollEcologicalSize(true, true);
        countsSurplus[tier]++;
        indexSeen[sizeIndex]++;
    }
    assert(countsSurplus.large > 1100 && countsSurplus.large < 1900, `Large should be ~15% (got ${countsSurplus.large})`);
    for (let i = 0; i < 9; i++) {
        assert(indexSeen[i] > 0, `All 9 size indices must be reachable (Index ${i} was 0)`);
    }
    console.log(`  ✓ Flourishing Scenario: ${countsSurplus.small / 100}% Small, ${countsSurplus.medium / 100}% Medium, ${countsSurplus.large / 100}% Large (All 9 indices 0..8 active)`);
    totalPassed++;
}

// Test Suite 2: Species Specific Ecological Prosperity Scenarios
console.log("\n[TEST 2] Testing Species-Specific Prosperity Triggers...");
{
    // A. TurnFish
    const fishLean = evaluateSpawningRules("TurnFish", { foods: 2 });
    assert.strictEqual(fishLean.allowMedium, false);
    assert.strictEqual(fishLean.allowLarge, false);

    const fishFlourish = evaluateSpawningRules("TurnFish", { foods: 15 });
    assert.strictEqual(fishFlourish.allowMedium, true);
    assert.strictEqual(fishFlourish.allowLarge, true);
    console.log("  ✓ TurnFish: Lean (<6 food) restricts to small; Bloom (>=12 food) unlocks Titans");
    totalPassed++;

    // B. Crab (Titan Elder Unlocking via Seafloor Graveyard)
    const crabClean = evaluateSpawningRules("Crab", { settledDebris: 0, carcasses: [] });
    assert.strictEqual(crabClean.allowMedium, false);
    assert.strictEqual(crabClean.allowLarge, false);

    // Carcass graveyard test (4 carcasses on floor)
    const crabGraveyard = evaluateSpawningRules("Crab", { settledDebris: 1, carcasses: [{}, {}, {}, {}] });
    assert.strictEqual(crabGraveyard.allowMedium, false);
    assert.strictEqual(crabGraveyard.allowLarge, true, "4 carcasses must unlock Large Titan Crabs");

    // Collect 1000 crab graveyard spawns and verify Titan sizes appear
    const crabSizes = [];
    for (let i = 0; i < 1000; i++) {
        const res = evaluateSpawningRules("Crab", { settledDebris: 6, carcasses: [{}, {}, {}, {}] });
        crabSizes.push(res.size);
    }
    const titanCrabs = crabSizes.filter(s => s >= 24.0);
    assert(titanCrabs.length > 50, "Titan Crabs (24px, 27px, 30px) must successfully spawn in graveyard conditions!");
    console.log(`  ✓ Crab: Seafloor Graveyard correctly spawned ${titanCrabs.length}/1000 Titan Elder Crabs (Sizes 24px - 30px)`);
    totalPassed++;

    // C. Ribbon Eel (Carcass Sinking Density)
    const eelLean = evaluateSpawningRules("Eel", { carcasses: [] });
    assert.strictEqual(eelLean.allowMedium, false);
    assert.strictEqual(eelLean.allowLarge, false);

    const eelSurplus = evaluateSpawningRules("Eel", { carcasses: [{}, {}, {}, {}, {}] });
    assert.strictEqual(eelSurplus.allowMedium, true);
    assert.strictEqual(eelSurplus.allowLarge, true);

    const eelSizes = [];
    for (let i = 0; i < 1000; i++) {
        const res = evaluateSpawningRules("Eel", { carcasses: [{}, {}, {}, {}] });
        eelSizes.push(res.size);
    }
    const giantEels = eelSizes.filter(s => s >= 38.0);
    assert(giantEels.length > 50, "Giant Eels (38px, 42px, 46px) must successfully spawn in carcass surplus!");
    console.log(`  ✓ Ribbon Eel: Carcass Surplus correctly spawned ${giantEels.length}/1000 Giant Sinuous Eels (Sizes 38px - 46px)`);
    totalPassed++;

    // D. Predator (Apex Behemoth Unlocking)
    const predLean = evaluateSpawningRules("Predator", { turnFishes: 2, crabs: 1, predatorKillCount: 0 });
    assert.strictEqual(predLean.allowMedium, false);
    assert.strictEqual(predLean.allowLarge, false);

    const predThriving = evaluateSpawningRules("Predator", { turnFishes: 12, crabs: 4, predatorKillCount: 5 });
    assert.strictEqual(predThriving.allowMedium, true);
    assert.strictEqual(predThriving.allowLarge, true);
    console.log("  ✓ Predator: Prey Abundance (>14 prey + 3 kills) unlocks Apex Behemoths");
    totalPassed++;
}

// Test Suite 3: Species Cap-Tied Carcass Locking & Unlocking
console.log("\n[TEST 3] Testing Species Cap-Bound Carcass Dynamics...");
{
    // Scenario 1: Predators die off, 8 carcasses fill the cap of 8
    const predatorExtinctionState = {
        turnFishes: 10,
        crabs: 5,
        jellies: 4,
        predators: 0, // 0 living
        eels: 2,
        carcasses: [
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" },
            { species: "Predator" } // 8 total Predator corpses
        ]
    };

    assert.strictEqual(canSpawnSpecies("Predator", predatorExtinctionState), false, "Predator must NOT spawn while 8 corpses lock the cap");
    console.log("  ✓ 8 Predator carcasses strictly prevent new Predator edge spawns (0 living + 8 dead == Cap 8)");
    totalPassed++;

    // Scenario 2: A Crab scavenges 1 Predator carcass (7 corpses left)
    predatorExtinctionState.carcasses.pop(); // Crab consumes 1 carcass
    assert.strictEqual(canSpawnSpecies("Predator", predatorExtinctionState), true, "Predator MUST spawn once a carcass is scavenged");
    console.log("  ✓ Crab scavenging 1 carcass opens a cap slot, immediately allowing a new Predator spawn!");
    totalPassed++;

    // Scenario 3: Global Cap (85 total)
    const globalCapState = {
        turnFishes: 30,
        crabs: 15,
        jellies: 15,
        predators: 5,
        eels: 10,
        carcasses: new Array(10).fill({ species: "TurnFish" }) // 75 living + 10 carcasses = 85
    };
    assert.strictEqual(canSpawnSpecies("TurnFish", globalCapState), false, "Must block spawn when global living + carcasses reaches 85");
    console.log("  ✓ Global cap accurately halts all spawning when (living + carcasses) == 85");
    totalPassed++;
}

console.log("\n==================================================");
console.log(`🎉 ALL ${totalPassed} ECOLOGICAL SCENARIO TESTS PASSED SUCCESSFULLY!`);
console.log("==================================================");
