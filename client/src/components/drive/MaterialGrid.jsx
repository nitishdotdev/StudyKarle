import React from "react";
import MaterialCard from "./MaterialCard";

export default function MaterialGrid({ files }) {
  if (!files || files.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-gutter">
      {files.map(function (file) {
        return <MaterialCard key={file.nodeId} file={file} />;
      })}
    </div>
  );
}
