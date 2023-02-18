package main

import (
	"fmt"
	"nn/pkg/network"
)

func main() {
	// fmt.Println("test :)")

	n := network.NewNetwork(2, 3, 1)
	n.DenseConnect()

	trainingData := [][][]float64{}
	for i := 0.0; i < 1; i += 0.01 {
		for z := 0.0; z < 1; z += 0.01 {
			foo := 0.0
			if i > z {
				foo = 1
			}
			trainingData = append(trainingData, [][]float64{
				{i, z},
				{foo},
			})
		}
	}

	// n.Train([][][]float64{
	// 	{
	// 		{0.4, 0.1},
	// 		{1},
	// 	},
	// 	{
	// 		{0.1, 0.2},
	// 		{0},
	// 	},
	// 	{
	// 		{0.01, 0.005},
	// 		{1},
	// 	},
	// 	{
	// 		{0.6, 0.2},
	// 		{0},
	// 	},
	// }, 10)

	n.Train(trainingData, 2000)

	// fmt.Println("I don't know if it did anything, but it's done!")
	fmt.Println(n.Activate([]float64{0.2, 0.4}))
	fmt.Println(n.Activate([]float64{0.3, 0.1}))
	fmt.Println(n.Activate([]float64{0.2, 0.45}))
	fmt.Println(n.Activate([]float64{0.6, 0.3}))

	// jstr, err := json.MarshalIndent(n, "", "  ")
	// if err != nil {
	// 	panic(err)
	// } else {
	// 	fmt.Println(string(jstr))
	// }
}
