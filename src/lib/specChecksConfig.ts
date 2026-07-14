/**
 * Spec-check registry: the single source of truth for check ids, severities,
 * titles, message templates, and word lists. The engine (specChecks.ts) holds
 * only detection logic; everything user-facing or tunable lives here.
 *
 * Message templates use {placeholder} syntax, filled by formatCheckMessage.
 * Pure module - keep it free of Tauri imports so the lint core stays
 * extractable (see docs/design/checks-and-claims.md).
 */

export type CheckSeverity = "error" | "warning" | "info";

export interface CheckDefinition {
	severity: CheckSeverity;
	/** Short human name for the check, e.g. shown in future settings UI. */
	title: string;
	/** Message templates by variant; most checks only have `default`. */
	messages: Record<string, string>;
}

export const CHECKS = {
	SL001: {
		severity: "error",
		title: "Missing proposal",
		messages: { default: "Change has no proposal.md." },
	},
	SL002: {
		severity: "error",
		title: "Missing tasks",
		messages: { default: "Change has no tasks.md." },
	},
	SL003: {
		severity: "error",
		title: "Unknown capability",
		messages: {
			default:
				'Spec delta targets capability "{capability}", which does not exist in specs/ and is not introduced by an ADDED section.',
		},
	},
	SL004: {
		severity: "error",
		title: "Malformed EARS/Gherkin block",
		messages: {
			orphanScenario:
				'Scenario "{scenario}" has no owning requirement heading.',
			whenWithoutThen: 'Scenario "{scenario}" has a WHEN clause but no THEN.',
			givenWithoutThen: 'Scenario "{scenario}" has a GIVEN clause but no THEN.',
		},
	},
	SL005: {
		severity: "error",
		title: "Empty requirement",
		messages: { default: 'Requirement "{requirement}" has an empty body.' },
	},
	SL010: {
		severity: "warning",
		title: "Near-duplicate requirement",
		messages: {
			default:
				'Requirement "{requirement}" duplicates a requirement in {others}.',
		},
	},
	SL011: {
		severity: "warning",
		title: "Reference to archived change",
		messages: { default: 'References archived change "{slug}".' },
	},
	SL012: {
		severity: "warning",
		title: "Tasks disconnected from specs",
		messages: {
			default:
				"Task list never mentions any capability this change touches ({capabilities}).",
		},
	},
	SL013: {
		severity: "warning",
		title: "Task completion vs archive state",
		messages: {
			readyToArchive: "All tasks are complete but the change is not archived.",
			archivedIncomplete:
				"Change is archived with incomplete tasks ({done}/{total}).",
		},
	},
	SL020: {
		severity: "warning",
		title: "RFC 2119 misuse",
		messages: {
			default:
				'Lowercase "{word}" in normative text - use uppercase RFC 2119 form.',
		},
	},
	SL021: {
		severity: "warning",
		title: "Conflicting modality",
		messages: { default: "Conflicting modality in one clause: {modals}." },
	},
	SL022: {
		severity: "warning",
		title: "Ambiguous term",
		messages: {
			default: 'Ambiguous term "{term}" - replace with a measurable bound.',
		},
	},
	SL023: {
		severity: "info",
		title: "Unbounded quantity",
		messages: {
			default: 'Unbounded quantity "{term}" in a normative sentence.',
		},
	},
} as const satisfies Record<string, CheckDefinition>;

export type CheckId = keyof typeof CHECKS;

/**
 * SL022 base word list. Deterministic core - a future opt-in local-AI action
 * may propose additions, but suggestions must land here (or in a user
 * setting) explicitly, never silently at scan time.
 */
export const AMBIGUITY_TERMS = [
	"fast",
	"quickly",
	"appropriate",
	"reasonable",
	"etc.",
	"as needed",
] as const;

/** SL023 word list: quantities with no bound. */
export const UNBOUNDED_QUANTIFIERS = ["some", "several", "many"] as const;

/** Fills {placeholder} slots in a check message template. */
export function formatCheckMessage(
	id: CheckId,
	variant: string,
	params: Record<string, string> = {},
): string {
	const def: CheckDefinition = CHECKS[id];
	const template = def.messages[variant] ?? variant;
	return template.replace(/\{(\w+)\}/g, (_, key: string) =>
		key in params ? params[key] : `{${key}}`,
	);
}
