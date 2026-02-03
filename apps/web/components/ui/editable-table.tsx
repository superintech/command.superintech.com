'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

// Column definition
export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  editable?: boolean | ((row: T, userRole: string) => boolean);
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  render?: (value: unknown, row: T) => React.ReactNode;
  validate?: (value: unknown) => boolean | string;
}

// Props for the editable table
interface EditableTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ColumnDef<T>[];
  rowKey: keyof T;
  userRole?: string;
  readOnly?: boolean;
  onCellChange?: (rowKey: string, columnKey: string, value: unknown, row: T) => void;
  onRowChange?: (rowKey: string, changes: Partial<T>, row: T) => void;
  onSave?: (changes: Map<string, Partial<T>>) => Promise<void>;
  className?: string;
  stickyHeader?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

interface CellState {
  isEditing: boolean;
  value: unknown;
  originalValue: unknown;
}

export function EditableTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey,
  userRole = 'EMPLOYEE',
  readOnly = false,
  onCellChange,
  onRowChange,
  className,
  stickyHeader = false,
  maxHeight = '600px',
  emptyMessage = 'No data available',
}: EditableTableProps<T>) {
  const [editingCell, setEditingCell] = React.useState<{
    rowId: string;
    columnKey: string;
  } | null>(null);
  const [cellStates, setCellStates] = React.useState<
    Map<string, CellState>
  >(new Map());
  const [pendingChanges, setPendingChanges] = React.useState<
    Map<string, Partial<T>>
  >(new Map());
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);

  // Generate cell key
  const getCellKey = (rowId: string, columnKey: string) =>
    `${rowId}__${columnKey}`;

  // Check if cell is editable
  const isCellEditable = (column: ColumnDef<T>, row: T): boolean => {
    if (readOnly) return false;
    if (column.editable === false) return false;
    if (typeof column.editable === 'function') {
      return column.editable(row, userRole);
    }
    return column.editable === true;
  };

  // Get cell value
  const getCellValue = (row: T, columnKey: string): unknown => {
    const rowId = String(row[rowKey]);
    const cellKey = getCellKey(rowId, columnKey);
    const cellState = cellStates.get(cellKey);

    if (cellState && cellState.value !== undefined) {
      return cellState.value;
    }

    // Check pending changes
    const pending = pendingChanges.get(rowId);
    if (pending && columnKey in pending) {
      return pending[columnKey as keyof T];
    }

    return row[columnKey as keyof T];
  };

  // Handle cell click
  const handleCellClick = (
    row: T,
    column: ColumnDef<T>,
    e: React.MouseEvent
  ) => {
    if (!isCellEditable(column, row)) return;

    const rowId = String(row[rowKey]);
    const columnKey = column.key;
    const cellKey = getCellKey(rowId, columnKey);

    // If clicking on same cell, do nothing
    if (
      editingCell?.rowId === rowId &&
      editingCell?.columnKey === columnKey
    ) {
      return;
    }

    // Save current cell if editing
    if (editingCell) {
      saveCurrentCell();
    }

    // Start editing new cell
    const currentValue = getCellValue(row, columnKey);
    setCellStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(cellKey, {
        isEditing: true,
        value: currentValue,
        originalValue: currentValue,
      });
      return newMap;
    });

    setEditingCell({ rowId, columnKey });
  };

  // Handle cell value change
  const handleValueChange = (
    rowId: string,
    columnKey: string,
    value: unknown
  ) => {
    const cellKey = getCellKey(rowId, columnKey);
    setCellStates((prev) => {
      const newMap = new Map(prev);
      const current = prev.get(cellKey);
      newMap.set(cellKey, {
        isEditing: true,
        value,
        originalValue: current?.originalValue ?? value,
      });
      return newMap;
    });
  };

  // Save current cell
  const saveCurrentCell = () => {
    if (!editingCell) return;

    const { rowId, columnKey } = editingCell;
    const cellKey = getCellKey(rowId, columnKey);
    const cellState = cellStates.get(cellKey);

    if (!cellState) return;

    const row = data.find((r) => String(r[rowKey]) === rowId);
    if (!row) return;

    const column = columns.find((c) => c.key === columnKey);
    if (!column) return;

    // Validate if validator exists
    if (column.validate) {
      const validationResult = column.validate(cellState.value);
      if (validationResult !== true) {
        // Revert to original value
        setCellStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(cellKey);
          return newMap;
        });
        setEditingCell(null);
        return;
      }
    }

    // If value changed, update pending changes
    if (cellState.value !== cellState.originalValue) {
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        const existing = prev.get(rowId) || {};
        newMap.set(rowId, {
          ...existing,
          [columnKey]: cellState.value,
        } as Partial<T>);
        return newMap;
      });

      // Notify parent
      if (onCellChange) {
        onCellChange(rowId, columnKey, cellState.value, row);
      }
      if (onRowChange) {
        onRowChange(
          rowId,
          { [columnKey]: cellState.value } as Partial<T>,
          row
        );
      }
    }

    // Clear editing state
    setCellStates((prev) => {
      const newMap = new Map(prev);
      newMap.delete(cellKey);
      return newMap;
    });
    setEditingCell(null);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    const { rowId, columnKey } = editingCell;

    switch (e.key) {
      case 'Tab':
      case 'Enter': {
        e.preventDefault();
        saveCurrentCell();

        // Move to next cell
        const currentRowIndex = data.findIndex(
          (r) => String(r[rowKey]) === rowId
        );
        const currentColIndex = columns.findIndex(
          (c) => c.key === columnKey
        );

        let nextRow: T | undefined;
        let nextCol: ColumnDef<T> | undefined;

        if (e.key === 'Tab') {
          // Find next editable cell in same row
          for (
            let i = currentColIndex + 1;
            i < columns.length;
            i++
          ) {
            const col = columns[i];
            if (isCellEditable(col, data[currentRowIndex])) {
              nextCol = col;
              nextRow = data[currentRowIndex];
              break;
            }
          }

          // If not found, go to next row
          if (!nextCol && currentRowIndex < data.length - 1) {
            for (let i = 0; i < columns.length; i++) {
              const col = columns[i];
              if (
                isCellEditable(col, data[currentRowIndex + 1])
              ) {
                nextCol = col;
                nextRow = data[currentRowIndex + 1];
                break;
              }
            }
          }
        } else {
          // Enter: move to same column in next row
          if (currentRowIndex < data.length - 1) {
            nextRow = data[currentRowIndex + 1];
            nextCol = columns[currentColIndex];
          }
        }

        if (nextRow && nextCol && isCellEditable(nextCol, nextRow)) {
          const newRowId = String(nextRow[rowKey]);
          const newCellKey = getCellKey(newRowId, nextCol.key);
          const newValue = getCellValue(nextRow, nextCol.key);

          setCellStates((prev) => {
            const newMap = new Map(prev);
            newMap.set(newCellKey, {
              isEditing: true,
              value: newValue,
              originalValue: newValue,
            });
            return newMap;
          });

          setEditingCell({ rowId: newRowId, columnKey: nextCol.key });
        }
        break;
      }

      case 'Escape':
        // Cancel editing
        setCellStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(getCellKey(rowId, columnKey));
          return newMap;
        });
        setEditingCell(null);
        break;

      case 'ArrowUp':
      case 'ArrowDown': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          saveCurrentCell();

          const currentRowIndex = data.findIndex(
            (r) => String(r[rowKey]) === rowId
          );
          const direction = e.key === 'ArrowUp' ? -1 : 1;
          const newRowIndex = currentRowIndex + direction;

          if (newRowIndex >= 0 && newRowIndex < data.length) {
            const newRow = data[newRowIndex];
            const col = columns.find((c) => c.key === columnKey);

            if (col && isCellEditable(col, newRow)) {
              const newRowId = String(newRow[rowKey]);
              const newCellKey = getCellKey(newRowId, columnKey);
              const newValue = getCellValue(newRow, columnKey);

              setCellStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(newCellKey, {
                  isEditing: true,
                  value: newValue,
                  originalValue: newValue,
                });
                return newMap;
              });

              setEditingCell({ rowId: newRowId, columnKey });
            }
          }
        }
        break;
      }
    }
  };

  // Focus input when editing starts
  React.useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  // Render cell content
  const renderCell = (row: T, column: ColumnDef<T>) => {
    const rowId = String(row[rowKey]);
    const columnKey = column.key;
    const cellKey = getCellKey(rowId, columnKey);
    const cellState = cellStates.get(cellKey);
    const isEditing =
      editingCell?.rowId === rowId &&
      editingCell?.columnKey === columnKey;
    const value = getCellValue(row, columnKey);
    const editable = isCellEditable(column, row);

    // Check if there are pending changes for this cell
    const hasPendingChange =
      pendingChanges.get(rowId)?.[columnKey as keyof T] !== undefined;

    if (isEditing && cellState) {
      switch (column.type) {
        case 'select':
          return (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(cellState.value ?? '')}
              onChange={(e) =>
                handleValueChange(rowId, columnKey, e.target.value)
              }
              onBlur={saveCurrentCell}
              className="w-full h-8 px-2 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              {column.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );

        case 'textarea':
          return (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={String(cellState.value ?? '')}
              onChange={(e) =>
                handleValueChange(rowId, columnKey, e.target.value)
              }
              onBlur={saveCurrentCell}
              className="w-full h-16 px-2 py-1 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
            />
          );

        case 'number':
          return (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={String(cellState.value ?? '')}
              onChange={(e) =>
                handleValueChange(
                  rowId,
                  columnKey,
                  parseFloat(e.target.value) || 0
                )
              }
              onBlur={saveCurrentCell}
              className="h-8 w-full text-sm"
            />
          );

        default:
          return (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={String(cellState.value ?? '')}
              onChange={(e) =>
                handleValueChange(rowId, columnKey, e.target.value)
              }
              onBlur={saveCurrentCell}
              className="h-8 w-full text-sm"
            />
          );
      }
    }

    // Render display value
    const displayValue = column.render
      ? column.render(value, row)
      : value;

    // Check if displayValue is a React element (from custom render function)
    const isReactElement = React.isValidElement(displayValue);

    return (
      <div
        className={cn(
          'min-h-[2rem] flex items-center',
          editable && 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1',
          hasPendingChange && 'bg-yellow-100 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-100 rounded px-1'
        )}
      >
        {displayValue !== null && displayValue !== undefined
          ? isReactElement
            ? displayValue
            : typeof displayValue === 'object'
              ? JSON.stringify(displayValue)
              : String(displayValue)
          : '-'}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        className
      )}
      style={{ maxHeight }}
      onKeyDown={handleKeyDown}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        <Table ref={tableRef}>
          <TableHeader
            className={cn(
              stickyHeader && 'sticky top-0 bg-background z-10'
            )}
          >
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    'whitespace-nowrap'
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={String(row[rowKey])}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      style={{ width: column.width }}
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        'py-2'
                      )}
                      onClick={(e) =>
                        handleCellClick(row, column, e)
                      }
                    >
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default EditableTable;
