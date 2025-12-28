import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { farmTerm, emojis } from "./terminal.js";

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

function readAuditFile(cwd, filename) {
  const filePath = path.join(cwd, "_AUDIT", filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const scoreMatch = content.match(/\*\*Score:\*\* (\d+\.?\d*)\/10/);
    const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
    const lastUpdatedMatch = content.match(
      /\*\*Last Updated:\*\* (\d{4}-\d{2}-\d{2})/,
    );

    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: statusMatch ? statusMatch[1].trim() : null,
      lastUpdated: lastUpdatedMatch ? lastUpdatedMatch[1] : null,
    };
  } catch {
    return null;
  }
}

function countJustfileRecipes(cwd) {
  const justfilePath = path.join(cwd, "justfile");
  if (!fs.existsSync(justfilePath)) return 0;

  try {
    const content = fs.readFileSync(justfilePath, "utf8");
    const recipes = content.match(/^[a-zA-Z_][a-zA-Z0-9_-]*\s*:/gm);
    return recipes ? recipes.length : 0;
  } catch {
    return 0;
  }
}

export async function status() {
  const cwd = process.cwd();

  const claudeDir = path.join(cwd, ".claude");
  if (!fs.existsSync(claudeDir)) {
    farmTerm.error("Farmwork not initialized");
    farmTerm.info("Run: farmwork init");
    return;
  }

  // Header with logo
  farmTerm.logo();
  farmTerm.header("FARMWORK STATUS", "primary");
  await farmTerm.analyzing("Scanning project", 800);

  const agentsDir = path.join(claudeDir, "agents");
  const commandsDir = path.join(claudeDir, "commands");
  const auditDir = path.join(cwd, "_AUDIT");
  const plansDir = path.join(cwd, "_PLANS");
  const researchDir = path.join(cwd, "_RESEARCH");
  const officeDir = path.join(cwd, "_OFFICE");
  const beadsDir = path.join(cwd, ".beads");

  const agents = countMarkdownFiles(agentsDir);
  const commands = countMarkdownFiles(commandsDir);
  const audits = countMarkdownFiles(auditDir);
  const plans = countMarkdownFiles(plansDir);
  const research = countMarkdownFiles(researchDir);
  const office = countMarkdownFiles(officeDir);
  const recipes = countJustfileRecipes(cwd);

  // Component Counts Section
  farmTerm.section("Component Counts", emojis.corn);
  farmTerm.metric("Agents", agents, emojis.horse);
  farmTerm.metric("Commands", commands, emojis.bee);
  farmTerm.metric("Justfile Recipes", recipes, emojis.sheep);
  farmTerm.metric("Audit Docs", audits, emojis.wheat);
  farmTerm.metric("Research Docs", research, emojis.owl);
  farmTerm.metric("Office Docs", office, emojis.barn);
  farmTerm.metric("Plans", plans, emojis.sunflower);

  // Issue Tracking Section
  if (fs.existsSync(beadsDir)) {
    const beads = getBeadsStatus(cwd);
    farmTerm.section("Issue Tracking", emojis.pig);
    farmTerm.metric("Open Issues", beads.open, emojis.apple);
    farmTerm.metric("Closed Issues", beads.closed, emojis.lettuce);

    if (beads.open + beads.closed > 0) {
      const completionRate = Math.round((beads.closed / (beads.open + beads.closed)) * 100);
      farmTerm.nl();
      farmTerm.score("Completion", completionRate, 100);
    }
  }

  // Audit Scores Section
  const auditFiles = [
    { name: "FARMHOUSE.md", label: "Farmhouse" },
    { name: "CODE_QUALITY.md", label: "Code Quality" },
    { name: "SECURITY.md", label: "Security" },
    { name: "PERFORMANCE.md", label: "Performance" },
    { name: "TESTS.md", label: "Tests" },
  ];

  const auditData = auditFiles
    .map((f) => ({ ...f, data: readAuditFile(cwd, f.name) }))
    .filter((f) => f.data !== null && f.data.score !== null);

  if (auditData.length > 0) {
    farmTerm.section("Audit Scores", emojis.owl);

    for (const audit of auditData) {
      farmTerm.score(audit.label, audit.data.score, 10);
    }

    // Calculate average score
    const avgScore = auditData.reduce((sum, a) => sum + a.data.score, 0) / auditData.length;
    farmTerm.nl();
    farmTerm.divider();
    farmTerm.score("Average Score", avgScore.toFixed(1), 10);
  }

  // Configuration Files Section
  const claudeMd = path.join(cwd, "CLAUDE.md");
  const justfile = path.join(cwd, "justfile");

  farmTerm.section("Configuration Status", emojis.seedling);

  const configItems = [
    { label: "CLAUDE.md", exists: fs.existsSync(claudeMd) },
    { label: "justfile", exists: fs.existsSync(justfile) },
    { label: ".claude/agents/", exists: fs.existsSync(agentsDir) && agents > 0 },
    { label: ".claude/commands/", exists: fs.existsSync(commandsDir) && commands > 0 },
    { label: "_OFFICE/", exists: fs.existsSync(officeDir) && office > 0 },
    { label: "_RESEARCH/", exists: fs.existsSync(researchDir), optional: true },
    { label: ".beads/", exists: fs.existsSync(beadsDir), optional: true },
  ];

  for (const item of configItems) {
    if (item.exists) {
      farmTerm.status(item.label, "pass");
    } else if (item.optional) {
      farmTerm.status(item.label, "info", "(optional)");
    } else {
      farmTerm.status(item.label, "fail", "(missing)");
    }
  }

  // Project Metrics Section
  const testFiles = countFiles(cwd, "*.test.ts") + countFiles(cwd, "*.test.tsx");
  const storyFiles = countFiles(cwd, "*.stories.tsx");

  if (testFiles > 0 || storyFiles > 0) {
    farmTerm.section("Project Metrics", emojis.sunflower);
    if (testFiles > 0) {
      farmTerm.metric("Test Files", testFiles, emojis.potato);
    }
    if (storyFiles > 0) {
      farmTerm.metric("Storybook Stories", storyFiles, emojis.cow);
    }
  }

  // ASCII Art and Phrases
  farmTerm.nl();
  farmTerm.printTractor();

  farmTerm.phrases([
    { phrase: "till the land", description: "Audit systems, update FARMHOUSE.md", emoji: emojis.seedling },
    { phrase: "inspect the farm", description: "Full code review & quality audit", emoji: emojis.owl },
    { phrase: "go to market", description: "Scan & translate missing i18n", emoji: emojis.basket },
    { phrase: "harvest crops", description: "Lint, test, build, commit, push", emoji: emojis.tractor },
    { phrase: "open the farm", description: "Full audit cycle", emoji: emojis.barn },
  ]);

  farmTerm.gray("  Run `farmwork doctor` to check for issues.\n\n");
}
