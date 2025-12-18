import { create } from "zustand";
import type { GTMDataSelection } from "@/types/gtmData";

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
  customerDocumentSelections: Map<string, boolean>; // For customer-specific documents

  // GTM Data selections (per customer)
  gtmDataSelections: Map<string, GTMDataSelection>; // key: salesforceAccountId

  // Actions
  toggleSkill: (id: string) => void;
  toggleDocument: (id: string) => void;
  toggleUrl: (id: string) => void;
  toggleCustomer: (id: string) => void;
  toggleCustomerDocument: (id: string) => void;

  setSkillSelected: (id: string, selected: boolean) => void;
  setDocumentSelected: (id: string, selected: boolean) => void;
  setUrlSelected: (id: string, selected: boolean) => void;
  setCustomerSelected: (id: string, selected: boolean) => void;
  setCustomerDocumentSelected: (id: string, selected: boolean) => void;

  // GTM Data actions
  setGtmDataSelection: (salesforceAccountId: string, selection: GTMDataSelection) => void;
  toggleGongCall: (salesforceAccountId: string, callId: string) => void;
  toggleHubSpotActivity: (salesforceAccountId: string, activityId: string) => void;
  setIncludeMetrics: (salesforceAccountId: string, include: boolean) => void;
  clearGtmDataSelection: (salesforceAccountId: string) => void;

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
  selectAllCustomerDocuments: (ids: string[]) => void;
  selectNoCustomerDocuments: () => void;

  // Getters
  getSelectedSkillIds: () => string[];
  getSelectedDocumentIds: () => string[];
  getSelectedUrlIds: () => string[];
  getSelectedCustomerIds: () => string[];
  getSelectedCustomerDocumentIds: () => string[];
  getGtmDataSelection: (salesforceAccountId: string) => GTMDataSelection | undefined;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  skillSelections: new Map(),
  documentSelections: new Map(),
  urlSelections: new Map(),
  customerSelections: new Map(),
  customerDocumentSelections: new Map(),
  gtmDataSelections: new Map(),

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

  toggleCustomerDocument: (id) =>
    set((state) => {
      const newMap = new Map(state.customerDocumentSelections);
      newMap.set(id, !newMap.get(id));
      return { customerDocumentSelections: newMap };
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

  setCustomerDocumentSelected: (id, selected) =>
    set((state) => {
      const newMap = new Map(state.customerDocumentSelections);
      newMap.set(id, selected);
      return { customerDocumentSelections: newMap };
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

  selectAllCustomerDocuments: (ids) =>
    set(() => ({
      customerDocumentSelections: new Map(ids.map((id) => [id, true])),
    })),

  selectNoCustomerDocuments: () =>
    set((state) => ({
      customerDocumentSelections: new Map(
        Array.from(state.customerDocumentSelections.keys()).map((id) => [id, false])
      ),
    })),

  // GTM Data actions
  setGtmDataSelection: (salesforceAccountId, selection) =>
    set((state) => {
      const newMap = new Map(state.gtmDataSelections);
      newMap.set(salesforceAccountId, selection);
      return { gtmDataSelections: newMap };
    }),

  toggleGongCall: (salesforceAccountId, callId) =>
    set((state) => {
      const newMap = new Map(state.gtmDataSelections);
      const current = newMap.get(salesforceAccountId) || {
        gongCallIds: [],
        hubspotActivityIds: [],
        includeMetrics: true,
      };
      const callIds = current.gongCallIds.includes(callId)
        ? current.gongCallIds.filter((id) => id !== callId)
        : [...current.gongCallIds, callId];
      newMap.set(salesforceAccountId, { ...current, gongCallIds: callIds });
      return { gtmDataSelections: newMap };
    }),

  toggleHubSpotActivity: (salesforceAccountId, activityId) =>
    set((state) => {
      const newMap = new Map(state.gtmDataSelections);
      const current = newMap.get(salesforceAccountId) || {
        gongCallIds: [],
        hubspotActivityIds: [],
        includeMetrics: true,
      };
      const activityIds = current.hubspotActivityIds.includes(activityId)
        ? current.hubspotActivityIds.filter((id) => id !== activityId)
        : [...current.hubspotActivityIds, activityId];
      newMap.set(salesforceAccountId, { ...current, hubspotActivityIds: activityIds });
      return { gtmDataSelections: newMap };
    }),

  setIncludeMetrics: (salesforceAccountId, include) =>
    set((state) => {
      const newMap = new Map(state.gtmDataSelections);
      const current = newMap.get(salesforceAccountId) || {
        gongCallIds: [],
        hubspotActivityIds: [],
        includeMetrics: true,
      };
      newMap.set(salesforceAccountId, { ...current, includeMetrics: include });
      return { gtmDataSelections: newMap };
    }),

  clearGtmDataSelection: (salesforceAccountId) =>
    set((state) => {
      const newMap = new Map(state.gtmDataSelections);
      newMap.delete(salesforceAccountId);
      return { gtmDataSelections: newMap };
    }),

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

  getSelectedCustomerDocumentIds: () => {
    const { customerDocumentSelections } = get();
    return Array.from(customerDocumentSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  },

  getGtmDataSelection: (salesforceAccountId) => {
    const { gtmDataSelections } = get();
    return gtmDataSelections.get(salesforceAccountId);
  },
}));
