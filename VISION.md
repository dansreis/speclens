I think you're converging on something more interesting than traceability.

The real asset isn't code ↔ requirements.

It's **intent ↔ evolution**.

---

## The Core Problem

OpenSpec gives you snapshots:

```text
Spec A
Spec B
Change C
Archived Change D
```

But it doesn't really answer:

* Why did this requirement appear?
* What decision introduced it?
* What alternatives were considered?
* How did it evolve?
* What changed between versions?
* What assumptions drove the change?
* What decisions are now obsolete?

Over time, teams lose the reasoning, not the requirements.

---

## A Different Product Vision

Instead of:

> Product Intelligence for OpenSpec

Think:

> **Intent Intelligence for OpenSpec**

The system becomes a memory layer for product decisions.

```text
Decision
    ↓
Change
    ↓
Requirements
    ↓
Future Decisions
```

---

## The Graph I'd Build

Not around code.

Around intent.

Nodes:

```text
Decision
Change
Requirement
Scenario
Capability
Assumption
Risk
```

Relationships:

```text
Decision
    → creates
Change

Change
    → modifies
Requirement

Requirement
    → belongs_to
Capability

Decision
    → supersedes
Decision
```

Example:

```text
Decision:
"We should support MFA"

    ↓

Change:
add-mfa

    ↓

Requirements:
MFA Enrollment
MFA Login
Recovery Codes
```

Months later:

```text
Decision:
"SMS MFA is insecure"

    ↓

Change:
remove-sms-mfa
```

Now you have a decision lineage.

---

# Feature 1: Intent Timeline

This could be the killer feature.

Instead of viewing:

```text
Authentication Spec
```

you see:

```text
2024
 ├─ Added Login
 ├─ Added Password Reset

2025
 ├─ Added MFA
 ├─ Added Recovery Codes

2026
 ├─ Removed SMS MFA
 └─ Added Passkeys
```

Every requirement becomes historical.

People love timelines because they naturally explain causality.

---

# Feature 2: Decision Extraction

Most OpenSpec repositories contain hidden decisions.

Example proposal:

```md
We should implement MFA because enterprise customers require stronger security.
```

Extract:

```text
Decision:
Implement MFA

Reason:
Enterprise security requirements
```

Now you have a first-class decision object.

This is where LLMs become useful.

Not for traceability.

For extracting intent.

---

# Feature 3: Requirement Evolution

Imagine clicking:

```text
Requirement:
User Authentication
```

and seeing:

```text
v1
Password login

v2
Added password reset

v3
Added MFA

v4
Added Passkeys
```

Like Git blame, but for requirements.

This is incredibly useful.

Most teams cannot answer:

> When did we decide this?

---

# Feature 4: Decision Diff

Current OpenSpec focuses on document diffs.

You could focus on intent diffs.

Example:

```text
Previous

Users authenticate with password

Current

Users authenticate with password and MFA
```

System generates:

```text
Intent Change

Security requirements increased

Impact:
Authentication
User onboarding
Recovery flows
```

This is far more valuable than a raw markdown diff.

---

# Feature 5: Assumption Tracking

Every proposal contains assumptions.

Example:

```md
Enterprise customers require MFA.
```

Extract:

```text
Assumption:
Enterprise customers require MFA
```

Months later:

```text
Decision:
Add Passkeys
```

System notices:

```text
This assumption is referenced by 4 changes.
```

Now you can manage reasoning, not just requirements.

---

# Feature 6: Capability Map

This is still important.

```text
Authentication
 ├── Login
 ├── MFA
 ├── Passkeys

Billing
 ├── Invoices
 ├── Subscriptions
```

But every capability also shows:

```text
Requirements

Decisions

Change History
```

This is where the graph becomes powerful.

---

# Feature 7: Repository Memory

This is probably the easiest pitch.

Ask:

> Why do we have MFA?

Response:

```text
Introduced:
March 2025

Reason:
Enterprise security requirements

Change:
add-mfa

Related decisions:
add-passkeys
remove-sms-mfa
```

That's a much stronger story than:

> Here is the spec file.

---

## The Product I'd Pitch

Not:

> OpenSpec visualization.

Not:

> Traceability.

Not:

> Knowledge graph.

I'd pitch:

> **The memory system for specification-driven teams.**

Or:

> **Understand why your product evolved the way it did.**

The MVP would focus on three things:

### 1. Capability Graph

What exists?

```text
Authentication
Billing
Notifications
```

---

### 2. Decision Timeline

Why does it exist?

```text
Decision
→ Change
→ Requirement
```

---

### 3. Intent Diff

What changed?

```text
Requirement evolution

Decision evolution

Capability evolution
```

Those three features can be built using only OpenSpec repositories, without GitHub, Jira, or complex integrations. And they attack a problem teams genuinely feel: **requirements are easy to store, but intent and decision history disappear surprisingly fast.**
