import { v4 as uuid } from "uuid";

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const _sigmoid = (x) => sigmoid(x) * (1 - sigmoid(x));

class Neuron {
  constructor(bias = 0.5) {
    this.id = uuid();
    this.bias = bias != undefined ? bias : Math.random() * 2 - 1;

    this.incoming = {
      targets: {},
      weights: {},
    };

    this.outgoing = {
      targets: {},
      weights: {},
    };

    this._output = 0;
    this.output = 0;
    this.error = 0;
  }

  toJSON() {
    const inc = Object.keys(this.incoming.weights).reduce((acc, next) => Object.assign(
      acc,
      { [next]: this.incoming.weights[next] }
    ), {});

    const out = Object.keys(this.outgoing.weights).reduce((acc, next) => Object.assign(
      acc,
      { [next]: this.outgoing.weights[next] }
    ), {});

    return {
      _output: this._output,
      bias: this.bias,
      error: this.error,
      id: this.id,
      incoming: inc,
      outgoing: out,
      output: this.output
    };
  }

  connect(neuron, weight = 0.5) {
    this.outgoing.targets[neuron.id] = neuron;
    neuron.incoming.targets[this.id] = this;
    this.outgoing.weights[neuron.id] = neuron.incoming.weights[this.id] =
      weight != undefined ? weight : Math.random() * 2 - 1;
  }

  activate(input) {
    if (input != undefined) {
      this._output = 1;
      this.output = input;
    } else {
      const sum = Object.keys(this.incoming.targets).reduce(
        (total, target) =>
          total +
          this.incoming.targets[target].output * this.incoming.weights[target],
        this.bias
      );
      this.output = sigmoid(sum);
      this._output = _sigmoid(sum);
    }

    return this.output;
  }

  propagate(target, rate = 0.3) {
    // const sum =
    //   target != undefined
    //     ? this.output - target
    //     : Object.keys(this.outgoing.targets).reduce((total, target) => {
    //       this.outgoing.targets[target].incoming.weights[this.id] =
    //         this.outgoing.weights[target] -=
    //         rate * this.outgoing.targets[target].error * this.output;
    //       return (
    //         total +
    //         this.outgoing.targets[target].error *
    //         this.outgoing.weights[target]
    //       );
    //     }, 0);

    let sum = 0;
    if (target != undefined) {
      sum = this.output - target;
    } else {
      sum = Object.keys(this.outgoing.targets).reduce((total, target) => {
        const targetObjOut = this.outgoing.targets[target];
        const newWeight = this.outgoing.weights[target] - rate * targetObjOut.error * this.output;
        this.outgoing.weights[target] = newWeight;
        targetObjOut.incoming.weights[this.id] = newWeight;
        return total + targetObjOut.error * newWeight;
      }, 0);
    }

    this.error = sum * this._output;
    this.bias -= rate * this.error;
    return this.error;
  }

  mutate(rate = 0.5) {
    if (Math.random() < rate) {
      const f = 1 + (Math.random() * 0.4 - 0.2);
      this.bias *= f;
      Object.keys(this.incoming.weights).forEach(key => {
        this.incoming.weights[key] *= f;
      });
      Object.keys(this.outgoing.weights).forEach(key => {
        this.outgoing.weights[key] *= f;
      })
    }
  }

  // TODO
  clone() { }
}

class NN {
  constructor(i, h, o) {
    this.inputs = Array.from(new Array(i)).map(() => new Neuron());
    this.hiddens = Array.from(new Array(h)).map(() => new Neuron());
    this.outputs = Array.from(new Array(o)).map(() => new Neuron());
    //
    this.simpleConnections();
  }

  // assumes structure and creates dense network
  simpleConnections() {
    // input -> hidden
    this.inputs.forEach((input) => {
      this.hiddens.forEach((h) => {
        input.connect(h);
      });
    });

    // hidden -> output
    this.hiddens.forEach((h) => {
      this.outputs.forEach((o) => {
        h.connect(o);
      });
    });
  }

  activate(input) {
    this.inputs.forEach((n, i) => n.activate(input[i]));
    this.hiddens.forEach((n) => n.activate());
    return this.outputs.map((n) => n.activate());
  }

  propagate(target) {
    this.outputs.forEach((n, t) => n.propagate(target[t]));
    this.hiddens.forEach((n) => n.propagate());
    return this.inputs.forEach((n) => n.propagate());
  }

  train(data, iter) {
    while (iter > 0) {
      data.map((d) => {
        this.activate(d.inputs);
        this.propagate(d.outputs);
      });
      iter--;
    }
  }

  mutateNeurons() {
    [...this.outputs, ...this.hiddens, ...this.outputs].forEach(item => item.mutate(0.5));
  }
}

//
const test = new NN(2, 3, 1);
const gtTrainingData = [];
for (let i = 0; i < 1; i += 0.01) {
  for (let z = 0; z < 1; z += 0.1) {
    gtTrainingData.push({
      inputs: [i, z],
      outputs: [i > z ? 1 : 0]
    });
  }
}

// test.train([{
//   inputs: [0.4, 0.1],
//   outputs: [1]
// }, {
//   inputs: [0.1, 0.2],
//   outputs: [0]
// }, {
//   inputs: [0.01, 0.005],
//   outputs: [1]
// }, {
//   inputs: [0.6, 0.2],
//   outputs: [0]
// }], 100);
// console.log(JSON.stringify(test, null, "  "));
test.train(gtTrainingData, 2000);

console.log(test.activate([0.2, 0.4]));
console.log(test.activate([0.3, 0.1]));
console.log(test.activate([0.4, 0.45]));
console.log(test.activate([0.6, 0.3]));

// something
// class Blob {
//   constructor() {
//     this.x = 0;
//     this.hp = 10;
//     this.nn = new NN(2, 4, 2);
//   }

//   think(leftFire, rightFire) {
//     const foo = (a) => Math.abs(a - this.x);
//     const distanceToFireR = foo(rightFire);
//     const distanceToFireL = foo(leftFire);
//     // think
//     const [moveLeft, moveRight] = this.nn.activate(this.x, distanceToFireL, distanceToFireR);
//     console.log(moveLeft, moveRight);
//     // move
//     if (moveLeft > 0.5) {
//       this.x -= 1;
//     }
//     if (moveRight > 0.5) {
//       this.x += 1;
//     }

//     // TODO
//     // death?
//     if (foo(rightFire) < 2 || foo(leftFire) < 2) {
//       this.hp = 0;
//     }
//   }
// }

// // create blobs
// let blobs = [];
// let blobsToMake = 1000;
// for(let i = 0;i < blobsToMake;i++) {
//   blobs.push(new Blob());
// }

// // 20 steps
// for (let i = 0;i < 20;i++) {
//   const rightFire = 5;
//   const leftFire = -5;
//   blobs.forEach(b => {
//     if (b.hp > 0) {
//       b.think(leftFire, rightFire);
//     }
//   });
// }

// // remove dead, pick top 3
// blobs = blobs.filter(b => b.hp > 0);
// console.log(`${blobsToMake - blobs.length} blobs died`);
// blobs = blobs.sort((a, b) => a.x > b.x ? 1 : b.x > a.x ? -1 : 0);
// blobs = blobs.slice(0, 3);

// let step = 0;
// let num = setInterval(() => {
//   blobs[0].think(-5, 5);
//   step++;
//   if (step % 10 == 0) {
//     console.log("MUTATE");
//     blobs[0].nn.mutateNeurons();
//   }
//   if (blobs[0].x !== 0) {
//     console.log(`deviation at step ${step} after ${Math.floor(step / 10)} mutations`);
//     clearInterval(num);
//   }
// }, 10);

