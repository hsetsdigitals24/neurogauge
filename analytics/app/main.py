from fastapi import FastAPI

from app import VERSION
from app.routers import (
    anova, chi_square, correlation, descriptive, friedman, kruskal, mann_whitney,
    modelling, normality, regression, reliability, roc, sem, ttest, wilcoxon,
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
app.include_router(mann_whitney.router, prefix="/v1")
app.include_router(wilcoxon.router, prefix="/v1")
app.include_router(kruskal.router, prefix="/v1")
app.include_router(friedman.router, prefix="/v1")
app.include_router(regression.router, prefix="/v1")
app.include_router(reliability.router, prefix="/v1")
app.include_router(roc.router, prefix="/v1")
app.include_router(modelling.router, prefix="/v1")
app.include_router(sem.router, prefix="/v1")
