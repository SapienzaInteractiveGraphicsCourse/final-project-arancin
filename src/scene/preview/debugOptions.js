export function createPreviewDebugOptions({
  renderer,
  lights,
  minimapPanel,
  debugStatsPanel,
  decorativePropGroups
}) {
  const state = {
    minimap: true,
    shadows: renderer.shadowMap.enabled,
    props: true,
    stats: false
  };

  return {
    state,
    applyActions(actions) {
      if (actions.toggleMinimap) {
        state.minimap = !state.minimap;
        minimapPanel.hidden = !state.minimap;
      }

      if (actions.toggleShadows) {
        state.shadows = !state.shadows;
        renderer.shadowMap.enabled = state.shadows;
        if (lights.sun) {
          lights.sun.castShadow = state.shadows;
        }
      }

      if (actions.toggleProps) {
        state.props = !state.props;
        decorativePropGroups.forEach((group) => {
          group.visible = state.props;
        });
      }

      if (actions.toggleDebugStats) {
        state.stats = !state.stats;
        debugStatsPanel.setVisible(state.stats);
      }
    },
    updateStatsPanel({ performanceState, rendererInfo }) {
      debugStatsPanel.update({
        visible: state.stats,
        performanceState,
        rendererInfo,
        options: state
      });
    },
    isMinimapVisible() {
      return state.minimap;
    }
  };
}
