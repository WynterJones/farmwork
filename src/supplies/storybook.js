export const storybook = {
  id: "storybook",
  name: "Storybook Maintainer",
  emoji: "📚",
  description: "Sync and maintain Storybook components with your codebase",
  category: "frontend",

  mcp: {
    name: "storybook-mcp",
    transport: "http",
    url: "http://localhost:6006/mcp",
    scope: "project",
  },

  requiresApiKey: false,
  prerequisite: "Storybook must be running on localhost:6006",

  skill: {
    name: "storybook-sync",
    description:
      "Sync Storybook stories with components. Use when user says 'sync storybook', 'update stories', 'create story for', or needs to maintain component documentation.",
    allowedTools: "Bash(*), Read, Edit, Glob, Grep, mcp__storybook-mcp__*",
    workflow: `# Storybook Sync Skill

Keep Storybook stories in sync with your React/Vue/Svelte components.

## When to Use
- Creating stories for new components
- Updating stories after component changes
- Auditing story coverage
- Setting up interaction tests

## Workflow

### Step 1: Check Coverage
1. Find all components in src/components
2. Find all stories (*.stories.tsx or *.stories.js)
3. Identify components without stories

### Step 2: Use Storybook MCP
Use the storybook-mcp tools to:
- Analyze component structure and props
- Generate story files with proper controls
- Add interaction tests if applicable

### Step 3: Best Practices
- Include all major component variants
- Add controls for all props
- Write play functions for interactions
- Group related stories logically

## Output Format
\`\`\`
## Story Sync Complete

### Coverage
- Components: X
- Stories: Y
- Coverage: Z%

### Created/Updated
- ComponentA.stories.tsx
- ComponentB.stories.tsx

### Missing Stories
- ComponentC (no story yet)
\`\`\`
`,
  },

  getInstallCommand: () =>
    `claude mcp add storybook-mcp --transport http http://localhost:6006/mcp --scope project`,
};
