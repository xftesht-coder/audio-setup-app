import { parseListening } from './roomListening.js';

export const AGENT_ROLES = { system: 'Помощник', designer: 'Дизайнер' };
export function agentContext(report, wiring, project, finding = null) {
  return {
    version: 1,
    finding: finding ? { id: finding.id, title: finding.title, evidence: finding.evidence, next: finding.next } : null,
    findings: report.findings,
    components: wiring.components,
    listening: wiring.listening,
    cables: wiring.cables,
    room: { widthM: 6, depthM: 3.3, furniture: project },
    routes: report.routes.map(r => ({ target: r.name, status: r.status })),
  };
}
export function applyListeningProposal(current, proposal) {
  if (JSON.stringify(current) !== proposal.base) throw new Error('Настройки уже изменились. Попроси агента обновить предложение.');
  const patch = proposal.patch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['source', 'mode', 'freyaMode', 'inputs'].includes(key))) throw new Error('Некорректное предложение настроек.');
  return parseListening({ ...current, ...patch, inputs: { ...current.inputs, ...patch.inputs } });
}
