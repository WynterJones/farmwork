export const sentry = {
  id: "sentry",
  name: "Sentry",
  emoji: "🐛",
  description: "Pull errors and create bug-fixing tasks",
  category: "monitoring",

  mcp: {
    name: "sentry",
    transport: "http",
    url: "https://mcp.sentry.dev/mcp",
  },

  requiresApiKey: false,
  usesOAuth: true,
  oauthNote: "You'll be prompted to authenticate with Sentry in your browser",

  skill: {
    name: "sentry-errors",
    description:
      "Pull errors from Sentry and create bug-fixing tasks. Use when user says 'check sentry', 'pull errors', 'what bugs', 'error report', or needs to triage production issues.",
    allowedTools: "Bash(bd:*), Read, Edit, Glob, Grep, mcp__sentry__*",
    workflow: `# Sentry Error Skill

Pull production errors from Sentry and create actionable bug-fixing tasks.

## When to Use
- Morning error triage
- Post-deployment monitoring
- Sprint planning (bug backlog)
- Incident investigation

## Workflow

### Step 1: Pull Recent Errors
Use Sentry MCP tools:
- \`list_issues\` - Get recent issues
- \`get_issue_details\` - Get stack traces
- \`list_events\` - See error frequency

### Step 2: Prioritize
Categorize by:
- **Critical**: Affecting > 100 users/hour
- **High**: New errors in last 24h
- **Medium**: Recurring but stable
- **Low**: Edge cases

### Step 3: Create Issues
For each actionable error:
\`\`\`bash
bd create "Fix: [error title]" -t bug -p [0-4]
\`\`\`

Include in description:
- Stack trace summary
- Affected users count
- Sentry issue URL

## Output Format
\`\`\`
## Sentry Error Report

### Summary
- Total Issues: X
- New (24h): Y
- Resolved: Z

### Critical (Fix Now)
1. [Error Name] - X users affected
   - beads issue: #123
   - Sentry: [link]

### High Priority
...

### Next Steps
- Fix critical issues immediately
- Schedule high priority for this sprint
\`\`\`
`,
  },

  getInstallCommand: () =>
    `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`,
};
