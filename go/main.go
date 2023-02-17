package main

import (
	"fmt"
	"nn/pkg/network"
)

func main() {
	fmt.Println("test :)")

	n := network.NewNetwork(1, 15, 1)
	n.DenseConnect()

	// trainingData := make([][][]float64, 1000)
	// for i := range trainingData {
	// 	input := rand.Float64()
	// 	var output float64
	// 	if input >= 0.5 {
	// 		output = 1
	// 	} else {
	// 		output = 0
	// 	}
	// 	trainingData[i] = [][]float64{
	// 		{input},
	// 		{output},
	// 	}
	// }

	n.Train([][][]float64{
		{
			{1, 0},
			{1},
		},
		{
			{0, 1},
			{1},
		},
		{
			{1, 1},
			{0},
		},
		{
			{0, 0},
			{0},
		},
	}, 20)

	fmt.Println("I don't know if it did anything, but it's done!")
	// foo := 0.0
	// for foo < 1.1 {
	// 	fmt.Println(foo, n.Activate([]float64{foo}))
	// 	foo += 0.1
	// }

	fmt.Println(n.Activate([]float64{1, 0}))
	fmt.Println(n.Activate([]float64{1, 1}))
	fmt.Println(n.Activate([]float64{0, 0}))
	fmt.Println(n.Activate([]float64{0, 1})) // these are way off, probably a bug translating the training algorithm

	// jstr, err := json.MarshalIndent(n, "", "  ")
	// if err != nil {
	// 	panic(err)
	// } else {
	// 	fmt.Println(string(jstr))
	// }
}
