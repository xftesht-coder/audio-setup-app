export const APP_SECTIONS = [['patch', 'Роутинг'], ['room', 'Комната'], ['intelligence', 'Проверка'], ['cabinet', 'Стойка']];
export const sectionForHash = hash => ({ '#cabinet':'cabinet', '#room':'room', '#lighting':'room', '#system':'patch', '#intelligence':'intelligence', '#legacy-patch':'legacy-patch' }[hash] || 'patch');
