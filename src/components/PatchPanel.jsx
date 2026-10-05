import { useRoutingStore } from '../store/routingStore';
import RackView from './RackView';
import CableTable from './CableTable';
import ValidationPanel from './ValidationPanel';
import DeviceDetailPanel from './DeviceDetailPanel';

export default function PatchPanel() {
  const selectedRig = useRoutingStore(s => s.selectedRig);
  const selectedMode = useRoutingStore(s => s.selectedMode);
  const selectedDevice = useRoutingStore(s => s.selectedDevice);
  return <div className="patch-grid"><div className="flex flex-col gap-4"><RackView rigId={selectedRig} modeId={selectedMode} /><CableTable rigId={selectedRig} modeId={selectedMode} /></div><div className="flex flex-col gap-4">{selectedDevice ? <DeviceDetailPanel deviceId={selectedDevice} /> : <ValidationPanel rigId={selectedRig} modeId={selectedMode} />}</div></div>;
}
