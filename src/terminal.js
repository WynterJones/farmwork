import terminalKit from "terminal-kit";

const term = terminalKit.terminal;

// Farm-themed color palette
const colors = {
  primary: term.green,
  secondary: term.yellow,
  accent: term.cyan,
  success: term.brightGreen,
  warning: term.brightYellow,
  error: term.red,
  muted: term.gray,
  highlight: term.brightWhite,
};

// Farm emoji set - all farm-themed!
const emojis = {
  // Equipment & Buildings
  tractor: "🚜",
  barn: "🏡",
  basket: "🧺",
  // Crops & Plants
  corn: "🌽",
  wheat: "🌾",
  seedling: "🌱",
  tomato: "🍅",
  carrot: "🥕",
  potato: "🥔",
  lettuce: "🥬",
  pumpkin: "🎃",
  sunflower: "🌻",
  leaf: "🍂",
  herb: "🌿",
  wilted: "🥀",
  // Animals
  cow: "🐄",
  pig: "🐷",
  chicken: "🐔",
  rooster: "🐓",
  horse: "🐴",
  sheep: "🐑",
  dog: "🐕",
  bee: "🐝",
  owl: "🦉",
  // Weather & Nature
  sun: "☀️",
  rain: "🌧️",
  water: "💧",
  // Fruits
  apple: "🍎",
  strawberry: "🍓",
  grapes: "🍇",
  peach: "🍑",
  cherry: "🍒",
  // Misc
  arrow: "→",
};

// ASCII Art
const TRACTOR_ART = `
    _______________
   |  ___________  |
   | |  FARMWORK | |
   | |___________| |
   |_______________|
   /  🌾    🌾    🌾  \\
  / 🌽    🌽    🌽    \\
 /_____________________\\
    ()) _|__|_ (()
   (()) |    | (())
    \\/  |____|  \\/
`;

const BARN_ART = `
        /\\
       /  \\
      /    \\
     /______\\
    |  FARM  |
    |  WORK  |
    |________|
`;

const SMALL_TRACTOR = `
   __
  |==|___
 [|  |   \\
 [|__|____\\>
  ()    ()
`;

// Main logo with apple and FARMWORK text
const LOGO_ART = {
  apple: [
    "       ,--./,-.",
    "      / #      \\",
    "     |          |",
    "      \\        /",
    "       `._,._,'",
  ],
  text: [
    "███████╗ █████╗ ██████╗ ███╗   ███╗██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗",
    "██╔════╝██╔══██╗██╔══██╗████╗ ████║██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝",
    "█████╗  ███████║██████╔╝██╔████╔██║██║ █╗ ██║██║   ██║██████╔╝█████╔╝ ",
    "██╔══╝  ██╔══██║██╔══██╗██║╚██╔╝██║██║███╗██║██║   ██║██╔══██╗██╔═██╗ ",
    "██║     ██║  ██║██║  ██║██║ ╚═╝ ██║╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗",
    "╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝",
  ],
  tagline: "🌱 Agentic Development Harness",
};

// Compact logo for smaller displays
const LOGO_COMPACT = {
  fruit: "🍎",
  text: [
    " _____ _    ____  __  ____        _____  ____  _  __",
    "|  ___/ \\  |  _ \\|  \\/  \\ \\      / / _ \\|  _ \\| |/ /",
    "| |_ / _ \\ | |_) | |\\/| |\\ \\ /\\ / / | | | |_) | ' / ",
    "|  _/ ___ \\|  _ <| |  | | \\ V  V /| |_| |  _ <| . \\ ",
    "|_|/_/   \\_\\_| \\_\\_|  |_|  \\_/\\_/  \\___/|_| \\_\\_|\\_\\",
  ],
  tagline: "Agentic Development Harness",
};

// Animation frames for various states
const GROWING_FRAMES = ["🌱", "🌿", "🌳", "🌲", "🌴"];
const HARVEST_FRAMES = ["🌾", "🌾🌾", "🌾🌾🌾", "🌾🌾", "🌾"];
const TRACTOR_FRAMES = ["🚜  ", " 🚜 ", "  🚜", " 🚜 "];
const WEATHER_FRAMES = [
  "☀️ ",
  "🌤️",
  "⛅",
  "🌥️",
  "☁️",
  "🌧️",
  "⛈️",
  "🌧️",
  "☁️",
  "🌥️",
  "⛅",
  "🌤️",
];

class FarmTerminal {
  constructor() {
    this.term = term;
    this.colors = colors;
    this.emojis = emojis;
    this.spinnerInterval = null;
    this.progressBar = null;
  }

  // Clear screen
  clear() {
    term.clear();
  }

  // Move cursor
  moveTo(x, y) {
    term.moveTo(x, y);
  }

  // Print styled header
  header(text, style = "primary") {
    const width = Math.min(term.width || 60, 60);
    const padding = Math.floor((width - text.length - 4) / 2);
    const paddedText =
      " ".repeat(Math.max(0, padding)) +
      text +
      " ".repeat(Math.max(0, padding));

    term("\n");
    colors[style]("╔" + "═".repeat(width - 2) + "╗\n");
    colors[style]("║");
    term.bold.brightWhite(paddedText.slice(0, width - 4).padEnd(width - 4));
    colors[style]("║\n");
    colors[style]("╚" + "═".repeat(width - 2) + "╝\n");
    term("\n");
  }

  // Print section header
  section(text, emoji = "🌱") {
    term("\n");
    term.bold.cyan(`${emoji} ${text}\n`);
    term.gray("─".repeat(Math.min(text.length + 4, 50)) + "\n");
  }

  // Print a styled box
  box(title, content, style = "primary") {
    const width = Math.min(term.width || 50, 50);
    const lines = Array.isArray(content) ? content : [content];

    term("\n");
    colors[style]("┌" + "─".repeat(width - 2) + "┐\n");
    colors[style]("│");
    term.bold(` ${title}`.padEnd(width - 2));
    colors[style]("│\n");
    colors[style]("├" + "─".repeat(width - 2) + "┤\n");

    for (const line of lines) {
      colors[style]("│");
      term(` ${line}`.slice(0, width - 3).padEnd(width - 2));
      colors[style]("│\n");
    }

    colors[style]("└" + "─".repeat(width - 2) + "┘\n");
  }

  // Table display
  table(headers, rows) {
    const width = Math.min(term.width || 60, 60);
    const colWidth = Math.floor((width - 4) / headers.length);

    term("\n");
    term.gray("┌" + headers.map(() => "─".repeat(colWidth)).join("┬") + "┐\n");
    term.gray("│");
    for (const h of headers) {
      term.bold.white(` ${h}`.slice(0, colWidth - 1).padEnd(colWidth));
    }
    term.gray("│\n");
    term.gray("├" + headers.map(() => "─".repeat(colWidth)).join("┼") + "┤\n");

    for (const row of rows) {
      term.gray("│");
      for (let i = 0; i < headers.length; i++) {
        const cell = row[i] || "";
        term(` ${cell}`.slice(0, colWidth - 1).padEnd(colWidth));
      }
      term.gray("│\n");
    }

    term.gray("└" + headers.map(() => "─".repeat(colWidth)).join("┴") + "┘\n");
  }

  // Animated spinner with custom message
  async spin(message, asyncFn) {
    const frames = ["🌱", "🌿", "🌳", "🌲", "🌴", "🌲", "🌳", "🌿"];
    let frameIndex = 0;
    let lastLine = "";

    const interval = setInterval(() => {
      if (lastLine) {
        term.column(1);
        term.eraseLine();
      }
      lastLine = `  ${frames[frameIndex]} ${message}`;
      term.yellow(lastLine);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 120);

    try {
      const result = await asyncFn();
      clearInterval(interval);
      term.column(1);
      term.eraseLine();
      term.green(`  🌿 ${message}\n`);
      return result;
    } catch (error) {
      clearInterval(interval);
      term.column(1);
      term.eraseLine();
      term.red(`  🥀 ${message}\n`);
      throw error;
    }
  }

  // Simple spinner without async
  startSpinner(message) {
    const frames = ["🌱", "🌿", "🌳", "🌲", "🌴", "🌲", "🌳", "🌿"];
    let frameIndex = 0;

    this.spinnerInterval = setInterval(() => {
      term.column(1);
      term.eraseLine();
      term.yellow(`  ${frames[frameIndex]} ${message}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 120);
  }

  stopSpinner(message, success = true) {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    term.column(1);
    term.eraseLine();
    if (success) {
      term.green(`  🌿 ${message}\n`);
    } else {
      term.red(`  🥀 ${message}\n`);
    }
  }

  // Tractor animation (drives across screen)
  async tractorAnimation(message, durationMs = 2000) {
    const tractorFrames = ["🚜💨", "🚜 💨", "🚜  💨", "🚜   "];
    const width = Math.min(term.width || 40, 40) - 10;
    let pos = 0;
    let frameIndex = 0;
    const steps = width;
    const interval = durationMs / steps;

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        term.column(1);
        term.eraseLine();
        const spaces = " ".repeat(pos);
        term.yellow(`${spaces}${tractorFrames[frameIndex]} ${message}`);
        pos++;
        frameIndex = (frameIndex + 1) % tractorFrames.length;

        if (pos >= width) {
          clearInterval(timer);
          term.column(1);
          term.eraseLine();
          term.green(`  🚜 ${message} 🌾\n`);
          resolve();
        }
      }, interval);
    });
  }

  // Progress bar for multi-step operations
  createProgressBar(options = {}) {
    const { title = "Progress", items = 10, width = 40 } = options;

    term("\n");
    this.progressBar = term.progressBar({
      title: `  ${emojis.tractor} ${title}`,
      eta: true,
      percent: true,
      items,
      width: Math.min(width, term.width - 20),
      barStyle: term.green,
      barBracketStyle: term.white,
      percentStyle: term.yellow,
      etaStyle: term.gray,
    });

    return this.progressBar;
  }

  updateProgress(value) {
    if (this.progressBar) {
      this.progressBar.update(value);
    }
  }

  // Slow typing effect for dramatic text
  async slowType(text, speed = 50) {
    return new Promise((resolve) => {
      term.slowTyping(
        text,
        {
          flashStyle: term.brightWhite,
          delay: speed,
          style: term.green,
        },
        resolve,
      );
    });
  }

  // Status indicator (pass/fail/warn)
  status(label, state, details = "") {
    const icons = {
      pass: { icon: "🌱", color: term.green },
      fail: { icon: "🍂", color: term.red },
      warn: { icon: "🍋", color: term.yellow },
      info: { icon: "💧", color: term.cyan },
    };

    const { icon, color } = icons[state] || icons.info;
    color(`  ${icon} ${label}`);
    if (details) {
      term.gray(` ${details}`);
    }
    term("\n");
  }

  // Score display with visual bar
  score(label, value, max = 10) {
    const percentage = value / max;
    const barWidth = 20;
    const filled = Math.round(percentage * barWidth);
    const empty = barWidth - filled;

    const color =
      percentage >= 0.8
        ? term.green
        : percentage >= 0.5
          ? term.yellow
          : term.red;
    const emoji = percentage >= 0.8 ? "🌳" : percentage >= 0.5 ? "🌿" : "🌱";

    term(`  ${emoji} ${label.padEnd(18)}`);
    term.gray("[");
    color("█".repeat(filled));
    term.gray("░".repeat(empty));
    term.gray("] ");
    color(`${value}/${max}\n`);
  }

  // Metric display
  metric(label, value, icon = "🌾") {
    term(`  ${icon} ${label.padEnd(25)}`);
    term.bold.white(`${value}\n`);
  }

  // Success message with celebration
  success(message) {
    term("\n");
    term.green.bold(`  🌻 ${message} 🌻\n`);
    term("\n");
  }

  // Error message
  error(message) {
    term("\n");
    term.red.bold(`  🥀 ${message}\n`);
    term("\n");
  }

  // Warning message
  warn(message) {
    term.yellow(`  🍋 ${message}\n`);
  }

  // Info message
  info(message) {
    term.cyan(`  🐓 ${message}\n`);
  }

  // Print tractor ASCII art
  printTractor() {
    term.green(TRACTOR_ART);
  }

  // Print small tractor
  printSmallTractor() {
    term.green(SMALL_TRACTOR);
  }

  // Print barn ASCII art
  printBarn() {
    term.yellow(BARN_ART);
  }

  // Display the main FARMWORK logo with fruit
  logo(compact = false) {
    term("\n");

    if (compact || (term.width && term.width < 80)) {
      // Compact version for narrow terminals
      term.green(`  ${LOGO_COMPACT.fruit} `);
      term.bold.brightGreen("FARMWORK\n");
      term.gray(`     ${LOGO_COMPACT.tagline}\n`);
    } else {
      // Full ASCII art logo
      // Draw the apple in red
      for (const line of LOGO_ART.apple) {
        term.red(`  ${line}\n`);
      }
      term("\n");

      // Draw FARMWORK text in green gradient effect
      const greenShades = [
        term.green,
        term.brightGreen,
        term.brightGreen,
        term.green,
        term.green,
        term.dim.green,
      ];
      for (let i = 0; i < LOGO_ART.text.length; i++) {
        term("  ");
        greenShades[i](LOGO_ART.text[i] + "\n");
      }

      // Tagline
      term("\n");
      term.gray(`  ${LOGO_ART.tagline}\n`);
    }
    term("\n");
  }

  // Animated logo reveal (types out the text)
  async logoAnimated() {
    term("\n");

    // Draw apple with slight delay per line
    for (const line of LOGO_ART.apple) {
      term.red(`  ${line}\n`);
      await new Promise((r) => setTimeout(r, 50));
    }
    term("\n");

    // Reveal FARMWORK text line by line
    const greenShades = [
      term.green,
      term.brightGreen,
      term.brightGreen,
      term.green,
      term.green,
      term.dim.green,
    ];
    for (let i = 0; i < LOGO_ART.text.length; i++) {
      term("  ");
      greenShades[i](LOGO_ART.text[i] + "\n");
      await new Promise((r) => setTimeout(r, 80));
    }

    term("\n");
    term.gray(`  ${LOGO_ART.tagline}\n`);
    term("\n");
  }

  // Phrase list display
  phrases(phraseList) {
    term("\n");
    term.bold.cyan("  Quick Phrases:\n\n");

    for (const { phrase, description, emoji } of phraseList) {
      term(`  ${emoji} `);
      term.yellow.bold(phrase.padEnd(18));
      term.gray(` ${emojis.arrow} ${description}\n`);
    }
    term("\n");
  }

  // Divider line
  divider(char = "─", width = 50) {
    term.gray(char.repeat(Math.min(width, term.width || 50)) + "\n");
  }

  // Newline helper
  nl(count = 1) {
    term("\n".repeat(count));
  }

  // Raw text output
  print(text) {
    term(text);
  }

  // Colored text helpers
  green(text) {
    term.green(text);
  }
  yellow(text) {
    term.yellow(text);
  }
  red(text) {
    term.red(text);
  }
  cyan(text) {
    term.cyan(text);
  }
  gray(text) {
    term.gray(text);
  }
  white(text) {
    term.white(text);
  }
  bold(text) {
    term.bold(text);
  }

  // Wait for keypress
  async waitForKey(message = "Press any key to continue...") {
    term.gray(`\n  ${message}`);
    return new Promise((resolve) => {
      term.grabInput(true);
      term.once("key", (key) => {
        term.grabInput(false);
        term("\n");
        resolve(key);
      });
    });
  }

  // Countdown animation
  async countdown(seconds, message = "Starting in") {
    for (let i = seconds; i > 0; i--) {
      term.column(1);
      term.eraseLine();
      term.yellow(`  🐓 ${message} ${i}...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    term.column(1);
    term.eraseLine();
    term.green(`  🚜 Go!\n`);
  }

  // Analyzing animation
  async analyzing(message = "Analyzing", durationMs = 1500) {
    const dots = ["   ", ".  ", ".. ", "..."];
    let dotIndex = 0;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        term.column(1);
        term.eraseLine();
        term.cyan(`  🦉 ${message}${dots[dotIndex]}`);
        dotIndex = (dotIndex + 1) % dots.length;

        if (Date.now() - startTime >= durationMs) {
          clearInterval(interval);
          term.column(1);
          term.eraseLine();
          term.green(`  🌿 ${message} complete\n`);
          resolve();
        }
      }, 200);
    });
  }

  // Planting animation (items appearing one by one)
  async planting(items, message = "Planting") {
    term.yellow(`\n  🌱 ${message}:\n`);

    for (const item of items) {
      await new Promise((r) => setTimeout(r, 150));
      term.green(`    🌿 ${item}\n`);
    }
  }

  // Harvest animation (gathering results)
  async harvesting(items, message = "Harvesting") {
    term.yellow(`\n  🌾 ${message}:\n`);

    for (const item of items) {
      await new Promise((r) => setTimeout(r, 100));
      term.cyan(`    ${emojis.wheat} ${item}\n`);
    }
  }
}

// Export singleton instance and class
export const farmTerm = new FarmTerminal();
export {
  FarmTerminal,
  term,
  colors,
  emojis,
  TRACTOR_ART,
  BARN_ART,
  SMALL_TRACTOR,
};
