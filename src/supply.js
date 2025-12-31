import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { farmTerm, emojis } from "./terminal.js";
import { supplies } from "./supplies/index.js";

/**
 * Interactive supply selection (multi-select)
 * Returns array of selected supply IDs
 */
export async function selectSupplies() {
  farmTerm.section("Farm Supplies", emojis.basket);
  farmTerm.info("Add capabilities to your farm with MCP-powered supplies.\n");

  const choices = Object.values(supplies).map((s) => ({
    name: `${s.emoji} ${s.name} - ${s.description}`,
    value: s.id,
    short: s.name,
  }));

  const { selectedSupplies } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedSupplies",
      message: "What supplies do you need?",
      choices,
      pageSize: 10,
    },
  ]);

  return selectedSupplies;
}

/**
 * Install a single supply
 * Returns the installed supply ID (or provider-specific ID for images)
 */
export async function installSupply(supplyId, options = {}) {
  const supply = supplies[supplyId];
  if (!supply) {
    farmTerm.error(`Unknown supply: ${supplyId}`);
    return false;
  }

  farmTerm.section(`Installing ${supply.name}`, supply.emoji);

  farmTerm.info(supply.description);
  if (supply.prerequisite) {
    farmTerm.warn(`Prerequisite: ${supply.prerequisite}`);
  }

  let apiKey = options.apiKey;
  let selectedProvider = null;

  // Handle provider selection for images
  if (supply.hasProviders && supply.providers) {
    const providerChoices = Object.entries(supply.providers).map(
      ([key, p]) => ({
        name: `${p.name}`,
        value: key,
      }),
    );

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select provider:",
        choices: providerChoices,
      },
    ]);

    selectedProvider = supply.providers[provider];

    // Get API key for selected provider
    if (!apiKey) {
      farmTerm.nl();
      farmTerm.gray(`  ${selectedProvider.apiKeyDescription}\n`);
      const { key } = await inquirer.prompt([
        {
          type: "password",
          name: "key",
          message: `${selectedProvider.apiKeyName}:`,
          mask: "*",
          validate: (input) => input.length > 0 || "API key is required",
        },
      ]);
      apiKey = key;
    }
  } else if (supply.requiresApiKey && !supply.usesOAuth) {
    // Handle API key if needed (non-provider supplies)
    if (!apiKey) {
      farmTerm.nl();
      farmTerm.gray(`  ${supply.apiKeyDescription}\n`);

      const { key } = await inquirer.prompt([
        {
          type: "password",
          name: "key",
          message: `${supply.apiKeyName}:`,
          mask: "*",
          validate: (input) => {
            if (supply.apiKeyOptional) return true;
            return input.length > 0 || "API key is required";
          },
        },
      ]);
      apiKey = key;
    }
  }

  // OAuth notice
  if (supply.usesOAuth) {
    farmTerm.nl();
    farmTerm.info(supply.oauthNote);
  }

  // Build the install command
  const installCmd = selectedProvider
    ? selectedProvider.getInstallCommand(apiKey)
    : supply.getInstallCommand(apiKey);

  // Run MCP add command
  let mcpSuccess = false;
  if (installCmd) {
    try {
      await farmTerm.spin(
        `Adding MCP: ${supply.mcp?.name || selectedProvider?.mcpName}`,
        async () => {
          execSync(installCmd, { stdio: "pipe", timeout: 30000 });
        },
      );
      mcpSuccess = true;
    } catch (error) {
      farmTerm.warn(`MCP installation needs manual setup`);
      farmTerm.gray(`  Run this command:\n`);
      farmTerm.yellow(`  ${installCmd}\n\n`);

      const { continueWithSkill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "continueWithSkill",
          message: "Create skill anyway (you can add MCP later)?",
          default: true,
        },
      ]);

      if (!continueWithSkill) {
        return false;
      }
    }
  }

  // Create skill
  const cwd = process.cwd();
  const skillDir = path.join(cwd, ".claude", "skills", supply.skill.name);

  try {
    await farmTerm.spin(`Creating skill: ${supply.skill.name}`, async () => {
      await fs.ensureDir(skillDir);

      const skillContent = `---
name: ${supply.skill.name}
description: ${supply.skill.description}
allowed-tools: ${supply.skill.allowedTools}
---

${supply.skill.workflow}
`;

      await fs.writeFile(path.join(skillDir, "SKILL.md"), skillContent);
    });
  } catch (error) {
    farmTerm.error(`Failed to create skill: ${error.message}`);
    return false;
  }

  farmTerm.status(`${supply.name} installed`, mcpSuccess ? "pass" : "warn");

  return selectedProvider ? selectedProvider.id : supply.id;
}

/**
 * Update .farmwork.json with installed supplies
 */
async function updateFarmworkConfig(cwd, installedSupplies) {
  const configPath = path.join(cwd, ".farmwork.json");

  let config = {};
  try {
    const content = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(content);
  } catch {
    config = {};
  }

  if (!config.supplies) {
    config.supplies = [];
  }

  for (const id of installedSupplies) {
    if (!config.supplies.includes(id)) {
      config.supplies.push(id);
    }
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Main supply command handler
 * @param {string} [supplyName] - Optional specific supply to install
 */
export async function supply(supplyName) {
  const cwd = process.cwd();

  // Check if farmwork is initialized
  if (!fs.existsSync(path.join(cwd, ".farmwork.json"))) {
    farmTerm.error("Farmwork not initialized. Run: farmwork init");
    process.exit(1);
  }

  farmTerm.logo(true);

  if (supplyName) {
    // Direct install: farmwork supply storybook
    const normalizedName = supplyName.toLowerCase();
    if (!supplies[normalizedName]) {
      farmTerm.error(`Unknown supply: ${supplyName}`);
      farmTerm.nl();
      farmTerm.gray("  Available supplies:\n");
      for (const s of Object.values(supplies)) {
        farmTerm.gray(`    ${s.emoji} ${s.id} - ${s.description}\n`);
      }
      process.exit(1);
    }

    const installed = await installSupply(normalizedName);
    if (installed) {
      await updateFarmworkConfig(cwd, [installed]);
      farmTerm.nl();
      farmTerm.success(`${supplies[normalizedName].name} is ready!`);
    }
  } else {
    // Interactive: farmwork supply
    const selected = await selectSupplies();

    if (selected.length === 0) {
      farmTerm.info("No supplies selected.");
      return;
    }

    const installedSupplies = [];
    for (const supplyId of selected) {
      const result = await installSupply(supplyId);
      if (result) {
        installedSupplies.push(result);
      }
    }

    if (installedSupplies.length > 0) {
      await updateFarmworkConfig(cwd, installedSupplies);

      farmTerm.nl();
      farmTerm.success(`Installed ${installedSupplies.length} supplies!`);

      // Show next steps
      farmTerm.section("Next Steps", emojis.carrot);
      farmTerm.gray("  Your new skills are ready. Try these phrases:\n\n");

      for (const id of installedSupplies) {
        const s = Object.values(supplies).find(
          (sup) =>
            sup.id === id ||
            (sup.providers &&
              Object.values(sup.providers).some((p) => p.id === id)),
        );
        if (s) {
          const trigger = s.skill.description.split(". Use when")[0];
          farmTerm.yellow(`  "${trigger}"\n`);
        }
      }
      farmTerm.nl();
    }
  }
}

/**
 * Install multiple supplies (for use during init)
 * @param {string[]} supplyIds - Array of supply IDs to install
 * @returns {string[]} Array of successfully installed supply IDs
 */
export async function installSupplies(supplyIds) {
  const installedSupplies = [];

  for (const supplyId of supplyIds) {
    const result = await installSupply(supplyId);
    if (result) {
      installedSupplies.push(result);
    }
  }

  if (installedSupplies.length > 0) {
    await updateFarmworkConfig(process.cwd(), installedSupplies);
  }

  return installedSupplies;
}
