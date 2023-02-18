package network

import (
	"encoding/json"
	"errors"
)

type Network struct {
	Inputs  []*Neuron
	Hidden  []*Neuron // TODO upgrade this to support multiple layers
	Outputs []*Neuron
}

func NewNetwork(numInputs int, numHidden int, numOutputs int) Network {
	n := Network{
		Inputs:  make([]*Neuron, numInputs),
		Hidden:  make([]*Neuron, numHidden),
		Outputs: make([]*Neuron, numOutputs),
	}
	staticStaretingBias := 0.5
	for i := range n.Inputs {
		n.Inputs[i] = NewNeuron(&staticStaretingBias)
	}
	for i := range n.Hidden {
		n.Hidden[i] = NewNeuron(&staticStaretingBias)
	}
	for i := range n.Outputs {
		n.Outputs[i] = NewNeuron(&staticStaretingBias)
	}

	return n
}

func (n *Network) DenseConnect() {
	// connect input layer to hidden layer
	for _, iNode := range n.Inputs {
		for _, hNode := range n.Hidden {
			iNode.Connect(hNode, 0.5)
		}
	}

	// connect hidden layer to output layer
	for _, hNode := range n.Hidden {
		for _, oNode := range n.Outputs {
			hNode.Connect(oNode, 0.5)
		}
	}
}

func (n *Network) LoadModel(b []byte) error {
	type iNeuron struct {
		ID       string             `json:"id"`
		Bias     float64            `json:"bias"`
		Output   float64            `json:"output"`
		Output2  float64            `json:"_output"`
		Error    float64            `json:"error"`
		Incoming map[string]float64 `json:"incoming"`
		Outgoing map[string]float64 `json:"outgoing"`
	}

	asMap := make(map[string][]iNeuron)
	err := json.Unmarshal(b, &asMap)
	if err != nil {
		return err
	}

	if len(asMap["Inputs"]) != len(n.Inputs) {
		return errors.New("model has a different number of inputs")
	}

	if len(asMap["Hidden"]) != len(n.Hidden) {
		return errors.New("model has a different number of hidden neurons")
	}

	if len(asMap["Outputs"]) != len(n.Outputs) {
		return errors.New("model has a different number of outputs")
	}

	// set nodes
	for i, v := range asMap["Inputs"] {
		n.Inputs[i] = &Neuron{
			ID:      v.ID,
			Bias:    v.Bias,
			Output:  v.Output,
			Output2: v.Output2,
			Error:   v.Error,
		}
	}

	for i, v := range asMap["Hidden"] {
		n.Hidden[i] = &Neuron{
			ID:      v.ID,
			Bias:    v.Bias,
			Output:  v.Output,
			Output2: v.Output2,
			Error:   v.Error,
		}
	}

	for i, v := range asMap["Outputs"] {
		n.Outputs[i] = &Neuron{
			ID:      v.ID,
			Bias:    v.Bias,
			Output:  v.Output,
			Output2: v.Output2,
			Error:   v.Error,
		}
	}

	// TODO make this easier, revisit synapse strategy

	return nil
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
