// ==============================================================
// HIJO RESOURCE CORPORATION - BANANA TRACKING CHAINCODE
// ==============================================================
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type BananaBatch struct {
		BatchID				string	`json:"batchId"`
		FarmLocation		string	`json:"farmLocation"`
		HarvestDate			string	`json:"harvestDate"`
		WeightKg			float64	`json:"weightKg"`
		CurrentOwner		string	`json:"currentOwner"`
		TransportStatus		string	`json:"transportStatus"`
		TemperatureDegC		float64	`json:"temperatureDegC"`
		PortCustomsClear	bool	`json:"portCustomsClear"`
		UpdatedByUID			string	`json:"updatedByUid"`
}

type SmartContract struct {
		contractapi.Contract
}

func (s *SmartContract) CreateBatch(ctx contractapi.TransactionContextInterface, 
	batchID string, farmLoc string, harvestDate string, weight float64, uid string) error {
		exists, err	:= s.BatchExists(ctx, batchID)
		if err != nil { return err }
		if exists { return fmt.Errorf("batch asset %s already exists", batchID) }

		batch := BananaBatch{
				BatchID:			batchID,
				FarmLocation:		farmLoc,
				HarvestDate:		harvestDate,
				WeightKg:			weight,
				CurrentOwner:		"Hijo Agriculture",
				TransportStatus:	"HARVESTED_AT_FARM",
				TemperatureDegC:	18.0,
				PortCustomsClear:	false,
				UpdatedByUID:		uid,
		}

		batchBytes, err := json.Marshal(batch)
		if err != nil { return err }
		return ctx.GetStub().PutState(batchID, batchBytes)
}

func (s *SmartContract) UpdateTransportTelemetry(ctx contractapi.TransactionContextInterface, 
	batchID string, status string, temp float64, newOwner string, uid string) error {
		batch, err := s.QueryBatch(ctx, batchID)
		if err != nil { return err }
	
		batch.TransportStatus	=	status
		batch.TemperatureDegC	=	temp
		batch.CurrentOwner		=	newOwner
		batch.UpdatedByUID		=	uid

		batchBytes, err := json.Marshal(batch)
		if err != nil { return err }
		return ctx.GetStub().PutState(batchID, batchBytes)
}

func (s *SmartContract) ClearForExport(ctx contractapi.TransactionContextInterface, 
	batchID string, uid string) error {
	batch, err := s.QueryBatch(ctx, batchID)
	if err != nil { return err }

	batch.PortCustomsClear	=	true
	batch.TransportStatus	=	"LOADED_ON_VESSEL"
	batch.UpdatedByUID		=	uid
	batchBytes, err := json.Marshal(batch)
	if err != nil { return err }
	return ctx.GetStub().PutState(batchID, batchBytes)
}

func (s *SmartContract) QueryBatch(ctx contractapi.TransactionContextInterface, 
	batchID string) (*BananaBatch, error)  {
		batchBytes, err := ctx.GetStub().GetState(batchID)
		if err != nil { return nil, fmt.Errorf("failed to read world state: %v", err) }
		if batchBytes == nil { return nil, fmt.Errorf("batch %s does not exist", batchID) }

		var batch BananaBatch
		err = json.Unmarshal(batchBytes, &batch)
		if err != nil { return nil, err}
		return &batch, nil
}

func (s *SmartContract) BatchExists(ctx contractapi.TransactionContextInterface, 
	batchID string) (bool, error)  {
	batchBytes, err := ctx.GetStub().GetState(batchID)
	if err != nil { return false, err }
	return batchBytes != nil, nil
}

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating chaincode: %s\n", err)
		return
	}

	address := os.Getenv("CHAINCODE_SERVER_ADDRESS")
	if address != "" {
		ccid := os.Getenv("CHAINCODE_ID")
		server := &shim.ChaincodeServer{
			CCID:    ccid,
			Address: address,
			CC:      cc,
			TLSProps: shim.TLSProperties{
				Disabled: true,
			},
		}
		if err := server.Start(); err != nil {
			fmt.Printf("Error starting chaincode server: %s\n", err)
		}
	} else {
		if err := cc.Start(); err != nil {
			fmt.Printf("Error starting chaincode: %s\n", err)
		}
	}
}