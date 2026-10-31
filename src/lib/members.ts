export interface PredefinedMember {
  id: string;
  name: string;
  display_order: number;
}

/**
 * Predefined 12 family members with exact spellings as specified.
 * Deterministic IDs prevent duplicate member records across initializations.
 */
export const PREDEFINED_FAMILY_MEMBERS: readonly PredefinedMember[] = [
  { id: "harun-or-rashid", name: "Harun Or Rashid", display_order: 1 },
  { id: "moazzem-hossain", name: "Moazzem Hossain", display_order: 2 },
  { id: "rashed-dewan", name: "Rashed Dewan", display_order: 3 },
  { id: "saiful-islam", name: "Saiful Islam", display_order: 4 },
  { id: "fauzia-sultana", name: "Fauzia Sultana", display_order: 5 },
  { id: "tahmina-chowdhury", name: "Tahmina Chowdhury", display_order: 6 },
  { id: "tanzina-sarkar", name: "Tanzina Sarkar", display_order: 7 },
  { id: "nazma-akter", name: "Nazma Akter", display_order: 8 },
  { id: "rakin-al-shahriar", name: "Rakin al Shahriar", display_order: 9 },
  { id: "tasnimul-hasan", name: "Tasnimul Hasan", display_order: 10 },
  { id: "israt-jahan", name: "Israt Jahan", display_order: 11 },
  { id: "sanjida-islam", name: "Sanjida Islam", display_order: 12 },
] as const;

export const MEMBER_BY_ID: ReadonlyMap<string, PredefinedMember> = new Map(
  PREDEFINED_FAMILY_MEMBERS.map((m) => [m.id, m])
);

export function isValidMemberId(id: unknown): id is string {
  return typeof id === "string" && MEMBER_BY_ID.has(id);
}

export function getPredefinedMember(id: string): PredefinedMember | undefined {
  return MEMBER_BY_ID.get(id);
}
