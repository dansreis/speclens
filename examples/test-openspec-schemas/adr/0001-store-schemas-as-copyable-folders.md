# 0001. Store schemas as copyable folders

- Status: accepted
- Date: 2026-02-10

## Context

OpenSpec schemas need a distribution mechanism. Three shapes were considered:

1. A package on the npm/pypi-equivalent registry, installed at runtime.
2. A git submodule pointing at a schema source-of-truth.
3. A copyable folder dropped into the consumer's repository.

The audience for these schemas is AI coding agents and human authors who already have `openspec` initialised. Both groups would be hostile to extra installation friction. Schemas are also small — a `schema.yaml` plus a handful of `templates/*.md` — so the lifecycle benefits of a registry don't justify the runtime indirection.

## Decision

Each schema is published as a self-contained folder under `openspec/schemas/<name>/` containing `schema.yaml`, a `README.md`, and the `templates/` directory. Consumers install a schema by copying that folder into their own repository under the same path (or `$HOME/.openspec/schemas/<name>/` for user-scoped installs).

## Consequences

- **Positive**: no runtime fetching, no version mismatch between schema and agent. The schema is committed to the consumer's repo, fully auditable.
- **Positive**: forking is trivial — copy the folder, edit `schema.yaml`, rename. This intentionally lowers the barrier to authoring custom variants.
- **Negative**: upgrades are manual. If the upstream schema gains a new artifact, downstream copies don't get it until a human re-copies. We accept this tradeoff; schema changes are infrequent and reviewable.
- **Neutral**: the `openspec/schemas/` directory becomes a first-class part of every OpenSpec project's layout.
