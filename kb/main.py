import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from loguru import logger

app = FastAPI()

KB_FILE = Path(__file__).parent / "knowledge_base.json"

def load_kb():
    if not KB_FILE.exists():
        return []
    with open(KB_FILE, "r") as f:
        return json.load(f)

@app.get("/kb/all")
async def get_all_procedures():
    kb = load_kb()
    return [p["procedure_name"] for p in kb]

@app.get("/kb/search")
async def search_procedures(q: str):
    kb = load_kb()
    q = q.lower()
    results = []
    for p in kb:
        if q in p["procedure_name"].lower() or any(q in name.lower() for name in p.get("common_names", [])):
            results.append(p)
    return results

@app.get("/kb/{procedure_name}")
async def get_procedure(procedure_name: str):
    kb = load_kb()
    for p in kb:
        if procedure_name.lower() in p["procedure_name"].lower() or any(procedure_name.lower() in name.lower() for name in p.get("common_names", [])):
            return p
    raise HTTPException(status_code=404, detail="Procedure not found")

@app.get("/kb/step/{procedure}/{step_number}")
async def get_step(procedure: str, step_number: int):
    kb = load_kb()
    for p in kb:
        if procedure.lower() in p["procedure_name"].lower():
            for step in p.get("steps", []):
                if step.get("number") == step_number:
                    return step
    raise HTTPException(status_code=404, detail="Procedure or step not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
