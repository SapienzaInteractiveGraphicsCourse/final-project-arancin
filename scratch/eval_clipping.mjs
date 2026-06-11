import { chromium } from "playwright-core";

async function run() {
  // Use playwright-core, but let's connect/launch
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  
  console.log("Navigating to game...");
  await page.goto("http://localhost:5174/");
  
  console.log("Starting race...");
  // Find start button: the UI has a start button
  await page.click("button.start-button");
  
  console.log("Waiting 3 seconds for load...");
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Evaluating scene...");
  const results = await page.evaluate(() => {
    const scene = window.gameScene;
    const track = window.gameTrack;
    if (!scene || !track) return { error: "scene or track not found" };
    
    const centerline = track.trackInfo.centerline;
    if (!centerline) return { error: "centerline not found" };
    
    // Sample points along the centerline to find the closest distance
    const points = [];
    const steps = 1000;
    for (let i = 0; i <= steps; i++) {
      points.push(centerline[i] || centerline.getPointAt(i / steps));
    }
    
    const clipping = [];
    scene.traverse((obj) => {
      if (obj.isMesh && obj.name) {
        const name = obj.name.toLowerCase();
        // Exclude road, barriers, checkpoints, gantry, vehicles, sky, terrain/ground
        if (
          name.includes("road") ||
          name.includes("barrier") ||
          name.includes("checkpoint") ||
          name.includes("gate") ||
          name.includes("marker") ||
          name.includes("gantry") ||
          name.includes("car") ||
          name.includes("kart") ||
          name.includes("player") ||
          name.includes("vehicle") ||
          name.includes("sky") ||
          name.includes("terrain") ||
          name.includes("ground") ||
          name.includes("wheel") ||
          name.includes("chassis") ||
          obj.parent?.name?.toLowerCase().includes("vehicle") ||
          obj.parent?.name?.toLowerCase().includes("kart")
        ) {
          return;
        }
        
        // Compute world position
        const worldPos = scene.position.clone();
        obj.getWorldPosition(worldPos);
        
        let minDistance = Infinity;
        for (const pt of points) {
          const dx = worldPos.x - pt.x;
          const dz = worldPos.z - pt.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
        
        if (minDistance < 6.0) {
          clipping.push({
            name: obj.name,
            parentName: obj.parent ? obj.parent.name : null,
            position: [worldPos.x, worldPos.y, worldPos.z],
            distance: minDistance
          });
        }
      }
    });
    return { clipping };
  });
  
  console.log("RESULT_START");
  console.log(JSON.stringify(results, null, 2));
  console.log("RESULT_END");
  
  await browser.close();
}

run().catch(console.error);
