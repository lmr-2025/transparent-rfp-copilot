import { create } from "zustand";

export type SelectionItem = {
  id: string;
  title: string;
  categories: string[];
  selected: boolean;
};

interface SelectionState {
  // Selections
  skillSelections: Map<string, boolean>;
  documentSelections: Map<string, boolean>;
  urlSelections: Map<string, boolean>;
  customerSelections: Map<string, boolean>;

  // Actions
  toggleSkill: (id: string) => void;
  toggleDocument: (id: string) => void;
  toggleUrl: (id: string) => void;
  toggleCustomer: (id: string) => void;

  setSkillSelected: (id: string, selected: boolean) => void;
  setDocumentSelected: (id: string, selected: boolean) => void;
  setUrlSelected: (id: string, selected: boolean) => void;
  setCustomerSelected: (id: string, selected: boolean) => void;

  // Bulk operations
  initializeSelections: (
    skillIds: string[],
    documentIds: string[],
    urlIds: string[],
    customerIds: string[]
  ) => void;
  selectAllSkills: (ids: string[]) => void;
  selectNoSkills: () => void;
  selectAllDocuments: (ids: string[]) => void;
  selectNoDocuments: () => void;
  selectAllUrls: (ids: string[]) => void;
  selectNoUrls: () => void;
  selectAllCustomers: (ids: string[]) => void;
  selectNoCustomers: () => void;

  // Getters
  getSelectedSkillIds: () => string[];
  getSelectedDocumentIds: () => string[];
  getSelectedUrlIds: () => string[];
  getSelectedCustomerIds: () => string[];
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  skillSelections: new Map(),
  documentSelections: new Map(),
  urlSelections: new Map(),
  customerSelections: new Map(),

  toggleSkill: (id) =>
    set((state) => {
      const newMap = new Map(state.skillSelections);
      newMap.set(id, !newMap.get(id));
      return { skillSelections: newMap };
    }),

  toggleDocument: (id) =>
    set((state) => {
      const newMap = new Map(state.documentSelections);
      newMap.set(id, !newMap.get(id));
      return { documentSelections: newMap };
    }),

  toggleUrl: (id) =>
    set((state) => {
      const newMap = new Map(state.urlSelections);
      newMap.set(id, !newMap.get(id));
      return { urlSelections: newMap };
    }),

  toggleCustomer: (id) =>
    set((state) => {
      const newMap = new Map(state.customerSelections);
      newMap.set(id, !newMap.get(id));
      return { customerSelections: newMap };
    }),

  setSkillSelected: (id, selected) =>
    set((state) => {
      const newMap = new Map(state.skillSelections);
      newMap.set(id, selected);
      return { skillSelections: newMap };
    }),

  setDocumentSelected: (id, selected) =>
    set((state) => {
      const newMap = new Map(state.documentSelections);
      newMap.set(id, selected);
      return { documentSelections: newMap };
    }),

  setUrlSelected: (id, selected) =>
    set((state) => {
      const newMap = new Map(state.urlSelections);
      newMap.set(id, selected);
      return { urlSelections: newMap };
    }),

  setCustomerSelected: (id, selected) =>
    set((state) => {
      const newMap = new Map(state.customerSelections);
      newMap.set(id, selected);
      return { customerSelections: newMap };
    }),

  initializeSelections: (skillIds, documentIds, urlIds, customerIds) =>
    set(() => ({
      // Skills default to selected
      skillSelections: new Map(skillIds.map((id) => [id, true])),
      // Others default to not selected
      documentSelections: new Map(documentIds.map((id) => [id, false])),
      urlSelections: new Map(urlIds.map((id) => [id, false])),
      customerSelections: new Map(customerIds.map((id) => [id, false])),
    })),

  selectAllSkills: (ids) =>
    set(() => ({
      skillSelections: new Map(ids.map((id) => [id, true])),
    })),

  selectNoSkills: () =>
    set((state) => ({
      skillSelections: new Map(
        Array.from(state.skillSelections.keys()).map((id) => [id, false])
      ),
    })),

  selectAllDocuments: (ids) =>
    set(() => ({
      documentSelections: new Map(ids.map((id) => [id, true])),
    })),

  selectNoDocuments: () =>
    set((state) => ({
      documentSelections: new Map(
        Array.from(state.documentSelections.keys()).map((id) => [id, false])
      ),
    })),

  selectAllUrls: (ids) =>
    set(() => ({
      urlSelections: new Map(ids.map((id) => [id, true])),
    })),

  selectNoUrls: () =>
    set((state) => ({
      urlSelections: new Map(
        Array.from(state.urlSelections.keys()).map((id) => [id, false])
      ),
    })),

  selectAllCustomers: (ids) =>
    set(() => ({
      customerSelections: new Map(ids.map((id) => [id, true])),
    })),

  selectNoCustomers: () =>
    set((state) => ({
      customerSelections: new Map(
        Array.from(state.customerSelections.keys()).map((id) => [id, false])
      ),
    })),

  getSelectedSkillIds: () => {
    const { skillSelections } = get();
    return Array.from(skillSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  },

  getSelectedDocumentIds: () => {
    const { documentSelections } = get();
    return Array.from(documentSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  },

  getSelectedUrlIds: () => {
    const { urlSelections } = get();
    return Array.from(urlSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  },

  getSelectedCustomerIds: () => {
    const { customerSelections } = get();
    return Array.from(customerSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  },
}));
