const DEFAULT_SIZE = 180;
const MAP_PADDING_RATIO = 0.78;

export class MinimapSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.centerline = [];
    this.bounds = null;
    this.cssWidth = DEFAULT_SIZE;
    this.cssHeight = DEFAULT_SIZE;
    this.pixelRatio = 1;
  }

  setTrack(trackInfo = {}) {
    this.centerline = Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];
    this.checkpoints = Array.isArray(trackInfo.checkpoints) ? trackInfo.checkpoints : [];
    this.bounds = normalizeBounds(trackInfo.minimapBounds, this.centerline);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width || DEFAULT_SIZE);
    this.cssHeight = Math.max(1, rect.height || DEFAULT_SIZE);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const nextWidth = Math.round(this.cssWidth * this.pixelRatio);
    const nextHeight = Math.round(this.cssHeight * this.pixelRatio);

    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }

    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  update({ playerState, aiState } = {}) {
    this.clear();
    this.drawBackground();

    if (!this.context || !this.bounds || this.centerline.length < 2) {
      this.drawFallback();
      return;
    }

    const transform = this.createTransform(playerState);
    this.drawCenterline(transform);
    this.drawCheckpoints(transform);
    this.drawAiMarker(transform, aiState);
    this.drawPlayerMarker();
    this.drawLegend();
  }

  clear() {
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }

  drawBackground() {
    const radius = Math.min(this.cssWidth, this.cssHeight) * 0.5 - 2;
    const centerX = this.cssWidth * 0.5;
    const centerY = this.cssHeight * 0.5;

    this.context.save();
    this.context.beginPath();
    this.context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.context.clip();

    const gradient = this.context.createRadialGradient(centerX, centerY, 8, centerX, centerY, radius);
    gradient.addColorStop(0, "rgba(17, 24, 39, 0.82)");
    gradient.addColorStop(1, "rgba(6, 10, 18, 0.9)");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, this.cssWidth, this.cssHeight);

    this.context.strokeStyle = "rgba(56, 189, 248, 0.12)";
    this.context.lineWidth = 1;
    for (let offset = -this.cssWidth; offset < this.cssWidth; offset += 24) {
      this.context.beginPath();
      this.context.moveTo(offset, this.cssHeight);
      this.context.lineTo(offset + this.cssWidth, 0);
      this.context.stroke();
    }

    this.context.restore();

    this.context.beginPath();
    this.context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.context.fillStyle = "rgba(8, 12, 20, 0.14)";
    this.context.fill();
    this.context.strokeStyle = "rgba(226, 232, 240, 0.72)";
    this.context.lineWidth = 2;
    this.context.stroke();
  }

  drawFallback() {
    this.context.fillStyle = "rgba(203, 213, 225, 0.72)";
    this.context.font = "700 11px system-ui, sans-serif";
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.fillText("MINIMAP", this.cssWidth * 0.5, this.cssHeight * 0.5);
  }

  createTransform(playerState = {}) {
    const focus = getFocusPoint(playerState, this.bounds);
    const heading = Number.isFinite(playerState.heading) ? playerState.heading : 0;
    const spanX = Math.max(1, this.bounds.maxX - this.bounds.minX);
    const spanZ = Math.max(1, this.bounds.maxZ - this.bounds.minZ);
    const scale = Math.min(this.cssWidth / spanX, this.cssHeight / spanZ) * MAP_PADDING_RATIO;
    const centerX = this.cssWidth * 0.5;
    const centerY = this.cssHeight * 0.5;

    return (point) => {
      const dx = point.x - focus.x;
      const dz = point.z - focus.z;
      const right = dx * Math.cos(heading) - dz * Math.sin(heading);
      const forward = dx * Math.sin(heading) + dz * Math.cos(heading);

      return {
        x: centerX - right * scale,
        y: centerY - forward * scale
      };
    };
  }

  drawCenterline(project) {
    this.context.save();
    this.clipToCircle();
    this.strokeCenterline(project, "rgba(5, 10, 20, 0.88)", 7);
    this.strokeCenterline(project, "rgba(34, 211, 238, 0.36)", 5);
    this.strokeCenterline(project, "rgba(125, 211, 252, 0.92)", 2);
    this.context.restore();
  }

  strokeCenterline(project, color, width) {
    this.context.strokeStyle = color;
    this.context.lineWidth = width;
    this.context.lineJoin = "round";
    this.context.lineCap = "round";
    this.context.beginPath();
    this.centerline.forEach((point, index) => {
      const projected = project(point);

      if (index === 0) {
        this.context.moveTo(projected.x, projected.y);
      } else {
        this.context.lineTo(projected.x, projected.y);
      }
    });

    this.context.closePath();
    this.context.stroke();
  }

  drawPlayerMarker() {
    const x = this.cssWidth * 0.5;
    const y = this.cssHeight * 0.5;

    this.context.fillStyle = "#fde047";
    this.context.strokeStyle = "rgba(8, 12, 20, 0.9)";
    this.context.lineWidth = 2.8;
    this.context.beginPath();
    this.context.moveTo(x, y - 13);
    this.context.lineTo(x + 10, y + 10);
    this.context.lineTo(x, y + 5);
    this.context.lineTo(x - 10, y + 10);
    this.context.closePath();
    this.context.fill();
    this.context.stroke();
  }

  drawCheckpoints(project) {
    this.checkpoints.forEach((checkpoint) => {
      if (!checkpoint?.position) {
        return;
      }

      const point = project(checkpoint.position);
      const isStart = checkpoint.isStartFinish || checkpoint.id === 0 || checkpoint.order === 0;

      this.context.strokeStyle = "rgba(8, 12, 20, 0.88)";
      this.context.lineWidth = 2;

      if (isStart) {
        this.context.fillStyle = "#f8fafc";
        this.context.fillRect(point.x - 7, point.y - 7, 14, 14);
        this.context.fillStyle = "#111827";
        this.context.fillRect(point.x - 7, point.y - 7, 7, 7);
        this.context.fillRect(point.x, point.y, 7, 7);
        this.context.strokeRect(point.x - 7, point.y - 7, 14, 14);
        return;
      }

      this.context.fillStyle = "rgba(56, 189, 248, 0.28)";
      this.context.beginPath();
      this.context.arc(point.x, point.y, 7, 0, Math.PI * 2);
      this.context.fill();
      this.context.fillStyle = "#67e8f9";
      this.context.beginPath();
      this.context.arc(point.x, point.y, 3.7, 0, Math.PI * 2);
      this.context.fill();
      this.context.beginPath();
      this.context.arc(point.x, point.y, 7, 0, Math.PI * 2);
      this.context.stroke();
    });
  }

  drawAiMarker(project, aiState) {
    if (!hasVisibleAiModel(aiState)) {
      return;
    }

    const point = project(aiState.position);

    this.context.fillStyle = "rgba(249, 115, 22, 0.28)";
    this.context.strokeStyle = "rgba(8, 12, 20, 0.9)";
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.arc(point.x, point.y, 9, 0, Math.PI * 2);
    this.context.fill();
    this.context.fillStyle = "#fb923c";
    this.context.beginPath();
    this.context.arc(point.x, point.y, 5.4, 0, Math.PI * 2);
    this.context.fill();
    this.context.stroke();
  }

  drawLegend() {
    const x = 14;
    const y = this.cssHeight - 22;

    this.context.fillStyle = "rgba(8, 12, 20, 0.62)";
    this.context.beginPath();
    this.context.roundRect(x - 7, y - 11, 72, 18, 6);
    this.context.fill();

    this.context.fillStyle = "#fde047";
    this.context.beginPath();
    this.context.arc(x, y - 1, 3.5, 0, Math.PI * 2);
    this.context.fill();

    this.context.fillStyle = "#fb923c";
    this.context.beginPath();
    this.context.arc(x + 25, y - 1, 3.5, 0, Math.PI * 2);
    this.context.fill();

    this.context.fillStyle = "#67e8f9";
    this.context.beginPath();
    this.context.arc(x + 50, y - 1, 3.5, 0, Math.PI * 2);
    this.context.fill();
  }

  clipToCircle() {
    const radius = Math.min(this.cssWidth, this.cssHeight) * 0.5 - 6;

    this.context.beginPath();
    this.context.arc(this.cssWidth * 0.5, this.cssHeight * 0.5, radius, 0, Math.PI * 2);
    this.context.clip();
  }
}

function getFocusPoint(playerState, bounds) {
  if (playerState?.position && Number.isFinite(playerState.position.x) && Number.isFinite(playerState.position.z)) {
    return {
      x: playerState.position.x,
      z: playerState.position.z
    };
  }

  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    z: (bounds.minZ + bounds.maxZ) * 0.5
  };
}

function normalizeBounds(bounds, points) {
  if (
    bounds &&
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minZ) &&
    Number.isFinite(bounds.maxZ)
  ) {
    return bounds;
  }

  if (!points.length) {
    return null;
  }

  return points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minZ: Math.min(result.minZ, point.z),
    maxZ: Math.max(result.maxZ, point.z)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity
  });
}

function hasVisibleAiModel(aiState) {
  if (!aiState?.position) {
    return false;
  }

  return aiState.visible === true || aiState.hasVisibleModel === true;
}
