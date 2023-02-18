package main

import (
	"fmt"
	"nn/pkg/network"
)

func main() {
	// fmt.Println("test :)")

	n := network.NewNetwork(2, 3, 1)
	n.DenseConnect()
	model := []byte(`{
		"Inputs": [
		  {
			"_output": 1,
			"bias": 751.2867759757171,
			"error": 0.7482262750540738,
			"id": "2341a626-a5d2-4271-a4c9-b4d72b5b80f4",
			"incoming": {},
			"outgoing": {
			  "29455de8-576a-40fb-b789-777b0f5285ef": -36.24178763066521,
			  "9ef2ff7b-d4ec-47ee-afdd-53a261134a18": -36.241076871833435,
			  "a84763a8-32ad-4a82-8202-ad5623081a76": -36.24228677544943
			},
			"output": 0.6
		  },
		  {
			"_output": 1,
			"bias": 825.9500804767607,
			"error": -0.7483270267106221,
			"id": "af840469-d679-4666-9628-20c6dba55dcd",
			"incoming": {},
			"outgoing": {
			  "29455de8-576a-40fb-b789-777b0f5285ef": 36.24666768393721,
			  "9ef2ff7b-d4ec-47ee-afdd-53a261134a18": 36.24595731035501,
			  "a84763a8-32ad-4a82-8202-ad5623081a76": 36.247166559313484
			},
			"output": 0.3
		  }
		],
		"Hidden": [
		  {
			"_output": 0.000015316669479170635,
			"bias": -0.21546590694619525,
			"error": -0.00688158906389871,
			"id": "29455de8-576a-40fb-b789-777b0f5285ef",
			"incoming": {
			  "2341a626-a5d2-4271-a4c9-b4d72b5b80f4": -36.24178763066521,
			  "af840469-d679-4666-9628-20c6dba55dcd": 36.24666768393721
			},
			"outgoing": {
			  "152b9d78-dd36-40a9-93a4-56c40b7efeaa": -26.138957342733445
			},
			"output": 0.000015316904086721435
		  },
		  {
			"_output": 0.00001531973980280258,
			"bias": -0.21547880777005968,
			"error": -0.006883916489842361,
			"id": "9ef2ff7b-d4ec-47ee-afdd-53a261134a18",
			"incoming": {
			  "2341a626-a5d2-4271-a4c9-b4d72b5b80f4": -36.241076871833435,
			  "af840469-d679-4666-9628-20c6dba55dcd": 36.24595731035501
			},
			"outgoing": {
			  "152b9d78-dd36-40a9-93a4-56c40b7efeaa": -26.147838987386088
			},
			"output": 0.000015319974504421396
		  },
		  {
			"_output": 0.000015314513776724262,
			"bias": -0.21545683915013406,
			"error": -0.006879936702007341,
			"id": "a84763a8-32ad-4a82-8202-ad5623081a76",
			"incoming": {
			  "2341a626-a5d2-4271-a4c9-b4d72b5b80f4": -36.24228677544943,
			  "af840469-d679-4666-9628-20c6dba55dcd": 36.247166559313484
			},
			"outgoing": {
			  "152b9d78-dd36-40a9-93a4-56c40b7efeaa": -26.13265206116953
			},
			"output": 0.000015314748318240313
		  }
		],
		"Outputs": [
		  {
			"_output": 1.8873791418627305e-14,
			"bias": 31.604953247894663,
			"error": 0.0010654943984743938,
			"id": "152b9d78-dd36-40a9-93a4-56c40b7efeaa",
			"incoming": {
			  "29455de8-576a-40fb-b789-777b0f5285ef": -26.138957342733445,
			  "9ef2ff7b-d4ec-47ee-afdd-53a261134a18": -26.147838987386088,
			  "a84763a8-32ad-4a82-8202-ad5623081a76": -26.13265206116953
			},
			"outgoing": {},
			"output": 0.9999999999999811
		  }
		]
	  }`)

	err := n.LoadModel(model)
	if err != nil {
		panic(err)
	}

	// trainingData := [][][]float64{}
	// for i := 0.0; i < 1; i += 0.01 {
	// 	for z := 0.0; z < 1; z += 0.01 {
	// 		foo := 0.0
	// 		if i > z {
	// 			foo = 1
	// 		}
	// 		trainingData = append(trainingData, [][]float64{
	// 			{i, z},
	// 			{foo},
	// 		})
	// 	}
	// }

	// n.Train(trainingData, 2000)

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
