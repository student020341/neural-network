package network

import (
	"encoding/json"
	"math/rand"

	"github.com/google/uuid"
)

type Neuron struct {
	ID       string                `json:"id"`
	Bias     float64               `json:"bias"`
	Output   float64               `json:"output"`
	Output2  float64               `json:"_output"`
	Error    float64               `json:"error"`
	Incoming map[string]Connection `json:"incoming"`
	Outgoing map[string]Connection `json:"outgoing"`
}

type Connection struct {
	Target *Neuron
	Weight float64
}

func (n *Neuron) MarshalJSON() ([]byte, error) {
	asMap := make(map[string]interface{})
	asMap["id"] = n.ID
	asMap["bias"] = n.Bias
	asMap["output"] = n.Output
	asMap["_output"] = n.Output2
	asMap["error"] = n.Error

	// map connections as [id] = weight
	incFoo := make(map[string]float64)
	for k, v := range n.Incoming {
		incFoo[k] = v.Weight
	}
	asMap["incoming"] = incFoo

	outFoo := make(map[string]float64)
	for k, v := range n.Outgoing {
		outFoo[k] = v.Weight
	}
	asMap["outgoing"] = outFoo

	return json.Marshal(asMap)
}

func NewNeuron() *Neuron {
	return &Neuron{
		ID:       string(uuid.NewString()),
		Bias:     (rand.Float64() * 2) - 1,
		Incoming: make(map[string]Connection),
		Outgoing: make(map[string]Connection),
	}
}

func (n *Neuron) Connect(other *Neuron, weight ...float64) {
	var w float64
	if len(weight) == 0 {
		w = rand.Float64()
	} else {
		w = weight[0]
	}
	n.Outgoing[other.ID] = Connection{
		Target: other,
		Weight: w,
	}
	other.Incoming[n.ID] = Connection{
		Target: n,
		Weight: w,
	}
}

func (n *Neuron) Activate(input ...float64) float64 {
	if len(input) == 1 {
		n.Output2 = 1
		n.Output = input[0]
	} else if len(input) == 0 {
		var sum float64 = 0
		for _, o := range n.Incoming {
			sum += o.Target.Output * o.Weight
		}
		n.Output = sigmoid(sum)
		n.Output2 = _sigmoid(sum)
	}

	return n.Output
}

func (n *Neuron) Propagate(target *float64, rate *float64) float64 {
	var r float64
	if rate != nil {
		r = *rate
	} else {
		r = 0.3
	}

	var sum float64
	if target != nil {
		sum = n.Output - *target
	} else {
		for _, o := range n.Outgoing {
			o.Weight -= r * o.Target.Error * n.Output
			if c, ok := o.Target.Incoming[n.ID]; ok {
				c.Weight = o.Weight
				c.Target.Incoming[n.ID] = c
			}
			sum += o.Target.Error * o.Weight
		}
	}

	n.Error = sum * n.Output2
	n.Bias -= r * n.Error
	return n.Error
}

func (n *Neuron) Mutate(chance float64) {
	if rand.Float64() > chance {
		return
	}
	// hard coded change of ~20%
	change := 1 + (rand.Float64()*0.4 - 0.2)
	n.Bias *= change
	for _, o := range n.Incoming {
		o.Weight *= change
	}
	for _, o := range n.Outgoing {
		o.Weight *= change
	}
}
