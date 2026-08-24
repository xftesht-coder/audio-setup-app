import React from 'react';

export default function SpecsBox({ config }) {
  return (
    <div className="bg-amber-wash border border-l-4 border-amber/30 border-l-amber rounded-lg p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-amber mb-2">Потолок системы</p>
      <div className="text-xs space-y-1">
        <p className="text-amber font-medium">
          Пик: <span className="font-bold">{config.maxSpl}</span>
        </p>
        <p className="text-amber font-medium">
          Ограничитель: <span className="font-bold">{config.limiter}</span>
        </p>
        <p className="text-amber/60 text-xs mt-2">
          Признак упора: бочка сплющивается на пиках
        </p>
      </div>
    </div>
  );
}
