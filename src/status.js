import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { farmTerm, emojis } from "./terminal.js";

function countTestFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    const result = execSync(
      `find "${dir}" -name "*.test.*" -not -path "*/node_modules/*" 2>/dev/null | wc -l`,
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

function countSkills(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).length;
  } catch {
    return 0;
  }
}

function readAuditFile(cwd, filename) {
  const filePath = path.join(cwd, "_AUDIT", filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const scoreMatch = content.match(/\*\*Score:\*\* (\d+\.?\d*)\/10/);
    const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\* (\d{4}-\d{2}-\d{2})/);

    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: statusMatch ? statusMatch[1].trim() : null,
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
    farmTerm.error("Farmwork not initialized");
    farmTerm.info("Run: farmwork init");
    return;
  }

  farmTerm.logo();
  farmTerm.header("FARMWORK STATUS", "primary");
  await farmTerm.analyzing("Scanning project", 800);

  const agentsDir = path.join(claudeDir, "agents");
  const commandsDir = path.join(claudeDir, "commands");
  const skillsDir = path.join(claudeDir, "skills");
  const auditDir = path.join(cwd, "_AUDIT");
  const plansDir = path.join(cwd, "_PLANS");

  const agents = countMarkdownFiles(agentsDir);
  const commands = countMarkdownFiles(commandsDir);
  const skills = countSkills(skillsDir);
  const audits = countMarkdownFiles(auditDir);
  const plans = countMarkdownFiles(plansDir);

  // Component Counts Section
  farmTerm.section("Component Counts", emojis.corn);
  farmTerm.metric("Agents", agents, emojis.horse);
  farmTerm.metric("Commands", commands, emojis.bee);
  farmTerm.metric("Skills", skills, emojis.sheep);
  farmTerm.metric("Audit Docs", audits, emojis.wheat);
  farmTerm.metric("Plans", plans, emojis.sunflower);

  // Audit Scores Section
  const farmhouse = readAuditFile(cwd, "FARMHOUSE.md");
  if (farmhouse && farmhouse.score !== null) {
    farmTerm.section("Audit Scores", emojis.owl);
    farmTerm.score("Farmhouse", farmhouse.score, 10);
  }

  // Configuration Files Section
  const claudeMd = path.join(cwd, "CLAUDE.md");

  farmTerm.section("Configuration Status", emojis.seedling);

  const configItems = [
    { label: "CLAUDE.md", exists: fs.existsSync(claudeMd) },
    { label: ".claude/agents/", exists: fs.existsSync(agentsDir) && agents > 0 },
    { label: ".claude/commands/", exists: fs.existsSync(commandsDir) && commands > 0 },
    { label: ".claude/skills/", exists: fs.existsSync(skillsDir) && skills > 0 },
    { label: "_AUDIT/FARMHOUSE.md", exists: fs.existsSync(path.join(auditDir, "FARMHOUSE.md")) },
    { label: "_AUDIT/GARDEN.md", exists: fs.existsSync(path.join(auditDir, "GARDEN.md")) },
    { label: "_AUDIT/COMPOST.md", exists: fs.existsSync(path.join(auditDir, "COMPOST.md")) },
    { label: "_PLANS/", exists: fs.existsSync(plansDir) },
  ];

  for (const item of configItems) {
    if (item.exists) {
      farmTerm.status(item.label, "pass");
    } else {
      farmTerm.status(item.label, "fail", "(missing)");
    }
  }

  // Project Metrics Section
  const testFiles = countTestFiles(cwd);

  if (testFiles > 0) {
    farmTerm.section("Project Metrics", emojis.sunflower);
    farmTerm.metric("Test Files", testFiles, emojis.potato);
  }

  // ASCII Art and Phrases
  farmTerm.nl();
  farmTerm.printTractor();

  farmTerm.phrases([
    { phrase: "open the farm", description: "Quick audit, update FARMHOUSE.md", emoji: emojis.seedling },
    { phrase: "count the herd", description: "Deep audit: full code inspection", emoji: emojis.owl },
    { phrase: "I have an idea for...", description: "Plant idea in GARDEN.md", emoji: emojis.herb },
    { phrase: "water the garden", description: "Generate 10 new ideas", emoji: emojis.water },
    { phrase: "/push", description: "Review, test, build, commit, push", emoji: emojis.tractor },
  ]);

  farmTerm.gray("  Run `farmwork doctor` to check for issues.\n\n");
}
