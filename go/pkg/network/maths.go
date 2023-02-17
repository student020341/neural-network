package network

import "math"

func sigmoid(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-x))
}

func _sigmoid(x float64) float64 {
	return sigmoid(x) * (1.0 - sigmoid(x))
}
