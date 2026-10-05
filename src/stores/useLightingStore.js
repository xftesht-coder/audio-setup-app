import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// This is a local shopping/design shortlist, never an assertion of owned equipment.
export const useLightingStore = create(persist((set) => ({
  planned: [],
  add: (product) => set(state => state.planned.some(item => item.id === product.id) ? state : {
    planned: [...state.planned, { id: product.id, name: product.name, quantity: 1 }],
  }),
  remove: (id) => set(state => ({ planned: state.planned.filter(item => item.id !== id) })),
  setQuantity: (id, quantity) => set(state => ({
    planned: state.planned.map(item => item.id === id ? { ...item, quantity: Math.max(1, Math.min(20, Math.round(Number(quantity) || 1))) } : item),
  })),
}), { name: 'audio-setup-lighting-plan-v1', partialize: state => ({ planned: state.planned }) }));
