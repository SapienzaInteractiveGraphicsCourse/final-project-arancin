export function createDebugStatsPanel() {
  const element = document.createElement("aside");
  element.className = "debug-stats-panel";
  element.hidden = true;

  return {
    element,
    setVisible(visible) {
      element.hidden = !visible;
    },
    update({ visible, performanceState, rendererInfo, options } = {}) {
      if (!visible) {
        return;
      }

      const memory = rendererInfo?.memory ?? {};
      const render = rendererInfo?.render ?? {};
      element.innerHTML = `
        <strong>Debug Performance</strong>
        <span>F1 minimap: ${formatDebugToggle(options?.minimap)}</span>
        <span>F2 shadows: ${formatDebugToggle(options?.shadows)}</span>
        <span>F3 props: ${formatDebugToggle(options?.props)}</span>
        <span>FPS: ${formatDebugNumber(performanceState?.fps)}</span>
        <span>Draw calls: ${formatDebugNumber(render.calls)}</span>
        <span>Triangles: ${formatDebugNumber(render.triangles)}</span>
        <span>Geometries: ${formatDebugNumber(memory.geometries)}</span>
        <span>Textures: ${formatDebugNumber(memory.textures)}</span>
      `;
    },
    remove() {
      element.remove();
    }
  };
}

function formatDebugToggle(enabled) {
  return enabled ? "on" : "off";
}

function formatDebugNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return Math.round(value).toLocaleString("en-US");
}
