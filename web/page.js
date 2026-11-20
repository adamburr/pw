// The web page's controls. build.js places this after pw.js and the word list
// (WORDS) in index.html's inline script.

const form = document.getElementById("controls");
const security = document.getElementById("security");
const method = document.getElementById("method");
const style = document.getElementById("style");
const symbol = document.getElementById("symbol");
const digits = document.getElementById("digits");
const count = document.getElementById("count");
const strength = document.getElementById("strength");
const output = document.getElementById("output");
const hint = document.getElementById("hint");

// The hint under the strength, restored after "Copied to clipboard."
let copyHint = "";

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
      if (hint.textContent === "Copied to clipboard.") hint.textContent = copyHint;
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
    symbol: symbol.checked,
    digits: digits.checked,
  };
  const plan = planPassphrase(options, WORDS);
  strength.textContent = plan.text;

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
  // Choosing among the list by preference, rather than taking the first, can
  // tell an attacker which of the total the passphrase is: up to log2(total) bits.
  const cost = Math.log2(total);
  copyHint = "Click a passphrase to copy it." + (total > 1
    ? ` Picking a favorite from these ${total} can cost up to ` +
      `${cost.toFixed(1)} bits, leaving ~${Math.round(plan.bits - cost)} bits.`
    : "");
  hint.textContent = copyHint;
}

// GitHub Pages can't send a frame-ancestors header, so refuse to run inside another site's frame.
if (window.top !== window.self) {
  document.querySelector("main").replaceChildren("Open pw directly at https://adamburr.github.io/pw/");
} else {
  form.addEventListener("submit", (e) => { e.preventDefault(); render(); });
  for (const control of [security, method, style, digits, symbol]) control.addEventListener("change", render);
  render();
}
