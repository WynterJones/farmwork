import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { execSync } from "child_process";

function checkExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  return {
    passed: exists,
    message: description,
    details: exists ? null : `Missing: ${filePath}`,
  };
}

function checkCommand(command, description) {
  try {
    execSync(`which ${command}`, { encoding: "utf8", stdio: "pipe" });
    return { passed: true, message: description, details: null };
  } catch {
    return {
      passed: false,
      message: description,
      details: `Command not found: ${command}`,
    };
  }
}

function checkDirectoryNotEmpty(dir, description) {
  if (!fs.existsSync(dir)) {
    return {
      passed: false,
      message: description,
      details: `Directory missing: ${dir}`,
    };
  }
  const files = fs.readdirSync(dir);
  const hasContent = files.length > 0;
  return {
    passed: hasContent,
    message: description,
    details: hasContent ? null : `Directory empty: ${dir}`,
  };
}

function checkClaudeMdSections(claudeMdPath) {
  if (!fs.existsSync(claudeMdPath)) {
    return {
      passed: false,
      message: "CLAUDE.md has required sections",
      details: "File missing",
    };
  }

  const content = fs.readFileSync(claudeMdPath, "utf8");
  const requiredSections = [
    "Phrase Commands",
    "Issue Tracking",
    "Claude Code Commands",
  ];

  const missing = requiredSections.filter(
    (section) => !content.includes(section),
  );

  return {
    passed: missing.length === 0,
    message: "CLAUDE.md has required sections",
    details:
      missing.length > 0 ? `Missing sections: ${missing.join(", ")}` : null,
  };
}

function checkFarmhouseFormat(farmhousePath) {
  if (!fs.existsSync(farmhousePath)) {
    return {
      passed: false,
      message: "FARMHOUSE.md follows format",
      details: "File missing",
    };
  }

  const content = fs.readFileSync(farmhousePath, "utf8");
  const requiredFields = ["**Last Updated:**", "**Score:**", "**Status:**"];

  const missing = requiredFields.filter((field) => !content.includes(field));

  return {
    passed: missing.length === 0,
    message: "FARMHOUSE.md follows format",
    details:
      missing.length > 0 ? `Missing fields: ${missing.join(", ")}` : null,
  };
}

function checkGitignore(cwd) {
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return {
      passed: false,
      message: ".gitignore includes local settings",
      details: "File missing",
    };
  }

  const content = fs.readFileSync(gitignorePath, "utf8");
  const hasLocalSettings = content.includes("settings.local.json");

  return {
    passed: hasLocalSettings,
    message: ".gitignore includes local settings",
    details: hasLocalSettings ? null : "Add: .claude/settings.local.json",
  };
}

export async function doctor() {
  const cwd = process.cwd();

  console.log(chalk.cyan("\n🩺 Farmwork Doctor\n"));
  console.log(chalk.gray("Checking your Farmwork setup...\n"));

  const checks = [];

  checks.push({ category: "Core Files", items: [] });
  checks[0].items.push(
    checkExists(path.join(cwd, "CLAUDE.md"), "CLAUDE.md exists"),
  );
  checks[0].items.push(
    checkExists(path.join(cwd, ".claude"), ".claude/ directory exists"),
  );
  checks[0].items.push(
    checkExists(
      path.join(cwd, ".claude", "settings.json"),
      "settings.json exists",
    ),
  );
  checks[0].items.push(checkClaudeMdSections(path.join(cwd, "CLAUDE.md")));

  checks.push({ category: "Agents & Commands", items: [] });
  checks[1].items.push(
    checkDirectoryNotEmpty(
      path.join(cwd, ".claude", "agents"),
      "Has agents defined",
    ),
  );
  checks[1].items.push(
    checkDirectoryNotEmpty(
      path.join(cwd, ".claude", "commands"),
      "Has commands defined",
    ),
  );

  checks.push({ category: "Audit System", items: [] });
  checks[2].items.push(
    checkExists(path.join(cwd, "_AUDIT"), "_AUDIT/ directory exists"),
  );
  checks[2].items.push(
    checkExists(
      path.join(cwd, "_AUDIT", "FARMHOUSE.md"),
      "FARMHOUSE.md exists",
    ),
  );
  checks[2].items.push(
    checkFarmhouseFormat(path.join(cwd, "_AUDIT", "FARMHOUSE.md")),
  );
  checks[2].items.push(
    checkExists(path.join(cwd, "_PLANS"), "_PLANS/ directory exists"),
  );

  checks.push({ category: "Navigation", items: [] });
  checks[3].items.push(
    checkExists(path.join(cwd, "justfile"), "justfile exists"),
  );
  checks[3].items.push(checkCommand("just", "just command available"));

  checks.push({ category: "Issue Tracking", items: [] });
  checks[4].items.push(
    checkExists(path.join(cwd, ".beads"), ".beads/ directory exists"),
  );
  checks[4].items.push(checkCommand("bd", "bd (beads) command available"));

  checks.push({ category: "Security", items: [] });
  checks[5].items.push(checkGitignore(cwd));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  for (const category of checks) {
    console.log(chalk.bold(`${category.category}`));

    for (const check of category.items) {
      if (check.passed) {
        console.log(chalk.green(`  ✓ ${check.message}`));
        totalPassed++;
      } else {
        if (check.message.includes("beads") || check.message.includes("bd ")) {
          console.log(chalk.yellow(`  ⚠ ${check.message}`));
          if (check.details) console.log(chalk.gray(`    ${check.details}`));
          totalWarnings++;
        } else {
          console.log(chalk.red(`  ✗ ${check.message}`));
          if (check.details) console.log(chalk.gray(`    ${check.details}`));
          totalFailed++;
        }
      }
    }
    console.log();
  }

  console.log(chalk.bold("Summary"));
  console.log(chalk.green(`  ✓ ${totalPassed} passed`));
  if (totalWarnings > 0) {
    console.log(chalk.yellow(`  ⚠ ${totalWarnings} warnings (optional)`));
  }
  if (totalFailed > 0) {
    console.log(chalk.red(`  ✗ ${totalFailed} failed`));
  }

  const health =
    totalFailed === 0
      ? totalWarnings === 0
        ? "Excellent"
        : "Good"
      : totalFailed <= 2
        ? "Needs Attention"
        : "Critical";

  const healthColor =
    health === "Excellent"
      ? chalk.green
      : health === "Good"
        ? chalk.cyan
        : health === "Needs Attention"
          ? chalk.yellow
          : chalk.red;

  console.log(`\n${chalk.bold("Health:")} ${healthColor(health)}`);

  if (totalFailed > 0) {
    console.log(chalk.gray("\nRun `farmwork init` to fix missing components."));
  }

  console.log();
}
