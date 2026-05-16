import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { WaypointNode as WaypointNodeType } from "../types";
import { useSchematicStore } from "../store";

function WaypointNodeComponent({ data, selected }: NodeProps<WaypointNodeType>) {
  const edgeSelected = useSchematicStore((s) => {
    const edge = s.edges.find((e) => e.id === data.edgeId);
    return edge?.selected === true;
  });

  const visible = selected || edgeSelected;

  // r=5 visible dot when its edge is selected (matches the old in-edge circle).
  // When not visible, render an invisible point — React Flow still hit-tests
  // it for box-select via its internal rect, but we drop pointer-events so
  // clicks pass through to the edge underneath.
  const size = visible ? 10 : 6;
  const half = size / 2;

  // data-print-hide makes the existing PDF export CSS hide handles only during
  // actual capture (data-export-capturing). They stay visible/draggable in
  // print view (F9) so users can fine-tune routing while seeing page bounds.
  return (
    <div
      data-print-hide
      style={{
        width: size,
        height: size,
        marginLeft: -half,
        marginTop: -half,
        borderRadius: "50%",
        background: visible ? "white" : "transparent",
        border: visible ? `2px solid ${selected ? "#0b57d0" : "#1a73e8"}` : "none",
        boxShadow: selected ? "0 0 0 2px rgba(26,115,232,0.25)" : "none",
        cursor: "grab",
        pointerEvents: visible ? "all" : "none",
      }}
    />
  );
}

export default memo(WaypointNodeComponent);
