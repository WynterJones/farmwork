import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const TEMPLATES = {
  agent: (name, description) => `# ${name} Agent

> ${description}

## Purpose

[Describe what this agent does and when to use it]

## Triggers

This agent is launched via the Task tool with \`subagent_type="${name}"\`.

## Workflow

1. [First step]
2. [Second step]
3. [Third step]

## Output

[Describe what the agent returns or produces]

## Examples

\`\`\`
# Example usage
Task tool with subagent_type="${name}"
Prompt: "[Example prompt]"
\`\`\`
`,

  command: (name, description) => `# ${name.charAt(0).toUpperCase() + name.slice(1)} Command

${description}

## Workflow

Execute these steps in order. **Stop immediately if any step fails.**

### Step 1: [First Step]

\`\`\`bash
# Command to run
\`\`\`

### Step 2: [Second Step]

\`\`\`bash
# Command to run
\`\`\`

### Step 3: Report Results

Show a summary of what was accomplished.
`,

  audit: (name) => `# ${name.charAt(0).toUpperCase() + name.slice(1)} Audit

> [One-line description of this audit area]

**Last Updated:** ${new Date().toISOString().split('T')[0]}
**Score:** 0.0/10
**Status:** 0 open items

---

## How to get 10/10

[One paragraph explaining what perfect looks like for this area]

---

## Constraints

| Constraint | Reason | Impact |
|------------|--------|--------|
| [Constraint 1] | [Why] | [What happens] |

---

## Open Items

_None currently_

---

## [Area-Specific Section]

[Content specific to this audit area]

---

## Audit History

| Date | Changes |
|------|---------|
| ${new Date().toISOString().split('T')[0]} | Initial audit document |
`
};

export async function add(type, name, options) {
  const cwd = process.cwd();
  const spinner = ora();

  const validTypes = ['agent', 'command', 'audit'];
  if (!validTypes.includes(type)) {
    console.log(chalk.red(`\n❌ Invalid type: ${type}`));
    console.log(chalk.gray(`   Valid types: ${validTypes.join(', ')}`));
    return;
  }

  if (!name) {
    console.log(chalk.red('\n❌ Name is required'));
    console.log(chalk.gray(`   Usage: produce add ${type} <name>`));
    return;
  }

  const claudeDir = path.join(cwd, '.claude');
  if (!fs.existsSync(claudeDir)) {
    console.log(chalk.red('\n❌ Farmwork framework not initialized'));
    console.log(chalk.gray('   Run: produce init'));
    return;
  }

  spinner.start(`Adding ${type}: ${name}`);

  try {
    let filePath;
    let content;
    let description = options?.description || `[Description for ${name}]`;

    switch (type) {
      case 'agent':
        filePath = path.join(claudeDir, 'agents', `${name}.md`);
        content = TEMPLATES.agent(name, description);
        break;

      case 'command':
        filePath = path.join(claudeDir, 'commands', `${name}.md`);
        content = TEMPLATES.command(name, description);
        break;

      case 'audit':
        const auditDir = path.join(cwd, '_AUDIT');
        if (!fs.existsSync(auditDir)) {
          fs.mkdirSync(auditDir, { recursive: true });
        }
        filePath = path.join(auditDir, `${name.toUpperCase()}.md`);
        content = TEMPLATES.audit(name);
        break;
    }

    if (fs.existsSync(filePath)) {
      spinner.fail(`${type} already exists: ${name}`);
      console.log(chalk.gray(`   File: ${filePath}`));
      return;
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    spinner.succeed(`Added ${type}: ${name}`);

    console.log(chalk.gray(`\n   File: ${filePath}`));
    console.log(chalk.cyan(`\n   Edit the file to customize the ${type}.`));

    if (type === 'agent') {
      console.log(chalk.gray(`\n   Launch with: Task tool, subagent_type="${name}"`));
    } else if (type === 'command') {
      console.log(chalk.gray(`\n   Invoke with: /${name}`));
    } else if (type === 'audit') {
      console.log(chalk.gray(`\n   Update FARMHOUSE.md to reference this audit.`));
    }

  } catch (error) {
    spinner.fail(`Failed to add ${type}`);
    console.log(chalk.red(`   ${error.message}`));
  }
}
