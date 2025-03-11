from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sheets_storage import storage
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Contract(BaseModel):
    companyName: str
    inn: str
    director: str
    address: str
    endDate: str
    comments: Optional[str] = ""
    hasND: bool = False

class ContractResponse(Contract):
    id: int

@app.get("/api/contracts", response_model=List[ContractResponse])
async def get_contracts():
    try:
        logger.info("Getting all contracts")
        contracts = storage.get_all_contracts()
        logger.info(f"Retrieved {len(contracts)} contracts")
        return contracts
    except Exception as e:
        logger.error(f"Error getting contracts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/contracts", response_model=ContractResponse)
async def create_contract(contract: Contract):
    try:
        return storage.add_contract(contract.dict())
    except Exception as e:
        logger.error(f"Error creating contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(contract_id: int, contract: Contract):
    try:
        updated = storage.update_contract(contract_id, contract.dict())
        if not updated:
            raise HTTPException(status_code=404, detail="Contract not found")
        return updated
    except Exception as e:
        logger.error(f"Error updating contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contracts/{contract_id}", response_model=ContractResponse)
async def get_contract(contract_id: int):
    try:
        contract = storage.get_contract(contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        return contract
    except Exception as e:
        logger.error(f"Error getting contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)