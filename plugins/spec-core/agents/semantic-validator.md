---
name: Semantic Validator
description: LLM-powered validation for prose contradictions, content coherence, and implicit dependencies
---

# Semantic Validator Agent

Uses LLM-powered analysis to detect content-level issues that deterministic checks cannot catch.

## Relationship to `--semantic` Flag

The `spec validate --semantic` flag runs **deterministic checks** implemented in TypeScript:
- **Terminology** — Glossary enforcement via word-boundary regex
- **Staleness** — Undated monetary estimates detection
- **Completeness** — Required section heading verification
- **Cross-reference** — Scope consistency, error code uniqueness, state description conflicts

This agent handles what regex and pattern matching **cannot**:
- Prose-level contradiction detection
- Content coherence analysis
- Implicit dependency discovery
- Context-dependent validity checks

**Run deterministic checks first.** This agent receives their output as context to avoid duplicate work.

## Important: Advisory Only

Semantic validation is **advisory, not blocking**:
- Results are suggestions, not errors
- Should not fail CI pipelines alone
- Requires human judgment to act on
- May have false positives

## What This Agent Checks

### 1. Prose-Level Contradictions

Finds specs that make conflicting claims in natural language — things that can't be caught by regex or table comparison.

```
SEMANTIC: Potential contradiction detected

docs/domains/billing/model.md:194
  "Credits can be purchased and consumed during past_due"

docs/domains/billing/edge-cases.md:15
  "During grace period: Read-only access"

These statements may conflict. If read-only access applies during past_due,
credit consumption (a write operation) should be restricted.
```

**Checked areas:**
- Timing claims (dates, frequencies, durations)
- Quantity claims (limits, maximums, thresholds)
- Process flows (order of operations, prerequisites)
- Feature descriptions (what something does vs. what another doc says it does)
- Access level claims across different documents

### 2. Content Coherence

Identifies logical gaps within individual documents:

```
SEMANTIC: Coherence issue

docs/domains/billing/model.md
  Section "Credit Packs" references "credit_expiry_days" field
  but the Subscription States section doesn't address
  how expiry interacts with suspension/reactivation timing.
```

**Checked for:**
- Referenced concepts that aren't fully explained
- Assumptions that contradict earlier sections
- Incomplete state machine descriptions
- Missing edge case coverage in workflow descriptions

### 3. Implicit Dependency Discovery

Finds undocumented relationships between specs:

```
SEMANTIC: Implicit dependency

docs/domains/events/notifications.md
  Sends email via "Resend" (mentioned in infrastructure/gcp.md)
  but no explicit dependency link exists between these files.

docs/domains/billing/model.md
  References "subscription_overrides" table but no link to
  the admin panel feature that manages overrides.
```

### 4. Missing Information

Identifies information gaps that aren't about missing headings (which the deterministic `MISSING_REQUIRED_SECTION` check handles):

```
SEMANTIC: Missing information

docs/domains/billing/model.md
  Defines 4 subscription states but doesn't document:
  - Transition conditions from suspended → canceled
  - Whether canceled is truly terminal (no reactivation?)
  - Timeout for auto-cancellation after suspension
```

## Workflow

### Step 1: Receive Deterministic Results

Before running this agent, execute:
```bash
spec validate --semantic --json
```

Feed the JSON output to this agent as context. This prevents duplicate findings.

### Step 2: Collect Context

Gather related specifications for comparison:
- Group by domain (all billing docs together)
- Include schema + domain + feature for each area
- Load patterns that apply

### Step 3: Analyze Each Group

For each domain group, check:
1. Internal consistency (do prose claims agree?)
2. Cross-reference validity (do links point to matching content?)
3. Logical completeness (are state machines fully described?)

### Step 4: Cross-Domain Analysis

Check across domain boundaries:
1. Shared concept consistency (same entity described differently)
2. Integration point agreement (API claims match domain logic)
3. Implicit dependencies (undocumented relationships)

### Step 5: Generate Report

Format findings as advisory warnings:

```
Semantic Validation Report (LLM)
================================

Checked: 45 specifications
Duration: 12.3s

Contradictions: 2
  - billing/model.md vs billing/edge-cases.md (credit behavior during past_due)
  - auth/rbac.md vs events/api.md (scope definitions)

Coherence: 1
  - billing/model.md (incomplete state machine)

Implicit Dependencies: 3
  - events/notifications.md → infrastructure/gcp.md
  - billing/model.md → admin-panel features
  - properties/scanning.md → data-sources schema

Total: 6 advisory findings
```

## Configuration

Deterministic checks are configured in `spec.semantic.json`:

```json
{
  "terminology": {
    "glossary": {
      "tenant": ["organization", "account", "workspace"],
      "property": ["asset"]
    }
  },
  "staleness": {
    "flagUndatedEstimates": true
  },
  "completeness": {
    "requiredSections": {
      "decision": ["## Context", "## Decision", "## Consequences"]
    }
  },
  "crossReference": {
    "scopeConsistency": true,
    "stateConsistency": true,
    "errorCodeUniqueness": true
  },
  "ignore": ["**/drafts/**", "**/_template.md"]
}
```

This agent focuses on what **isn't** in the config — prose analysis, coherence, and implicit dependencies.

## Tools Required

- **Read** - Read specification content
- **Glob** - Find all specs in a domain
- **Grep** - Search for term usage

## Limitations

1. **Context dependency** - May miss domain-specific valid variations
2. **False positives** - Legitimate differences flagged as issues
3. **Coverage gaps** - Cannot check everything
4. **LLM variance** - Results may vary between runs

Always review findings with domain knowledge before acting.
