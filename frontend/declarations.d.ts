declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.woff2" {
  const path: string;
  export default path;
}

declare module "*.txt?raw" {
  const content: string;
  export default content;
}

declare module "phyloxonium" {
  import { FC } from "react";

  interface PhyloxoniumGLComponentProps {
    size: { width: number; height: number };
    source: string;
    type?: string;
    useDevicePixels?: boolean | number;
    interactive?: boolean | Record<string, boolean>;
    fontSize?: number;
    fontFamily?: string;
    haloWidth?: number;
    haloRadius?: number;
    treeToCanvasRatio?: number;
    zoom?: number;
    stepZoom?: number;
    branchZoom?: number;
    nodeSize?: number;
    showShapes?: boolean;
    strokeWidth?: number;
    showEdges?: boolean;
    plugins?: unknown[];
    alignLabels?: boolean;
    showLabels?: boolean;
    showLeafLabels?: boolean;
  }

  export const PhyloxoniumGLComponent: FC<PhyloxoniumGLComponentProps>;
}

declare module "@phylocanvas/phylocanvas.gl" {
  interface NodeStyle {
    fillColour?: number[];
    strokeColour?: number[];
    fontColour?: number[];
    label?: string;
  }

  interface TreeNode {
    id: string;
    label: string;
    isLeaf: boolean;
    isHidden: boolean;
    totalNodes: number;
    preIndex: number;
    postIndex: number;
    children: TreeNode[];
  }

  interface TreeGraph {
    rootNode: TreeNode;
    preorderTraversal: TreeNode[];
    postorderTraversal: TreeNode[];
    nodeById: Record<string, TreeNode>;
  }

  interface TreeOptions {
    source: string;
    type?: string;
    interactive?: boolean;
    showLabels?: boolean;
    showLeafLabels?: boolean;
    showInternalLabels?: boolean;
    alignLabels?: boolean;
    fontSize?: number;
    nodeSize?: number;
    strokeWidth?: number;
    zoom?: number;
    branchZoom?: number;
    stepZoom?: number;
    padding?: number;
    styleLeafLabels?: boolean;
    styleNodeEdges?: boolean;
    styles?: Record<string, NodeStyle>;
    selectedIds?: string[];
    [key: string]: unknown;
  }

  export class PhylocanvasGL {
    constructor(container: HTMLElement, options: TreeOptions);
    destroy(): void;
    setProps(props: Partial<TreeOptions>): void;
    fitInPanel(): void;
    findNodeById(id: string): TreeNode | null;
    getGraphAfterLayout(): TreeGraph;
  }

  export const TreeTypes: {
    Rectangular: string;
    Radial: string;
    Circular: string;
    Diagonal: string;
    Hierarchical: string;
    [key: string]: string;
  };
}
