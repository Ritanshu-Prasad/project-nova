import os
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Project Nova API")

# Allow requests from our Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve the uploaded files statically so the frontend can display them
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"status": "System Online", "service": "Project Nova API"}

@app.post("/api/users/avatar/upload")
async def upload_avatar(file: UploadFile = File(...)):
    """
    Endpoint to handle uploading an image file for a user's avatar.
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return the URL path where the frontend can fetch the image
    return {
        "status": "success",
        "filename": file.filename,
        "url": f"/uploads/avatars/{file.filename}"
    }

@app.post("/api/users/avatar/doodle")
async def upload_doodle(file: UploadFile = File(...)):
    """
    Endpoint to handle uploading a custom doodle (usually sent as a base64 blob converted to file).
    """
    filename = f"doodle_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "status": "success",
        "filename": filename,
        "url": f"/uploads/avatars/{filename}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
