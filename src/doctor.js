import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { farmTerm, emojis } from "./terminal.js";

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
    "Issue-First Workflow",
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

  farmTerm.logo();
  farmTerm.header("FARMWORK DOCTOR", "accent");
  await farmTerm.analyzing("Diagnosing project health", 1200);

  const checks = [];

  // Core Files
  checks.push({ category: "Core Files", emoji: "🌾", items: [] });
  checks[0].items.push(
    checkExists(path.join(cwd, "CLAUDE.md"), "CLAUDE.md exists"),
  );
  checks[0].items.push(
    checkExists(path.join(cwd, ".claude"), ".claude/ directory exists"),
  );
  checks[0].items.push(checkClaudeMdSections(path.join(cwd, "CLAUDE.md")));

  // Agents & Commands
  checks.push({ category: "Agents & Commands", emoji: "🐴", items: [] });
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

  // Audit System
  checks.push({ category: "Audit System", emoji: "🦉", items: [] });
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

  // Research System
  checks.push({ category: "Research System", emoji: "🔬", items: [] });
  checks[3].items.push(
    checkExists(path.join(cwd, "_RESEARCH"), "_RESEARCH/ directory exists"),
  );

  // Office System
  checks.push({ category: "Office System", emoji: "🏢", items: [] });
  checks[4].items.push(
    checkExists(path.join(cwd, "_OFFICE"), "_OFFICE/ directory exists"),
  );
  checks[4].items.push(
    checkExists(path.join(cwd, "_OFFICE", "GREENFIELD.md"), "GREENFIELD.md exists"),
  );
  checks[4].items.push(
    checkExists(path.join(cwd, "_OFFICE", "BROWNFIELD.md"), "BROWNFIELD.md exists"),
  );
  checks[4].items.push(
    checkExists(path.join(cwd, "_OFFICE", "ONBOARDING.md"), "ONBOARDING.md exists"),
  );
  checks[4].items.push(
    checkExists(path.join(cwd, "_OFFICE", "USER_GUIDE.md"), "USER_GUIDE.md exists"),
  );

  // Navigation
  checks.push({ category: "Navigation", emoji: "🐓", items: [] });
  checks[5].items.push(
    checkExists(path.join(cwd, "justfile"), "justfile exists"),
  );
  checks[5].items.push(checkCommand("just", "just command available"));

  // Issue Tracking
  checks.push({ category: "Issue Tracking", emoji: "🐷", items: [] });
  checks[6].items.push(
    checkExists(path.join(cwd, ".beads"), ".beads/ directory exists"),
  );
  checks[6].items.push(checkCommand("bd", "bd (beads) command available"));

  // Security
  checks.push({ category: "Security", emoji: "🐕", items: [] });
  checks[7].items.push(checkGitignore(cwd));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  // Run checks with animation
  for (const category of checks) {
    farmTerm.section(category.category, category.emoji);

    for (const check of category.items) {
      // Small delay for visual effect
      await new Promise(r => setTimeout(r, 80));

      if (check.passed) {
        farmTerm.status(check.message, "pass");
        totalPassed++;
      } else {
        // Beads-related items are optional (warnings)
        const isOptional = check.message.includes("beads") || check.message.includes("bd ");
        if (isOptional) {
          farmTerm.status(check.message, "warn", check.details || "(optional)");
          totalWarnings++;
        } else {
          farmTerm.status(check.message, "fail", check.details || "");
          totalFailed++;
        }
      }
    }
  }

  // Summary
  farmTerm.nl();
  farmTerm.divider("═", 50);
  farmTerm.section("Diagnosis Summary", "🐮");

  farmTerm.metric("Passed", totalPassed, emojis.seedling);
  if (totalWarnings > 0) {
    farmTerm.metric("Warnings", totalWarnings, emojis.leaf);
  }
  if (totalFailed > 0) {
    farmTerm.metric("Failed", totalFailed, "🍂");
  }

  // Health Assessment
  const health =
    totalFailed === 0
      ? totalWarnings === 0
        ? "Excellent"
        : "Good"
      : totalFailed <= 2
        ? "Needs Attention"
        : "Critical";

  farmTerm.nl();
  farmTerm.divider();

  if (health === "Excellent") {
    farmTerm.success(`Health: ${health} - Your farm is thriving! 🌳`);
  } else if (health === "Good") {
    farmTerm.info(`Health: ${health} - Growing nicely! 🌿`);
  } else if (health === "Needs Attention") {
    farmTerm.warn(`Health: ${health} - Some areas need work 🌱`);
  } else {
    farmTerm.error(`Health: ${health} - Urgent care needed! 🥀`);
  }

  if (totalFailed > 0) {
    farmTerm.nl();
    farmTerm.info("Run `farmwork init` to fix missing components.");
  }

  // Health bar visualization
  const healthPercent = Math.round((totalPassed / (totalPassed + totalFailed + totalWarnings)) * 100);
  farmTerm.nl();
  farmTerm.score("Overall Health", healthPercent, 100);

  farmTerm.nl();
}
