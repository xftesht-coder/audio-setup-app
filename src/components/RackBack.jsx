import React from 'react';
import { useSetupStore } from '../store/setupStore';

export default function RackBack({ config }) {
  const selectedComponent = useSetupStore((state) => state.selectedComponent);
  const setSelectedComponent = useSetupStore((state) => state.setSelectedComponent);
  const getAllComponents = useSetupStore((state) => state.getAllComponents);

  const allComponents = getAllComponents();
  const componentPositions = {
    turntable: { x: 20, y: 80 },
    phono: { x: 120, y: 80 },
    dac_fiio: { x: 20, y: 160 },
    dac_cayin: { x: 20, y: 160 },
    a90: { x: 120, y: 160 },
    arcam: { x: 220, y: 160 },
    speakers: { x: 340, y: 60 },
  };

  const componentColors = {
    turntable: '#D4C5B9',
    phono: '#D4B5A0',
    dac_fiio: '#C4A5A0',
    dac_cayin: '#B5A5A0',
    a90: '#A59585',
    arcam: '#9A8575',
    speakers: '#8A7565',
  };

  const width = 500;
  const height = 280;

  return (
    <div className="flex justify-center">
      <svg width={width} height={height} style={{ border: '2px solid #5A4A3A', background: '#C8B8A8' }}>
        <defs>
          <linearGradient id="woodGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#9A8A7A', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#6A5A4A', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        <rect width={width} height={height} fill="url(#woodGradBack)" />

        <rect x="10" y="10" width={width - 20} height={height - 20} fill="none" stroke="#8B7355" strokeWidth="3" rx="4" />
        <rect x="15" y="15" width={width - 30} height={height - 30} fill="none" stroke="#A0826D" strokeWidth="1" rx="4" />

        {config.components.map((compKey) => {
          const comp = allComponents[compKey];
          const pos = componentPositions[compKey];

          if (!comp || !pos || !comp.hasBack) return null;

          return (
            <g
              key={compKey}
              onClick={() => setSelectedComponent(compKey)}
              style={{ cursor: 'pointer' }}
              className="component-group"
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={comp.width}
                height={comp.height}
                fill={componentColors[compKey]}
                stroke="#3A2A1A"
                strokeWidth="1"
                rx="2"
                opacity={selectedComponent === compKey ? 1 : 0.85}
                style={{
                  filter: selectedComponent === compKey ? 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' : 'none',
                }}
              />

              <circle cx={pos.x + 10} cy={pos.y + 10} r="3" fill="#FF6B6B" />
              <circle cx={pos.x + comp.width - 10} cy={pos.y + 10} r="3" fill="#FF6B6B" />
              <circle cx={pos.x + 10} cy={pos.y + comp.height - 10} r="3" fill="#4ECDC4" />
              <circle cx={pos.x + comp.width - 10} cy={pos.y + comp.height - 10} r="3" fill="#4ECDC4" />

              <text
                x={pos.x + comp.width / 2}
                y={pos.y + comp.height / 2 + 4}
                textAnchor="middle"
                fontSize="10"
                fill="#2A1A0A"
                fontWeight="500"
                pointerEvents="none"
              >
                {comp.name.split(' ')[0]}
              </text>
            </g>
          );
        })}

        <text x="10" y={height - 5} fontSize="10" fill="#3A2A1A" fontWeight="500">
          Вид сзади • {config.name}
        </text>
      </svg>
    </div>
  );
}
