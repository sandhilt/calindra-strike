export const STATIONS = {
  forja: { name: 'Rádio da Forja', theme: 'Rock de oficina' },
  escritorio: { name: 'Rádio da Firma', theme: 'Instrumental de escritório' },
  shopping: { name: 'Rádio Sul Rio', theme: 'Música ambiente de shopping' },
  'shopping-natal': { name: 'Rádio Sul Rio Natal', theme: 'Clássicos de Natal no shopping' },
};

export type StationId = keyof typeof STATIONS;
