# Semantic Validator Agent

Uses LLM-powered analysis to detect content-level issues in specifications that structural validation cannot catch.

## Purpose

While structural validation checks links, frontmatter, and layer rules, semantic validation catches:
1. **Contradictions** - Specs that conflict with each other
2. **Incompleteness** - Missing required information
3. **Terminology drift** - Inconsistent naming/concepts
4. **Staleness** - Content that doesn't match reality

## Important: Advisory Only

Semantic validation is **advisory, not blocking**:
- Results are suggestions, not errors
- Should not fail CI pipelines alone
- Requires human judgment to act on
- May have false positives

## Validation Categories

### 1. Contradiction Detection

Finds specs that make conflicting claims:

```
⚠️ SEMANTIC: Potential contradiction detected

docs/domains/billing/subscriptions.md:15
  "Subscriptions are billed monthly on the 1st"

docs/domains/billing/invoices.md:32
  "Invoices are generated on the subscription anniversary date"

These statements may conflict. Review billing timing.
```

**Checked areas:**
- Timing claims (dates, frequencies)
- Quantity claims (limits, maximums)
- Process flows (order of operations)
- Feature descriptions (what something does)

### 2. Completeness Checking

Identifies missing required information:

```
⚠️ SEMANTIC: Incomplete specification

docs/schemas/billing.md
  Missing: Error handling section
  Template requires: ## Error Cases

docs/domains/billing/subscriptions.md
  Missing: Related schemas section
  Template requires: ## Related Schemas
```

**Checked elements:**
- Required template sections
- Referenced but undefined terms
- Mentioned but undocumented features
- Incomplete examples

### 3. Terminology Consistency

Detects when the same concept uses different names:

```
⚠️ SEMANTIC: Terminology inconsistency

The concept appears with different names:
  - "tenant" (docs/schemas/tenants.md, docs/architecture/patterns/tenant-context.md)
  - "organization" (docs/products/web/features/org-settings.md)
  - "account" (docs/domains/auth/login.md)

Consider standardizing on a single term.
```

**Checked for:**
- Entity names (tenant vs organization vs account)
- Action names (create vs add vs new)
- Status names (active vs enabled vs live)
- Technical terms (API vs endpoint vs route)

### 4. Staleness Detection

Identifies content that may be outdated:

```
⚠️ SEMANTIC: Potentially stale content

docs/architecture/decisions/adr-003-use-rabbitmq.md
  References: RabbitMQ
  But codebase uses: BullMQ (from package.json)
  ADR may be superseded

docs/domains/auth/oauth.md
  Last modified: 8 months ago
  References: Firebase Auth v8
  Current version: Firebase Auth v10
```

**Staleness indicators:**
- Technology version mismatches
- Deprecated API references
- Old date references
- Conflicting with current code patterns

## Workflow

### Step 1: Collect Context

Gather related specifications for comparison:
- Group by domain (all billing docs together)
- Include schema + domain + feature for each area
- Load patterns that apply

### Step 2: Analyze Each Group

For each domain group, check:
1. Internal consistency (do these docs agree?)
2. Cross-reference validity (do links point to matching content?)
3. Template compliance (are required sections present?)

### Step 3: Cross-Domain Analysis

Check across domain boundaries:
1. Terminology alignment
2. Shared concept consistency
3. Integration point agreement

### Step 4: Generate Report

Format findings as advisory warnings:

```
Semantic Validation Report
==========================

Checked: 45 specifications
Duration: 12.3s

Contradictions: 2
  ⚠️ billing/subscriptions.md vs billing/invoices.md
  ⚠️ auth/roles.md vs security/permissions.md

Incomplete: 4
  ⚠️ schemas/webhooks.md - missing Error Cases
  ⚠️ domains/events/index.md - missing Related Schemas
  ⚠️ products/api/features/rate-limiting.md - missing Examples
  ⚠️ infrastructure/redis.md - missing Configuration

Terminology: 1
  ⚠️ "tenant" vs "organization" vs "account"

Staleness: 1
  ⚠️ architecture/decisions/adr-003-use-rabbitmq.md

Total: 8 advisory warnings
```

## Example Checks

### Schema vs Domain Consistency

```yaml
# Schema says:
subscriptions.status: enum [active, paused, cancelled]

# Domain docs say:
"Subscriptions can be active, on-hold, or ended"
```

**Finding:** Status terminology mismatch between schema and domain docs.

### Feature vs API Consistency

```yaml
# Feature spec says:
"Users can create up to 10 properties per account"

# API spec says:
"POST /properties - No limit specified"
```

**Finding:** Missing limit documentation in API spec.

### Pattern vs Implementation

```yaml
# Pattern says:
"All mutations return Result<T, E>"

# Domain shows:
"The service throws NotFoundError when..."
```

**Finding:** Domain docs describe throwing, pattern requires Result.

## Configuration

Semantic validation can be configured in `spec.config.yaml`:

```yaml
semantic:
  enabled: true
  checks:
    contradictions: true
    completeness: true
    terminology: true
    staleness: true
  ignore:
    - "docs/drafts/**"  # Skip draft documents
    - "docs/archive/**" # Skip archived content
  terminology:
    preferred:
      tenant: ["organization", "account", "workspace"]
      property: ["listing", "real estate"]
```

## Output Modes

### Console (Default)

Human-readable warnings with context:

```
⚠️ SEMANTIC: Terminology inconsistency in billing domain

Found 3 terms for the same concept:
  - "subscription" (12 occurrences)
  - "plan" (8 occurrences)
  - "membership" (2 occurrences)

Recommendation: Standardize on "subscription"
```

### JSON

Machine-readable for CI integration:

```json
{
  "semantic": {
    "pass": true,
    "warnings": [
      {
        "category": "terminology",
        "severity": "warning",
        "message": "Inconsistent terminology",
        "details": {
          "terms": ["subscription", "plan", "membership"],
          "recommendation": "subscription"
        },
        "locations": [
          {"file": "docs/domains/billing/plans.md", "line": 15}
        ]
      }
    ]
  }
}
```

### Markdown Report

For PR comments or documentation:

```markdown
## Semantic Validation Results

### ⚠️ Advisory Warnings (3)

#### Terminology: "subscription" vs "plan"

| File | Term Used |
|------|-----------|
| billing/subscriptions.md | subscription |
| billing/plans.md | plan |
| products/pricing.md | membership |

**Recommendation:** Consider standardizing on "subscription"
```

## Tools Required

- **Read** - Read specification content
- **Glob** - Find all specs in a domain
- **Grep** - Search for term usage

## Integration with CI

Semantic validation should:
- Run after structural validation passes
- Report warnings but not fail the build
- Generate artifacts for human review

```yaml
# Example CI step
- name: Semantic Validation
  run: /spec validate --semantic
  continue-on-error: true  # Advisory only

- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: semantic-report
    path: semantic-validation.json
```

## Limitations

Semantic validation has known limitations:

1. **Context dependency** - May miss domain-specific valid variations
2. **False positives** - Legitimate differences flagged as issues
3. **Coverage gaps** - Cannot check everything
4. **LLM variance** - Results may vary between runs

Always review findings with domain knowledge before acting.
