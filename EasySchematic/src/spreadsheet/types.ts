import type { ReactNode } from "react";

export interface CellAddress {
  rowIndex: number;
  columnId: string;
}

export interface FillSeriesConfig {
  label: string;
  generateSeries(start: string, count: number, step: number): string[];
  defaultStep: number;
  stepLabel: string;
  validate?(value: string): boolean;
}

export interface SpreadsheetColumn<TRow> {
  id: string;
  header: string;
  getValue: (row: TRow) => string;
  editable?: boolean | ((row: TRow) => boolean);
  fillType?: string;
  renderEditor?: (props: {
    value: string;
    onChange: (v: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    autoFocus: boolean;
  }) => ReactNode;
}
