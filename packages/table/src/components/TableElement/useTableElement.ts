import { useEffect } from 'react';
import {
  collapseSelection,
  findNodePath,
  getNode,
  getParentNode,
  getPluginOptions,
  PlateEditor,
  useEditorRef,
  useElement,
} from '@udecode/plate-common';
import { Path } from 'slate';

import { ELEMENT_TABLE } from '../../createTablePlugin';
import { useTableStore } from '../../stores/tableStore';
import {
  TablePlugin,
  TTableCellElement,
  TTableElement,
  TTableRowElement,
} from '../../types';
import { useSelectedCells } from './useSelectedCells';
import { useTableColSizes } from './useTableColSizes';

export interface TableElementState {
  colSizes: number[];
  isSelectingCell: boolean;
  minColumnWidth: number;
  marginLeft: number;
}

export const useTableElementState = ({
  transformColSizes,
}: {
  /**
   * Transform node column sizes
   */
  transformColSizes?: (colSizes: number[]) => number[];
} = {}): TableElementState => {
  const editor = useEditorRef();

  const { minColumnWidth, disableMarginLeft } = getPluginOptions<TablePlugin>(
    editor,
    ELEMENT_TABLE
  );

  const element = useElement<TTableElement>();
  const selectedCells = useTableStore().get.selectedCells();
  const marginLeftOverride = useTableStore().get.marginLeftOverride();

  // initial calc, than it will be calculated when each individual cell updated
  useEffect(() => {
    calculateCellIndexes(editor, element);
  }, [editor, element]);

  const marginLeft = disableMarginLeft
    ? 0
    : marginLeftOverride ?? element.marginLeft ?? 0;

  let colSizes = useTableColSizes(element);

  if (transformColSizes) {
    colSizes = transformColSizes(colSizes);
  }

  // add a last col to fill the remaining space
  if (!colSizes.includes(0)) {
    colSizes.push('100%' as any);
  }

  return {
    colSizes,
    isSelectingCell: !!selectedCells,
    minColumnWidth: minColumnWidth!,
    marginLeft,
  };
};

export const useTableElement = () => {
  const editor = useEditorRef();
  const selectedCells = useTableStore().get.selectedCells();

  useSelectedCells();

  return {
    props: {
      onMouseDown: () => {
        // until cell dnd is supported, we collapse the selection on mouse down
        if (selectedCells) {
          collapseSelection(editor);
        }
      },
    },
    colGroupProps: {
      contentEditable: false,
      style: { width: '100%' },
    },
  };
};

const cellAttributes = new WeakMap<
  TTableCellElement,
  { row: number; col: number }
>();

function getCellIndices(
  editor: PlateEditor,
  tableEl: TTableElement,
  tablePath: Path,
  cellPath: Path
) {
  const tableNodes = tableEl.children;

  let rowIndex = -1;
  let colIndex = -1;

  for (let r = 0; r < tableNodes.length; r++) {
    const row = tableNodes[r] as TTableRowElement;

    let cIndex = 0;
    for (let c = 0; c < row.children.length; c++) {
      const cell = row.children[c] as TTableCellElement;
      const curCellPath = [r, c];
      if (Path.equals(curCellPath, cellPath)) {
        colIndex = cIndex;
        rowIndex = r;
        break;
      }
      cIndex += cell.colSpan || 1; // consider 0 and undefined as 1
    }
  }

  tableNodes.slice(0, rowIndex).forEach((pR, _rowIndex) => {
    const prevRow = pR as TTableRowElement;
    prevRow.children.forEach((pC) => {
      const prevCell = pC as TTableCellElement;
      const prevIndices = cellAttributes.get(prevCell);
      if (prevIndices) {
        const { col: prevColIndex } = prevIndices;
        if (
          // colIndex affects
          prevColIndex <= colIndex &&
          // rowSpan affects
          prevCell.rowSpan &&
          prevCell.rowSpan > 1 &&
          rowIndex - _rowIndex < prevCell.rowSpan
        ) {
          colIndex += prevCell.colSpan || 1;
        }
      }
    });
  });

  if (rowIndex === -1 || colIndex === -1) {
    console.log('Invalid cell location.');
    return null;
  }

  return { row: rowIndex, col: colIndex };
}

const calculateCellIndexes = (
  editor: PlateEditor,
  tableNode: TTableElement
) => {
  // (Place the `getCellIndices()` function from the previous response here)

  // Initialize an array to store the indices of each cell
  const cellIndicesArray = [];

  const tablePath = findNodePath(editor, tableNode)!;

  // Iterate through the table rows
  for (let r = 0; r < tableNode.children.length; r++) {
    const row = tableNode.children[r] as TTableRowElement;
    const rowIndicesArray = [];

    // Iterate through the row cells
    for (let c = 0; c < row.children.length; c++) {
      const cell = row.children[c] as TTableCellElement;

      // Get cell indices and store them in the row's array
      // const cellPath = findNodePath(editor, cell)!; // TODO: use concat instead of findNodePath
      const cellPath = [r, c];
      console.log(
        'searching for',
        cell.children.map((m) => {
          return (m as any).children[0].text;
        }),
        tableNode,
        tablePath,
        cellPath
      );

      const indices = getCellIndices(editor, tableNode, tablePath, cellPath);
      if (indices) {
        cellAttributes.set(cell, indices);
      }
      rowIndicesArray.push(indices);
    }

    // Push the rowIndicesArray to the cellIndicesArray
    cellIndicesArray.push(rowIndicesArray);
  }

  console.log('cellIndicesArray', cellIndicesArray);
  return cellIndicesArray;
};
