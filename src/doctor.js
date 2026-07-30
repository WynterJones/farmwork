import fs from "fs-extra";
import path from "path";
import { farmTerm, emojis } from "./terminal.js";

function checkExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  return {
    passed: exists,
    message: description,
    details: exists ? null : `Missing: ${filePath}`,
  };
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
  const requiredSections = ["Slash Commands", "Project Configuration"];

  const missing = requiredSections.filter((section) => !content.includes(section));

  return {
    passed: missing.length === 0,
    message: "CLAUDE.md has required sections",
    details: missing.length > 0 ? `Missing sections: ${missing.join(", ")}` : null,
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
    details: missing.length > 0 ? `Missing fields: ${missing.join(", ")}` : null,
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
  checks[0].items.push(checkExists(path.join(cwd, "CLAUDE.md"), "CLAUDE.md exists"));
  checks[0].items.push(checkExists(path.join(cwd, ".claude"), ".claude/ directory exists"));
  checks[0].items.push(checkClaudeMdSections(path.join(cwd, "CLAUDE.md")));

  // Claude Configuration
  checks.push({ category: "Claude Configuration", emoji: "🐴", items: [] });
  checks[1].items.push(
    checkDirectoryNotEmpty(path.join(cwd, ".claude", "agents"), "Has agents defined"),
  );
  checks[1].items.push(
    checkDirectoryNotEmpty(path.join(cwd, ".claude", "commands"), "Has commands defined"),
  );

  // Audit System
  checks.push({ category: "Audit System", emoji: "🦉", items: [] });
  checks[2].items.push(checkExists(path.join(cwd, "_AUDIT"), "_AUDIT/ directory exists"));
  checks[2].items.push(
    checkExists(path.join(cwd, "_AUDIT", "FARMHOUSE.md"), "FARMHOUSE.md exists"),
  );
  checks[2].items.push(checkFarmhouseFormat(path.join(cwd, "_AUDIT", "FARMHOUSE.md")));
  checks[2].items.push(checkExists(path.join(cwd, "_AUDIT", "GARDEN.md"), "GARDEN.md exists"));
  checks[2].items.push(checkExists(path.join(cwd, "_AUDIT", "COMPOST.md"), "COMPOST.md exists"));
  checks[2].items.push(checkExists(path.join(cwd, "_PLANS"), "_PLANS/ directory exists"));

  // Security
  checks.push({ category: "Security", emoji: "🐕", items: [] });
  checks[3].items.push(checkGitignore(cwd));

  let totalPassed = 0;
  let totalFailed = 0;

  for (const category of checks) {
    farmTerm.section(category.category, category.emoji);

    for (const check of category.items) {
      await new Promise((r) => setTimeout(r, 80));

      if (check.passed) {
        farmTerm.status(check.message, "pass");
        totalPassed++;
      } else {
        farmTerm.status(check.message, "fail", check.details || "");
        totalFailed++;
      }
    }
  }

  // Summary
  farmTerm.nl();
  farmTerm.divider("═", 50);
  farmTerm.section("Diagnosis Summary", "🐮");

  farmTerm.metric("Passed", totalPassed, emojis.seedling);
  if (totalFailed > 0) {
    farmTerm.metric("Failed", totalFailed, "🍂");
  }

  const health = totalFailed === 0 ? "Excellent" : totalFailed <= 2 ? "Needs Attention" : "Critical";

  farmTerm.nl();
  farmTerm.divider();

  if (health === "Excellent") {
    farmTerm.success(`Health: ${health} - Your farm is thriving! 🌳`);
  } else if (health === "Needs Attention") {
    farmTerm.warn(`Health: ${health} - Some areas need work 🌱`);
  } else {
    farmTerm.error(`Health: ${health} - Urgent care needed! 🥀`);
  }

  if (totalFailed > 0) {
    farmTerm.nl();
    farmTerm.info("Run `farmwork init` to fix missing components.");
  }

  const healthPercent = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);
  farmTerm.nl();
  farmTerm.score("Overall Health", healthPercent, 100);

  farmTerm.nl();
}
