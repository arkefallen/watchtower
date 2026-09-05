// src/components/radar/MovementGroupCard.tsx
import React from "react";

export const MovementGroupCard: React.FC<{ group?: any }> = ({ group }) => {
  return (
    <div style={{ padding: "1rem", border: "1px solid #30373D", borderRadius: "0px" }}>
      <p>Movement Group Card (placeholder)</p>
      {group && <pre style={{ fontSize: "0.75rem" }}>{JSON.stringify(group, null, 2)}</pre>}
    </div>
  );
};

export default MovementGroupCard;
