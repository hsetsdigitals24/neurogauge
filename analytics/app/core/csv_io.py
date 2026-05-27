import io
import csv
from typing import Any
import pandas as pd


def df_to_table(df: pd.DataFrame) -> dict[str, Any]:
    headers = list(df.columns)
    rows = df.where(pd.notnull(df), None).values.tolist()

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(headers)
    for r in rows:
        writer.writerow(["" if v is None else v for v in r])

    return {"csv": buf.getvalue(), "headers": headers, "rows": rows}
