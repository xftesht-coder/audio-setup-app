// ============================================================
// СТИЛИ КАБЕЛЕЙ — приближено к реальным индустриальным цветам
// ============================================================

export const CABLE_STYLE = {
  RCA:            { color: '#1a1a1a', width: 2.5, cap: 'rca',     name: 'RCA межблочный' },
  XLR:            { color: '#2b2b2b', width: 3.5, cap: 'xlr',     name: 'XLR балансный' },
  USB_C:          { color: '#495057', width: 2,   cap: 'usb',     name: 'USB-C цифровой' },
  USB_B:          { color: '#495057', width: 2,   cap: 'usb',     name: 'USB-B цифровой' },
  OPTICAL:        { color: '#e85d04', width: 2,   cap: 'optical', name: 'Optical (Toslink)' },
  COAXIAL:        { color: '#f4c430', width: 2.5, cap: 'coax',    name: 'Coaxial цифровой' },
  SPEAKER:        { color: '#111111', width: 5,   cap: 'speaker', name: 'Акустический' },
  JACK_3_5:       { color: '#5a5a5a', width: 2,   cap: 'jack',    name: '3.5mm Jack' },
  JACK_4_4:       { color: '#5a5a5a', width: 2.6, cap: 'jack',    name: '4.4mm Pentaconn' },
  JACK_6_35:      { color: '#5a5a5a', width: 3,   cap: 'jack',    name: '6.35mm Jack' },
  XLR4:           { color: '#2b2b2b', width: 3,   cap: 'xlr',     name: '4-Pin XLR' },
  GROUND:         { color: '#6b8e23', width: 1.5, cap: 'ground',  name: 'Земляной провод', dash: '4,3' },
  ADAPTER_44_XLR: { color: '#7b2cbf', width: 3,   cap: 'adapter', name: 'Переходник 4.4mm→XLR', dash: '6,3' },
};

export function getCableStyle(connectorType) {
  return CABLE_STYLE[connectorType] || { color: '#888', width: 2, cap: 'default', name: connectorType };
}
