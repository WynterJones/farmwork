export const context7 = {
  id: "context7",
  name: "Context7",
  emoji: "📖",
  description: "Check documentation for latest library versions",
  category: "research",

  mcp: {
    name: "context7",
    transport: "stdio",
    command: "npx -y @upstash/context7-mcp",
  },

  requiresApiKey: true,
  apiKeyName: "CONTEXT7_API_KEY",
  apiKeyDescription: "Get your free API key at https://context7.com",
  apiKeyOptional: true,

  skill: {
    name: "context7-docs",
    description:
      "Check library documentation for latest versions and APIs. Use when user says 'check docs for', 'latest version of', 'how to use [library]', or needs up-to-date library information.",
    allowedTools: "Read, Glob, Grep, mcp__context7__*",
    workflow: `# Context7 Documentation Skill

Access up-to-date documentation for npm packages and libraries.

## When to Use
- Before using unfamiliar APIs
- Checking for breaking changes
- Learning new library features
- Verifying deprecation notices

## Workflow

### Step 1: Identify Library
Parse the library name from the user request.

### Step 2: Fetch Documentation
Use Context7 MCP tools:
- \`resolve_library_id\` - Get library identifier
- \`get_library_docs\` - Fetch documentation sections

### Step 3: Extract Relevant Info
- Focus on the specific API/feature requested
- Note version requirements
- Highlight breaking changes

## Output Format
\`\`\`
## Documentation: [Library Name]

### Version: X.Y.Z

### [Requested Topic]
[Relevant documentation excerpts]

### Key Points
- Point 1
- Point 2

### Code Example
[Example code block]

### Notes
- Any caveats or version requirements
\`\`\`
`,
  },

  getInstallCommand: (apiKey) => {
    if (apiKey) {
      return `claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key ${apiKey}`;
    }
    return `claude mcp add context7 -- npx -y @upstash/context7-mcp`;
  },
};
