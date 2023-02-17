package network

type Network struct {
	Inputs  []*Neuron
	Outputs []*Neuron
	Hidden  []*Neuron // TODO upgrade this to support multiple layers
}

func NewNetwork(numInputs int, numHidden int, numOutputs int) Network {
	n := Network{
		Inputs:  make([]*Neuron, numInputs),
		Hidden:  make([]*Neuron, numHidden),
		Outputs: make([]*Neuron, numOutputs),
	}

	for i := range n.Inputs {
		n.Inputs[i] = NewNeuron()
	}
	for i := range n.Hidden {
		n.Hidden[i] = NewNeuron()
	}
	for i := range n.Outputs {
		n.Outputs[i] = NewNeuron()
	}

	return n
}

func (n *Network) DenseConnect() {
	// connect input layer to hidden layer
	for _, iNode := range n.Inputs {
		for _, hNode := range n.Hidden {
			iNode.Connect(hNode)
		}
	}

	// connect hidden layer to output layer
	for _, hNode := range n.Hidden {
		for _, oNode := range n.Outputs {
			hNode.Connect(oNode)
		}
	}
}

func (n *Network) Activate(input []float64) []float64 {
	for i := range n.Inputs {
		n.Inputs[i].Activate(input[i])
	}

	for _, h := range n.Hidden {
		h.Activate()
	}

	output := make([]float64, len(n.Outputs))
	for i, o := range n.Outputs {
		output[i] = o.Activate()
	}

	return output
}

func (n *Network) Propagate(target []float64) {
	for i, o := range n.Outputs {
		o.Propagate(&target[i], nil)
	}
	for _, h := range n.Hidden {
		h.Propagate(nil, nil)
	}
	for _, i := range n.Inputs {
		i.Propagate(nil, nil)
	}
}

func (n *Network) Train(data [][][]float64, iter int) {
	for iter > 0 {
		for _, d := range data {
			n.Activate(d[0])
			n.Propagate(d[1])
		}
		iter--
	}
}
