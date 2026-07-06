# Adversarial scenarios — `render-migration-references.md`

Ordinary-prompting candidates for `ratify review --adversarial`, per ADR-0030's adversarial-example
check (LLM-generated with hand-written fallback; this file is the hand-written-fallback shape the
shipped tool reads). Numbered markdown list items only — the tool's own convention. Kept
single-line per item: `ratify review`'s adversarial-file parser (`src/review/cli.ts`,
`parseAdversarialScenarios`) was found during this session to silently drop a numbered item's
wrapped continuation lines, keeping only the first line — a disclosed defect in the shipped tool,
not a constraint of this document; see the item-5 hand-off's open questions.

1. Both migration markers configured to the exact same string must still wrap a matching link exactly once, never doubled or corrupted by the duplicate candidate.
2. The two-codepoint emoji preset marker (arrow plus variation selector) must still be detected as a standalone token and wrapped, the same as a single-codepoint marker.
3. Two internal links in one task line, only the first preceded by a valid marker, must be handled independently — the first wrapped, the second untouched, no state leaking between them.
4. A link whose immediately preceding text node is whitespace-only, with the real marker in an even earlier sibling, must be left unwrapped — the marker is not in the node immediately before the link.
