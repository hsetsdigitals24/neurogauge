from fastapi import FastAPI

from app import VERSION
from app.routers import (
    anova, chi_square, correlation, descriptive, normality,
    regression, reliability, roc, ttest,
)

app = FastAPI(title="Neurogauge Analytics", version=VERSION)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "version": VERSION}


app.include_router(descriptive.router, prefix="/v1")
app.include_router(normality.router, prefix="/v1")
app.include_router(ttest.router, prefix="/v1")
app.include_router(correlation.router, prefix="/v1")
app.include_router(chi_square.router, prefix="/v1")
app.include_router(anova.router, prefix="/v1")
app.include_router(regression.router, prefix="/v1")
app.include_router(reliability.router, prefix="/v1")
app.include_router(roc.router, prefix="/v1")
