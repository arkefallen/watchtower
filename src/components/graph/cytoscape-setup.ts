import cytoscape from "cytoscape";
// @ts-expect-error - cytoscape-fcose is a standard cytoscape extension
import fcose from "cytoscape-fcose";

let registered = false;

export function registerCytoscapeExtensions() {
  if (!registered) {
    cytoscape.use(fcose);
    registered = true;
  }
}

/**
 * fCoSE layout tuned for a spread-out bubble-map aesthetic
 * matching InsightX / Bubblemaps spacing.
 */
export const FCOSE_LAYOUT_OPTIONS = {
  name: "fcose",
  quality: "default",
  randomize: false,
  animate: true,
  animationDuration: 600,
  animationEasing: "ease-out",
  fit: true,
  padding: 60,
  nodeDimensionsIncludeLabels: false, // labels are hidden by default now
  uniformNodeDimensions: false,
  packComponents: true,
  samplingType: true,
  sampleSize: 25,
  nodeSeparation: 120,
  piTol: 0.0000001,
  nodeRepulsion: (_node: any) => 8000,
  idealEdgeLength: (_edge: any) => 180,
  edgeElasticity: (_edge: any) => 0.35,
  nestingFactor: 0.1,
  gravity: 0.15,
  numIter: 1200,
  tile: true,
  tilingPaddingVertical: 30,
  tilingPaddingHorizontal: 30,
  gravityRangeCompound: 1.5,
  gravityCompound: 1.0,
  gravityRange: 3.8,
};
