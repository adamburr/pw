// The web page's controls. build.js places this after pw.js and the word list
// (WORDS) in index.html's inline script.

const form = document.getElementById("controls");
const security = document.getElementById("security");
const method = document.getElementById("method");
const style = document.getElementById("style");
const suffix = document.getElementById("suffix");
const count = document.getElementById("count");
const strength = document.getElementById("strength");
const output = document.getElementById("output");
const hint = document.getElementById("hint");

async function copy(li) {
  const text = li.firstChild.textContent;
  try {
    await navigator.clipboard.writeText(text);
    li.classList.add("copied");
    li.lastChild.textContent = "copied";
    hint.textContent = "Copied to clipboard.";
    setTimeout(() => {
      li.classList.remove("copied");
      li.lastChild.textContent = "copy";
    }, 1200);
  } catch {
    hint.textContent = "Couldn't access the clipboard — select the text to copy it.";
  }
}

function render() {
  const options = {
    security: security.value,
    method: method.value,
    style: style.value,
    suffix: suffix.value === "on",
  };
  const info = partInfo(options.method, WORDS);
  const n = partsNeeded(SECURITY_BITS[options.security], info.bits, options.suffix);
  strength.textContent = describeStrength(n, info, options.suffix).text +
    (options.suffix ? "" : ". Some sites require a digit or symbol.");

  const total = Math.max(1, Math.min(200, parseInt(count.value, 10) || 20));
  count.value = total;
  output.replaceChildren();
  for (let i = 0; i < total; i++) {
    const li = document.createElement("li");
    li.tabIndex = 0;
    const phrase = document.createElement("span");
    phrase.textContent = generatePassphrase(options, WORDS);
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "copy";
    li.append(phrase, tag);
    li.addEventListener("click", () => copy(li));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(li); }
    });
    output.append(li);
  }
  hint.textContent = "Click a passphrase to copy it.";
}

// GitHub Pages can't send a frame-ancestors header, so refuse to run inside another site's frame.
if (window.top !== window.self) {
  document.querySelector("main").replaceChildren("Open pw directly at https://adamburr.github.io/pw/");
} else {
  form.addEventListener("submit", (e) => { e.preventDefault(); render(); });
  for (const control of [security, method, style, suffix]) control.addEventListener("change", render);
  render();
}
