import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from .routers import auth, data, admin, stock, upload, archive, routes, export, refinery, debug, bi, solicitantes, maintenance
except (ImportError, ValueError):
    from routers import auth, data, admin, stock, upload, archive, routes, export, refinery, debug, bi, solicitantes, maintenance

app = FastAPI(
    title="Supply Systems 2026 - Absolute Perfection",
    description="Backend for Supply 2026 Protocol Management [Build: V3-PERFECTION]",
    version="3.0.0"
)

# CORS — Production: set SUPPLY_ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
_allowed_origins = os.environ.get("SUPPLY_ALLOWED_ORIGINS", "").strip()
cors_origins = [o.strip() for o in _allowed_origins.split(",") if o.strip()] if _allowed_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Supply Delivery System API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "3.0.0", "tag": "V3-PERFECTION"}

@app.get("/version")
def get_version():
    return {
        "version": "3.0.0",
        "tag": "V3-PERFECTION",
        "status": "Absolute System Perfection Achieved",
        "build_date": "2026-03-19"
    }

# Public
app.include_router(auth.router)

# Protected
app.include_router(admin.router) 
app.include_router(data.router)
app.include_router(upload.router)
app.include_router(stock.router)
app.include_router(archive.router)
app.include_router(routes.router)
app.include_router(export.router)
app.include_router(refinery.router)
app.include_router(debug.router)
app.include_router(bi.router)
app.include_router(solicitantes.router)
app.include_router(maintenance.router)
