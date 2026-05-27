from typing import Any
from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    data: list[dict[str, Any]] = Field(..., description="Tidy long-format rows")
    variables: dict[str, Any] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)


class TableBlock(BaseModel):
    csv: str
    headers: list[str]
    rows: list[list[Any]]


class PlotSpec(BaseModel):
    type: str
    plotly: dict[str, Any]


class Meta(BaseModel):
    n: int
    duration_ms: int
    version: str


class AnalysisResponse(BaseModel):
    ok: bool = True
    stats: dict[str, Any]
    table: TableBlock
    plots: list[PlotSpec] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    meta: Meta
