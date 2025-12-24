export interface User {
  id: string;
  name: string | null;
  email: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
}

export type SheetData = {
  name: string;
  columns: string[];
  rows: string[][];
};

export type PreviewRow = {
  rowNumber: number;
  question: string;
  cells: Record<string, string>;
  selected: boolean;
  sourceTab: string;
};

export const styles = {
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  label: {
    display: "block" as const,
    fontWeight: 600,
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5f5",
    marginBottom: "12px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};
