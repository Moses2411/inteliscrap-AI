// Physical disambiguation tests.
//
// Image-only classification cannot reliably separate some scrap materials:
// copper vs brass (both red/yellow metals), aluminum vs steel (both silver-grey),
// and PET vs glass (both clear and hard). Real recyclers tell these apart with a
// magnet and a scratch test, so we ask the user a short guided question when the
// classifier's candidates fall inside one of these known-confusable families.
//
// This module is pure data + pure functions so it is trivially testable and does
// not depend on the DOM.

export interface DisambiguationOption {
  /** Stable answer id (stored in the answer map). */
  id: string;
  /** i18n key for the button label. */
  labelKey: string;
  /** Terminal answers resolve directly to a material slug. */
  resolvesTo?: string;
  /** Non-terminal answers lead to a follow-up question. */
  next?: TreeNode;
}

export interface TreeNode {
  /** Stable question id (used as the key in the answer map). */
  id: string;
  /** i18n key for the question text. */
  titleKey: string;
  /** Optional i18n key for helper / how-to text. */
  hintKey?: string;
  options: DisambiguationOption[];
}

export interface DisambiguationFamily {
  id: string;
  /** Candidate slugs that belong to this confusion family. */
  slugs: string[];
  tree: TreeNode;
}

export const DISAMBIGUATION_FAMILIES: DisambiguationFamily[] = [
  {
    id: "ferrous-metals",
    slugs: ["copper", "brass", "aluminum", "steel"],
    tree: {
      id: "magnet",
      titleKey: "test_magnet_q",
      hintKey: "test_magnet_hint",
      options: [
        { id: "sticks", labelKey: "test_magnet_yes", resolvesTo: "steel" },
        {
          id: "no",
          labelKey: "test_magnet_no",
          next: {
            id: "scratch",
            titleKey: "test_scratch_q",
            options: [
              { id: "reddish", labelKey: "test_scratch_red", resolvesTo: "copper" },
              { id: "golden", labelKey: "test_scratch_gold", resolvesTo: "brass" },
              { id: "silver", labelKey: "test_scratch_silver", resolvesTo: "aluminum" },
            ],
          },
        },
      ],
    },
  },
  {
    id: "clear-materials",
    slugs: ["pet-plastic", "glass"],
    tree: {
      id: "flex",
      titleKey: "test_flex_q",
      options: [
        { id: "bends", labelKey: "test_flex_bends", resolvesTo: "pet-plastic" },
        { id: "hard", labelKey: "test_flex_hard", resolvesTo: "glass" },
      ],
    },
  },
];

export type DisambiguationAnswers = Record<string, string>;

export interface DisambiguationResolution {
  /** The next question to ask, when the answers so far do not resolve a material. */
  question?: TreeNode;
  /** The resolved material slug, when the answers are conclusive. */
  resolvedSlug?: string;
}

/**
 * Find the confusion family that covers the given candidate slugs. Requires at
 * least two distinct candidates so a single confident answer is never quizzed.
 */
export function detectFamily(slugs: string[]): DisambiguationFamily | null {
  const unique = [...new Set(slugs.filter((slug) => Boolean(slug) && slug !== "other"))];
  if (unique.length < 2) return null;
  for (const family of DISAMBIGUATION_FAMILIES) {
    if (unique.every((slug) => family.slugs.includes(slug))) return family;
  }
  return null;
}

/**
 * Walk the family's decision tree with the given answers. Returns the next
 * question while a decision is still open, or the resolved slug when conclusive.
 */
export function resolveDisambiguation(
  family: DisambiguationFamily,
  answers: DisambiguationAnswers,
): DisambiguationResolution {
  let node: TreeNode | undefined = family.tree;
  while (node) {
    const answer: string | undefined = answers[node.id];
    if (!answer) return { question: node };
    const option: DisambiguationOption | undefined = node.options.find(
      (candidate) => candidate.id === answer,
    );
    if (!option) return { question: node };
    if (option.resolvesTo) return { resolvedSlug: option.resolvesTo };
    node = option.next;
  }
  return {};
}
