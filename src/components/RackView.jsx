import React, { useState } from 'react';
import { useRoutingStore } from '../store/routingStore';
import { CONNECTOR_TYPES } from '../data/devicePorts';
import { getCableStyle } from '../data/cableStyles';

const ROW_H = 22;
const HEADER_H = 34;
const COL_W = 230;
const COL_GAP = 40;

function Cap({ x, y, capStyle, color }) {
  if (capStyle === 'rca') {
    return (
      <>
        <circle cx={x - 3} cy={y} r={3.2} fill="#c1121f" />
        <circle cx={x + 3} cy={y} r={3.2} fill="#f5ebe0" stroke="#999" strokeWidth={0.5} />
      </>
    );
  }
  if (capStyle === 'xlr') {
    return (
      <>
        <circle cx={x} cy={y} r={5.5} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={x} cy={y} r={1.2} fill={color} />
      </>
    );
  }
  if (capStyle === 'speaker') {
    return (
      <>
        <rect x={x - 5} y={y - 2.5} width={5} height={5} fill="#c1121f" />
        <rect x={x} y={y - 2.5} width={5} height={5} fill="#111" />
      </>
    );
  }
  if (capStyle === 'optical') {
    return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={color} opacity={0.85} rx={1} />;
  }
  if (capStyle === 'coax') {
    return (
      <>
        <circle cx={x} cy={y} r={4} fill="none" stroke={color} strokeWidth={2} />
        <circle cx={x} cy={y} r={1.3} fill={color} />
      </>
    );
  }
  if (capStyle === 'ground') {
    return <circle cx={x} cy={y} r={2.5} fill={color} />;
  }
  if (capStyle === 'adapter') {
    return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={color} transform={`rotate(45 ${x} ${y})`} />;
  }
  return <circle cx={x} cy={y} r={3.5} fill={color} />;
}

export default function RackView({ rigId, modeId }) {
  const deviceSpecs = useRoutingStore((s) => s.getAllDeviceSpecs());
  const config = useRoutingStore((s) => s.getConfig(rigId, modeId));
  const activeCables = useRoutingStore((s) => s.getActiveCables(rigId, modeId));
  const selectedPort = useRoutingStore((s) => s.selectedPort);
  const startCableFrom = useRoutingStore((s) => s.startCableFrom);
  const finishCableTo = useRoutingStore((s) => s.finishCableTo);
  const setSelectedDevice = useRoutingStore((s) => s.setSelectedDevice);
  const [feedback, setFeedback] = useState(null);

  const order = config.devices;
  const columns = order.map((deviceId, colIdx) => ({
    deviceId,
    x: colIdx * (COL_W + COL_GAP) + 20,
  }));

  const maxPorts = Math.max(...order.map((id) => deviceSpecs[id].ports.length));
  const svgHeight = HEADER_H + maxPorts * ROW_H + 40;
  const svgWidth = columns.length * (COL_W + COL_GAP) + 20;

  const getPortY = (deviceId, portId) => {
    const spec = deviceSpecs[deviceId];
    const idx = spec.ports.findIndex((p) => p.id === portId);
    return HEADER_H + idx * ROW_H + ROW_H / 2 + 10;
  };

  const getColX = (deviceId) => {
    const col = columns.find((c) => c.deviceId === deviceId);
    return col ? col.x : 0;
  };

  const isPortOutput = (port) => port.direction === 'output' || port.direction === 'io';

  const handlePortClick = (deviceId, port) => {
    if (!selectedPort) {
      if (isPortOutput(port)) {
        startCableFrom(deviceId, port.id);
      } else {
        setFeedback({ type: 'error', text: 'Начни с выходного порта (output)' });
        setTimeout(() => setFeedback(null), 2500);
      }
      return;
    }
    if (selectedPort.device === deviceId && selectedPort.port === port.id) return;
    const result = finishCableTo(deviceId, port.id);
    if (result.success) {
      setFeedback({
        type: result.hasCritical ? 'error' : result.warnings.length ? 'warning' : 'success',
        text: result.hasCritical
          ? '🔴 Критичное предупреждение! Смотри панель справа.'
          : `Кабель подключен${result.warnings.length ? `, замечаний: ${result.warnings.length}` : ''}`,
      });
    } else {
      setFeedback({ type: 'error', text: result.error });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="bg-card border border-rule rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-ink">
          {config.rigName} · {config.modeName}
        </p>
        {feedback && (
          <div
            className={`text-xs px-3 py-1.5 rounded font-medium ${
              feedback.type === 'error'
                ? 'bg-stop-wash text-stop'
                : feedback.type === 'warning'
                ? 'bg-amber-wash text-amber'
                : 'bg-go-wash text-go'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} style={{ minWidth: '100%' }}>
          {activeCables.map((cable, cableIdx) => {
            const style = getCableStyle(cable.connectorType);
            const fromX = getColX(cable.from.device) + COL_W;
            const fromY = getPortY(cable.from.device, cable.from.port);
            const toX = getColX(cable.to.device);
            const toY = getPortY(cable.to.device, cable.to.port);
            const corridorKey = Math.round((fromX + toX) / 2 / 20);
            const laneIndex = activeCables
              .slice(0, cableIdx)
              .filter((c) => {
                const fx = getColX(c.from.device) + COL_W;
                const tx = getColX(c.to.device);
                return Math.round((fx + tx) / 2 / 20) === corridorKey;
              }).length;
            const stubX1 = fromX + 14 + laneIndex * 6;
            const stubX2 = toX - 14 - laneIndex * 6;

            return (
              <g key={cable.id}>
                <path
                  d={`M ${fromX} ${fromY} L ${stubX1} ${fromY} L ${stubX1} ${toY} L ${stubX2} ${toY} L ${toX} ${toY}`}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash || undefined}
                  fill="none"
                  opacity={0.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Cap x={fromX} y={fromY} capStyle={style.cap} color={style.color} />
                <Cap x={toX} y={toY} capStyle={style.cap} color={style.color} />
              </g>
            );
          })}

          {columns.map(({ deviceId, x }) => {
            const spec = deviceSpecs[deviceId];
            return (
              <g key={deviceId}>
                <rect
                  x={x}
                  y={0}
                  width={COL_W}
                  height={HEADER_H}
                  fill={spec.color}
                  stroke="#3A2A1A"
                  strokeWidth="1"
                  rx="4"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedDevice(deviceId)}
                />
                <text
                  x={x + COL_W / 2}
                  y={HEADER_H / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#2A1A0A"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedDevice(deviceId)}
                >
                  {spec.name}
                </text>

                <rect
                  x={x}
                  y={HEADER_H + 6}
                  width={COL_W}
                  height={spec.ports.length * ROW_H + 8}
                  fill="#FFFFFF"
                  stroke="#CBD6D2"
                  strokeWidth="1"
                  rx="4"
                />

                {spec.ports.map((port, idx) => {
                  const rowY = HEADER_H + 10 + idx * ROW_H;
                  const portY = rowY + ROW_H / 2;
                  const connColor = CONNECTOR_TYPES[port.type]?.color || '#999';
                  const isOutput = isPortOutput(port);
                  const portX = isOutput ? x + COL_W - 12 : x + 12;
                  const isSelected = selectedPort?.device === deviceId && selectedPort?.port === port.id;
                  const isConnected = activeCables.some(
                    (c) =>
                      (c.from.device === deviceId && c.from.port === port.id) ||
                      (c.to.device === deviceId && c.to.port === port.id)
                  );

                  return (
                    <g key={port.id}>
                      <rect
                        x={x + 2}
                        y={rowY}
                        width={COL_W - 4}
                        height={ROW_H - 2}
                        fill={isSelected ? '#FFF3D6' : isConnected ? '#F0F7F4' : 'transparent'}
                        rx="2"
                      />
                      <circle
                        cx={isOutput ? x + COL_W - 22 : x + 22}
                        cy={portY}
                        r="3.5"
                        fill={isConnected ? '#2A6B4A' : '#CBD6D2'}
                      />
                      <text
                        x={isOutput ? x + 8 : x + 30}
                        y={portY + 3.5}
                        fontSize="9.5"
                        fill={port.critical ? '#9C1F36' : '#11171A'}
                        fontWeight={port.critical ? '700' : '500'}
                        textAnchor="start"
                      >
                        {port.label}
                      </text>
                      <text
                        x={x + COL_W - 4}
                        y={portY + 3.5}
                        fontSize="8"
                        fill={isConnected ? '#2A6B4A' : '#8A9997'}
                        textAnchor="end"
                        fontWeight="600"
                      >
                        {isConnected ? 'ЗАНЯТ' : 'своб.'}
                      </text>
                      <circle
                        cx={portX}
                        cy={portY}
                        r={isSelected ? 7 : 5}
                        fill={isConnected ? connColor : '#fff'}
                        stroke={connColor}
                        strokeWidth="2"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handlePortClick(deviceId, port)}
                      >
                        <title>{port.label} ({isOutput ? 'output' : 'input'}) — {port.type}</title>
                      </circle>
                      {port.critical && (
                        <circle cx={portX} cy={portY} r="9" fill="none" stroke="#9C1F36" strokeWidth="1" strokeDasharray="2,2" />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-rule pt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-go" />
          <span className="text-xs text-muted">Порт занят</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#CBD6D2' }} />
          <span className="text-xs text-muted">Порт свободен</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-stop border-dashed" />
          <span className="text-xs text-muted">Критичный вход (требует особого сигнала)</span>
        </div>
      </div>
    </div>
  );
}
