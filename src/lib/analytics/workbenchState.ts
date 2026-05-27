import type { ColumnSchema } from "./dataset";

export type StimulusType = "letters" | "shapes" | "rotated-e";
export type Level = 0 | 1 | 2 | 3;

export interface NBackFilter {
  stimType: StimulusType | null;
  level: Level | null;
}

export interface WorkbenchState {
  rows: Record<string, unknown>[];
  schema: Record<string, ColumnSchema>;
  nbackFilter: NBackFilter | null;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: 50 | 100 | 200 | 500;
  visibleColumns: string[];
  importedRows: Record<string, unknown>[];
}

export type WorkbenchAction =
  | { type: "setNBackFilter"; filter: NBackFilter | null }
  | { type: "setSort"; col: string; dir: "asc" | "desc" }
  | { type: "setPage"; page: number }
  | { type: "setPageSize"; size: WorkbenchState["pageSize"] }
  | { type: "toggleColumn"; col: string }
  | { type: "setVisibleColumns"; cols: string[] }
  | { type: "mergeImport"; rows: Record<string, unknown>[] }
  | { type: "reset" };

export function makeInitialState(
  rows: Record<string, unknown>[],
  schema: Record<string, ColumnSchema>
): WorkbenchState {
  return {
    rows,
    schema,
    nbackFilter: null,
    sortCol: null,
    sortDir: "asc",
    page: 0,
    pageSize: 200,
    visibleColumns: Object.keys(schema),
    importedRows: [],
  };
}

export function workbenchReducer(
  state: WorkbenchState,
  action: WorkbenchAction
): WorkbenchState {
  switch (action.type) {
    case "setNBackFilter":
      return { ...state, nbackFilter: action.filter, page: 0 };
    case "setSort":
      return { ...state, sortCol: action.col, sortDir: action.dir, page: 0 };
    case "setPage":
      return { ...state, page: action.page };
    case "setPageSize":
      return { ...state, pageSize: action.size, page: 0 };
    case "toggleColumn": {
      const visible = state.visibleColumns.includes(action.col)
        ? state.visibleColumns.filter((c) => c !== action.col)
        : [...state.visibleColumns, action.col];
      return { ...state, visibleColumns: visible };
    }
    case "setVisibleColumns":
      return { ...state, visibleColumns: action.cols };
    case "mergeImport":
      return { ...state, importedRows: [...state.importedRows, ...action.rows] };
    case "reset":
      return { ...state, nbackFilter: null, sortCol: null, sortDir: "asc", page: 0, importedRows: [] };
    default:
      return state;
  }
}

export function deriveRows(state: WorkbenchState): Record<string, unknown>[] {
  const allRows = [...state.rows, ...state.importedRows];
  let result = allRows;

  if (state.nbackFilter) {
    const { stimType, level } = state.nbackFilter;
    result = result.filter((r) => {
      if (stimType && r.stim_type !== stimType) return false;
      if (level !== null && r.level !== level) return false;
      return true;
    });
  }

  if (state.sortCol) {
    const col = state.sortCol;
    const dir = state.sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return result;
}
