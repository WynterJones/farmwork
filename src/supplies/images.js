export const images = {
  id: "images",
  name: "Image Generation",
  emoji: "🎨",
  description: "Generate images from prompts",
  category: "creative",

  requiresApiKey: true,
  hasProviders: true,

  providers: {
    gemini: {
      id: "images-gemini",
      name: "Nano Banana Pro (Gemini)",
      mcpName: "nano-banana-pro",
      apiKeyName: "GEMINI_API_KEY",
      apiKeyDescription:
        "Get your Gemini API key at https://aistudio.google.com/apikey",
      getInstallCommand: (apiKey) =>
        `claude mcp add nano-banana-pro --env GEMINI_API_KEY=${apiKey} -- npx @rafarafarafa/nano-banana-pro-mcp`,
    },
    openai: {
      id: "images-openai",
      name: "GPT-Image-1 (OpenAI)",
      mcpName: "gpt-image",
      apiKeyName: "OPENAI_API_KEY",
      apiKeyDescription:
        "Get your OpenAI API key at https://platform.openai.com/api-keys",
      getInstallCommand: (apiKey) =>
        `claude mcp add gpt-image --env OPENAI_API_KEY=${apiKey} -- npx -y gpt-image-1-mcp`,
    },
  },

  skill: {
    name: "image-gen",
    description:
      "Generate images from text prompts. Use when user says 'generate image', 'create picture', 'make an image of', or needs visual assets.",
    allowedTools:
      "Bash(*), Read, Write, mcp__nano-banana-pro__*, mcp__gpt-image__*",
    workflow: `# Image Generation Skill

Generate images from text prompts and save to your project.

## When to Use
- Creating placeholder images
- Generating icons or illustrations
- Making diagrams or visual concepts
- Visual prototyping

## Workflow

### Step 1: Craft Prompt
Build a detailed prompt including:
- Subject description
- Style (realistic, cartoon, sketch, flat, etc.)
- Colors and mood
- Composition details

### Step 2: Generate
Use the available image MCP:
- \`image_generate\` - Create image from prompt
- Include negative prompt to avoid unwanted elements

### Step 3: Save & Organize
- Save to \`public/images/\` or \`assets/generated/\`
- Use descriptive filename: \`feature-illustration-v1.png\`
- Add to .gitignore if temporary

## Prompt Tips
- Be specific: "A red barn at sunset" > "A barn"
- Specify style: "in flat vector style with bold colors"
- Add context: "for a farm management app header"

## Output Format
\`\`\`
## Image Generated

### Prompt
[The prompt used]

### File
\`public/images/[filename].png\`

### Dimensions
[width] x [height]

### Usage
<img src="/images/[filename].png" alt="[description]" />
\`\`\`
`,
  },

  getInstallCommand: () => null,
};
