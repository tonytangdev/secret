// Runs in <head>, before the first paint. A file rather than inline: the CSP forbids inline scripts.
// 1. Theme: the toggle's saved choice, else the system's. Sets <html data-theme>.
// 2. Pages that aren't prerendered get the home page's HTML (SPA fallback), so hide it until the
//    app has rendered the right page. Keep PRERENDERED in step with src/web/seo.ts.
;(() => {
  const root = document.documentElement
  const system = matchMedia("(prefers-color-scheme: dark)")
  let saved = null
  try {
    saved = localStorage.getItem("theme")
  } catch {
    // Storage blocked: follow the system.
  }
  const follow = (dark) => {
    root.dataset.theme = dark ? "dark" : "light"
  }
  const chosen = saved === "dark" || saved === "light"
  if (chosen) root.dataset.theme = saved
  else follow(system.matches)
  // Until someone picks a theme, keep following the system.
  system.addEventListener("change", (event) => {
    if (!chosen && !("themeChosen" in root.dataset)) follow(event.matches)
  })

  const PRERENDERED = ["/", "/how-it-works"]
  const path = location.pathname.replace(/(.)\/$/, "$1")
  if (!PRERENDERED.includes(path)) root.classList.add("app-pending")
})()
