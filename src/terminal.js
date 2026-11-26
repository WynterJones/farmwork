import chalk from "chalk";

export const emojis = {
  wheat: "🌾",
  seedling: "🌱",
  tractor: "🚜",
  check: "✓",
  cross: "✗",
  warn: "!",
  arrow: "→",
};

export const farmTerm = {
  banner(version) {
    console.log(
      chalk.hex("#d4a843")(`\n  ❖ FARMWORK`) + chalk.gray(` v${version} · Agent-First Standards & MCP\n`),
    );
  },

  header(title) {
    console.log(chalk.bold.hex("#d4a843")(`── ${title} ${"─".repeat(Math.max(4, 48 - title.length))}`));
  },

  section(title, icon = "") {
    console.log(`\n${icon ? `${icon} ` : ""}${chalk.bold.white(title)}`);
  },

  info(msg) {
    console.log(chalk.cyan(`  ${msg}`));
  },

  success(msg) {
    console.log(chalk.green(`  ${emojis.check} ${msg}`));
  },

  warn(msg) {
    console.log(chalk.yellow(`  ${emojis.warn} ${msg}`));
  },

  error(msg) {
    console.error(chalk.red(`  ${emojis.cross} ${msg}`));
  },

  dim(msg) {
    console.log(chalk.gray(`  ${msg}`));
  },

  kv(label, value) {
    console.log(`  ${chalk.gray(label.padEnd(18))} ${chalk.white(value)}`);
  },

  status(label, passed, detail = "") {
    const icon = passed ? chalk.green(emojis.check) : chalk.red(emojis.cross);
    const suffix = detail ? chalk.gray(` — ${detail}`) : "";
    console.log(`  ${icon} ${label}${suffix}`);
  },

  scoreBar(label, value, max = 10) {
    const ratio = Math.max(0, Math.min(1, value / max));
    const filled = Math.round(ratio * 20);
    const bar =
      chalk.hex(ratio >= 0.8 ? "#7fa66b" : ratio >= 0.6 ? "#d4a843" : "#d96243")("█".repeat(filled)) +
      chalk.gray("░".repeat(20 - filled));
    console.log(`  ${chalk.white(label.padEnd(18))} ${bar}  ${chalk.bold(`${value}/${max}`)}`);
  },
};
