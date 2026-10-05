// Product facts and design proposals deliberately have separate provenance.
export const REL_QUAKE = {
  manufacturer: 'REL', model: 'Quake', quantity: 2,
  finish: { color: 'Серый', source: 'Уточнение владельца · 04.10.2026', sheen: 'Матовый сатин — визуальное приближение' },
  dimensions: { width: 253, height: 294, depth: 272 }, massKg: 7.4,
  driver: '200 мм · направлен вниз', enclosure: 'Закрытый корпус',
  highLevelConnector: 'Neutrik Speakon',
  source: 'https://relsupport.zendesk.com/hc/en-us/article_attachments/115015632747',
  sourcePages: '8, 23',
  connection: {
    status: 'unconfirmed', ownerDescription: 'XLR Hi',
    note: 'Владелец указал «XLR Hi». У штатного REL Quake вход HIGH LEVEL — Neutrik Speakon. Кабель и выход усилителя ещё нужно подтвердить.',
  },
};

export const SIDE_POWER_STRIPS = ['left', 'right'].map((side, i) => ({
  id: `sub_power_${side}`, side, name: i === 0 ? 'Левый сабвуфер' : 'Правый сабвуфер',
  sockets: 3, manufacturer: null, model: null, status: 'proposed',
  outlets: [`REL Quake ${i === 0 ? 'L' : 'R'}`, 'Govee · модель выбирается', 'Резерв'],
  note: 'Отдельный фильтр у стены · модель и электрические параметры не выбраны',
}));

export const LISTENING_ROOM = {
  model: '/models/listening-room.glb?v=polished-1', poster: '/images/listening-room.jpg?v=polished-1',
  rug: { name: 'LAXMI Quincey', widthMm: 3000, depthMm: 2000, color: 'Белый', source: 'Размер и фотографии владельца', geometry: 'Рельеф и бахрома воссозданы по фото' },
  room: { widthMm: 5400, depthMm: 6000, heightMm: 2800, status: 'concept' },
  notes: 'Комната, окно, диван, подвесная люстра, лампы и корпуса дополнительных фильтров — проектный вариант. Конкретная модель Govee ещё не выбрана. Габарит ковра — 200 × 300 см. Детализация моделей по фото не заменяет обмеры; глубина Rusich пока условная.',
  speakerSource: 'https://www.acoustic-energy.co.uk/wp-content/uploads/Acoustic-Energy-AE320-Info-Sheet.pdf',
};
