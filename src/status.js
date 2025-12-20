import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { execSync } from "child_process";

function countFiles(dir, pattern) {
  try {
    if (!fs.existsSync(dir)) return 0;
    const result = execSync(
      `find "${dir}" -name "${pattern}" 2>/dev/null | wc -l`,
      { encoding: "utf8" },
    );
    return parseInt(result.trim()) || 0;
  } catch {
    return 0;
  }
}

function countMarkdownFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    return files.length;
  } catch {
    return 0;
  }
}

function getBeadsStatus(cwd) {
  try {
    const openResult = execSync("bd list --status open 2>/dev/null | wc -l", {
      cwd,
      encoding: "utf8",
    });
    const closedResult = execSync(
      "bd list --status closed 2>/dev/null | wc -l",
      { cwd, encoding: "utf8" },
    );
    return {
      open: Math.max(0, parseInt(openResult.trim()) - 1),
      closed: Math.max(0, parseInt(closedResult.trim()) - 1),
    };
  } catch {
    return { open: 0, closed: 0 };
  }
}

function readFarmhouse(cwd) {
  const farmhousePath = path.join(cwd, "_AUDIT", "FARMHOUSE.md");
  if (!fs.existsSync(farmhousePath)) return null;

  try {
    const content = fs.readFileSync(farmhousePath, "utf8");
    const scoreMatch = content.match(/\*\*Score:\*\* (\d+\.?\d*)\/10/);
    const statusMatch = content.match(/\*\*Status:\*\* (\d+) open items/);
    const lastUpdatedMatch = content.match(
      /\*\*Last Updated:\*\* (\d{4}-\d{2}-\d{2})/,
    );

    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      openItems: statusMatch ? parseInt(statusMatch[1]) : null,
      lastUpdated: lastUpdatedMatch ? lastUpdatedMatch[1] : null,
    };
  } catch {
    return null;
  }
}

export async function status() {
  const cwd = process.cwd();

  const claudeDir = path.join(cwd, ".claude");
  if (!fs.existsSync(claudeDir)) {
    console.log(chalk.red("\n❌ Farmwork not initialized"));
    console.log(chalk.gray("   Run: farmwork init"));
    return;
  }

  console.log(chalk.cyan("\n📊 Farmwork Status\n"));

  const agentsDir = path.join(claudeDir, "agents");
  const commandsDir = path.join(claudeDir, "commands");
  const auditDir = path.join(cwd, "_AUDIT");
  const plansDir = path.join(cwd, "_PLANS");
  const beadsDir = path.join(cwd, ".beads");

  const agents = countMarkdownFiles(agentsDir);
  const commands = countMarkdownFiles(commandsDir);
  const audits = countMarkdownFiles(auditDir);
  const plans = countMarkdownFiles(plansDir);

  console.log(chalk.white("┌─────────────────────────────────────────┐"));
  console.log(
    chalk.white("│") +
      chalk.bold("  Component Counts                       ") +
      chalk.white("│"),
  );
  console.log(chalk.white("├─────────────────────────────────────────┤"));
  console.log(
    chalk.white("│") +
      `  Agents (.claude/agents/)     ${chalk.green(String(agents).padStart(8))} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  Commands (.claude/commands/) ${chalk.green(String(commands).padStart(8))} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  Audit Docs (_AUDIT/)         ${chalk.green(String(audits).padStart(8))} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  Plans (_PLANS/)              ${chalk.yellow(String(plans).padStart(8))} ` +
      chalk.white("│"),
  );
  console.log(chalk.white("└─────────────────────────────────────────┘"));

  if (fs.existsSync(beadsDir)) {
    const beads = getBeadsStatus(cwd);
    console.log(chalk.white("\n┌─────────────────────────────────────────┐"));
    console.log(
      chalk.white("│") +
        chalk.bold("  Issue Tracking (beads)                 ") +
        chalk.white("│"),
    );
    console.log(chalk.white("├─────────────────────────────────────────┤"));
    console.log(
      chalk.white("│") +
        `  Open Issues                  ${chalk.yellow(String(beads.open).padStart(8))} ` +
        chalk.white("│"),
    );
    console.log(
      chalk.white("│") +
        `  Closed Issues                ${chalk.green(String(beads.closed).padStart(8))} ` +
        chalk.white("│"),
    );
    console.log(chalk.white("└─────────────────────────────────────────┘"));
  }

  const farmhouse = readFarmhouse(cwd);
  if (farmhouse) {
    console.log(chalk.white("\n┌─────────────────────────────────────────┐"));
    console.log(
      chalk.white("│") +
        chalk.bold("  FARMHOUSE Status                       ") +
        chalk.white("│"),
    );
    console.log(chalk.white("├─────────────────────────────────────────┤"));
    if (farmhouse.score !== null) {
      const scoreColor =
        farmhouse.score >= 8
          ? chalk.green
          : farmhouse.score >= 5
            ? chalk.yellow
            : chalk.red;
      console.log(
        chalk.white("│") +
          `  Score                        ${scoreColor(String(farmhouse.score + "/10").padStart(8))} ` +
          chalk.white("│"),
      );
    }
    if (farmhouse.openItems !== null) {
      const itemsColor = farmhouse.openItems === 0 ? chalk.green : chalk.yellow;
      console.log(
        chalk.white("│") +
          `  Open Items                   ${itemsColor(String(farmhouse.openItems).padStart(8))} ` +
          chalk.white("│"),
      );
    }
    if (farmhouse.lastUpdated) {
      console.log(
        chalk.white("│") +
          `  Last Updated                 ${chalk.gray(farmhouse.lastUpdated)} ` +
          chalk.white("│"),
      );
    }
    console.log(chalk.white("└─────────────────────────────────────────┘"));
  }

  const claudeMd = path.join(cwd, "CLAUDE.md");
  const justfile = path.join(cwd, "justfile");
  const settingsJson = path.join(claudeDir, "settings.json");

  console.log(chalk.white("\n┌─────────────────────────────────────────┐"));
  console.log(
    chalk.white("│") +
      chalk.bold("  Configuration Files                    ") +
      chalk.white("│"),
  );
  console.log(chalk.white("├─────────────────────────────────────────┤"));
  console.log(
    chalk.white("│") +
      `  CLAUDE.md          ${fs.existsSync(claudeMd) ? chalk.green("        ✓ exists") : chalk.red("        ✗ missing")} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  justfile           ${fs.existsSync(justfile) ? chalk.green("        ✓ exists") : chalk.red("        ✗ missing")} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  settings.json      ${fs.existsSync(settingsJson) ? chalk.green("        ✓ exists") : chalk.red("        ✗ missing")} ` +
      chalk.white("│"),
  );
  console.log(
    chalk.white("│") +
      `  .beads/            ${fs.existsSync(beadsDir) ? chalk.green("        ✓ exists") : chalk.gray("     not configured")} ` +
      chalk.white("│"),
  );
  console.log(chalk.white("└─────────────────────────────────────────┘"));

  const testFiles =
    countFiles(cwd, "*.test.ts") + countFiles(cwd, "*.test.tsx");
  const storyFiles = countFiles(cwd, "*.stories.tsx");

  if (testFiles > 0 || storyFiles > 0) {
    console.log(chalk.white("\n┌─────────────────────────────────────────┐"));
    console.log(
      chalk.white("│") +
        chalk.bold("  Project Metrics                        ") +
        chalk.white("│"),
    );
    console.log(chalk.white("├─────────────────────────────────────────┤"));
    if (testFiles > 0) {
      console.log(
        chalk.white("│") +
          `  Test Files                   ${chalk.green(String(testFiles).padStart(8))} ` +
          chalk.white("│"),
      );
    }
    if (storyFiles > 0) {
      console.log(
        chalk.white("│") +
          `  Storybook Stories            ${chalk.green(String(storyFiles).padStart(8))} ` +
          chalk.white("│"),
      );
    }
    console.log(chalk.white("└─────────────────────────────────────────┘"));
  }

  console.log(chalk.gray("\nRun `farmwork doctor` to check for issues.\n"));
}
