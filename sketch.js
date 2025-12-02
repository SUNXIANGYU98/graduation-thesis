/*
  VS Code Local Version - Final Ultimate Edition (Full Fill Fix)
  CN: 
  1. AR 面具模式 (同步/多人)
  2. Logo 生成器 Pro: 
     - 修复：SHARP 和 CURVED 模式现在会 100% 填满 LOGO 区域，无缝隙
     - 算法升级：更具设计感的尖锐切片和流体堆叠
*/

// ================= 1. 路径配置 / Configurazione Percorso =================
const pathConfig = {
  ear: "e",
  mouth: "m",
  nose: "n",
  eyes: "y",
  beard: "b",
  ornaments: "o",
};

const IMAGE_COUNT = 6;
// ========================================================================

const CROP_PIXELS = 25;

// === LOGO 生成器颜色配置 ===
const BRAND_PALETTE = [
  "#E6331A", // 🔴 朱砂 (Cinnabar)
  "#1C7A5E", // 🟢 石绿 (Mineral Green)
  "#F28C28", // 🟠 雄黄 (Realgar)
  "#0F0F0F", // 🌑 墨色 (Ink)
  "#DCDDE1", // 🌫️ 蟹壳青 (Pale Grey)
];

// Logo 生成器配置状态
let logoGenConfig = {
  subMode: "GRID", // 'GRID', 'SHARP', 'CURVED'
  // 颜色权重 (0-10)
  colorWeights: [5, 5, 5, 5, 5],
  // 形状权重 (用于GRID模式: Rect, Circle, Triangle)
  shapeWeights: [5, 5, 5],
};
// 存储 UI 元素以便清除
let logoUIElements = [];

let assets = {
  ear: [],
  mouth: [],
  nose: [],
  eyes: [],
  beard: [],
  ornaments: [],
};

let logoImage;
let logoGraphics;

let currentIndices = {
  ear: 0,
  mouth: 0,
  nose: 0,
  eyes: 0,
  beard: 0,
  ornaments: 0,
};

let partsList = [
  { key: "ear", label: "Ear" },
  { key: "mouth", label: "Mouth" },
  { key: "nose", label: "Nose" },
  { key: "eyes", label: "Eyes" },
  { key: "beard", label: "Beard" },
  { key: "ornaments", label: "Ornaments" },
];

let mode = "EDITOR";
let arMode = "SYNC";

let video;
let faceMesh;
let faces = [];
let modelLoaded = false;
let mainCanvas;
let maskLayer;
let displaySize = 800;
const DESIGN_SIZE = 1000;
let isMobile = false;
let mainContainer;

let faceConfigMap = {};

let bgIndex = 0;
const bgOptions = [
  "Original",
  "Real+White",
  "Real+Grey",
  "Real+Black",
  "Pure White",
  "Pure Grey",
  "Pure Black",
];

const silhouetteIndices = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

function preload() {
  loadGroup(pathConfig.ear, assets.ear);
  loadGroup(pathConfig.mouth, assets.mouth);
  loadGroup(pathConfig.nose, assets.nose);
  loadGroup(pathConfig.eyes, assets.eyes);
  loadGroup(pathConfig.beard, assets.beard);
  loadGroup(pathConfig.ornaments, assets.ornaments);
  logoImage = loadImage("LOGO.png");
}

function loadGroup(prefix, targetArray) {
  for (let i = 1; i <= IMAGE_COUNT; i++) {
    targetArray.push(loadImage(prefix + i + ".png"));
  }
}

function setup() {
  isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  if (windowWidth < 900) isMobile = true;

  mainContainer = createDiv();
  mainContainer.id("main-container");
  mainContainer.style("display", "flex");
  mainContainer.style("justify-content", "center");
  mainContainer.style("align-items", "center");
  mainContainer.style("min-height", "100vh");
  mainContainer.style("gap", "40px");
  if (isMobile) {
    mainContainer.style("flex-direction", "column");
    mainContainer.style("padding", "20px 0");
    displaySize = windowWidth * 0.95;
  } else {
    mainContainer.style("flex-direction", "row");
    displaySize = min(windowWidth * 0.5, windowHeight * 0.8);
  }

  mainCanvas = createCanvas(displaySize, displaySize);
  mainCanvas.parent(mainContainer);
  mainCanvas.style("border-radius", "20px");

  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke();

  logoGraphics = createGraphics(DESIGN_SIZE, DESIGN_SIZE);

  noLoop();
  imageMode(CENTER);
  angleMode(DEGREES);

  createEditorUI();

  let constraints = isMobile
    ? { video: { facingMode: "user" }, audio: false }
    : VIDEO;
  video = createCapture(constraints);
  video.hide();

  console.log("Starting FaceMesh...");
  let options = {
    maxFaces: 10,
    refineLandmarks: true,
    flipHorizontal: false,
    enableTracking: true,
  };
  faceMesh = ml5.faceMesh(options, () => {
    console.log("✅ Model Loaded!");
    modelLoaded = true;
    updateStatusText();
    redraw();
  });
}

function draw() {
  drawingContext.shadowBlur = 0;
  noStroke();
  strokeWeight(0);

  if (mode === "EDITOR") {
    drawEditor();
  } else if (mode === "WEBCAM") {
    drawWebcam();
  } else if (mode === "LOGO_GEN") {
    drawLogoGenMode();
  }
}

// ---------------- 模式 1: 编辑器 ----------------
function drawEditor() {
  clear();
  background(255);
  push();
  noStroke();
  translate(width / 2, height / 2);
  let s = width / DESIGN_SIZE;
  scale(s);
  drawStaticPart(assets.ear, currentIndices.ear);
  drawStaticPart(assets.mouth, currentIndices.mouth);
  drawStaticPart(assets.nose, currentIndices.nose);
  drawStaticPart(assets.eyes, currentIndices.eyes);
  drawStaticPart(assets.beard, currentIndices.beard);
  drawStaticPart(assets.ornaments, currentIndices.ornaments);
  pop();
}
function drawStaticPart(imgArray, index) {
  if (imgArray.length > 0 && imgArray[index]) {
    let img = imgArray[index];
    image(
      img,
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE,
      CROP_PIXELS,
      CROP_PIXELS,
      img.width - CROP_PIXELS * 2,
      img.height - CROP_PIXELS * 2
    );
  }
}

// ---------------- 模式 2: AR ----------------
function drawWebcam() {
  background(0);
  noStroke();
  if (!video || video.width === 0) return;
  let scaleW = width / video.width;
  let scaleH = height / video.height;
  let scaleFactor = max(scaleW, scaleH);
  let finalW = video.width * scaleFactor;
  let finalH = video.height * scaleFactor;

  push();
  translate(width / 2, height / 2);
  scale(-1, 1);
  if (bgIndex >= 4) image(video, 0, 0, 1, 1);
  else image(video, 0, 0, finalW, finalH);

  if (bgIndex > 0) {
    maskLayer.clear();
    let bgColor =
      bgIndex === 1 || bgIndex === 4
        ? color(255)
        : bgIndex === 2 || bgIndex === 5
        ? color(128)
        : color(0);
    maskLayer.fill(bgColor);
    maskLayer.rect(0, 0, width, height);
    if (bgIndex >= 1 && bgIndex <= 3 && faces.length > 0) {
      maskLayer.erase();
      for (let i = 0; i < faces.length; i++) {
        let face = faces[i];
        let kp = face.keypoints;
        let ox = (width - finalW) / 2;
        let oy = (height - finalH) / 2;
        maskLayer.beginShape();
        for (let idx of silhouetteIndices) {
          let p = kp[idx];
          let x = (video.width - p.x) * scaleFactor + ox;
          let y = p.y * scaleFactor + oy;
          maskLayer.vertex(x, y);
        }
        maskLayer.endShape(CLOSE);
      }
      maskLayer.noErase();
    }
    image(maskLayer, 0, 0, width, height);
  }

  if (bgIndex >= 4) {
    fill(bgIndex === 4 ? 255 : bgIndex === 5 ? 128 : 0);
    rect(0, 0, width, height);
  }

  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let indicesToUse =
      arMode === "SYNC"
        ? currentIndices
        : faceConfigMap[face.trackId || face.id || i] ||
          (faceConfigMap[face.trackId || face.id || i] =
            generateRandomIndices());
    drawFaceMask(
      faces[i],
      scaleFactor,
      video.width,
      video.height,
      indicesToUse
    );
  }
  pop();
  if (faceMesh && faces.length === 0 && frameCount % 30 === 0)
    faceMesh.detectStart(video, (results) => (faces = results));
  if (!modelLoaded) {
    fill(255, 0, 0);
    textAlign(CENTER);
    text("Loading...", 0, 0);
  }
}

// =================================================================
// ---------------- 模式 3: Logo 生成器 Pro (逻辑核心) ----------------
// =================================================================

function startLogoGenMode() {
  mode = "LOGO_GEN";
  let btns = selectAll("button", "#editor-btn-group");
  btns.forEach((b) => b.hide());
  select("#part-list-container").hide();

  createLogoUI();
  generateLogoArt();
  loop();
}

function stopLogoGenMode() {
  mode = "EDITOR";
  noLoop();
  let btns = selectAll("button", "#editor-btn-group");
  btns.forEach((b) => b.show());
  select("#part-list-container").show();

  if (select("#logo-controls")) select("#logo-controls").remove();
  logoUIElements.forEach((el) => el.remove());
  logoUIElements = [];

  redraw();
}

// 辅助：加权随机选择器
function getWeightedColor() {
  let totalWeight = logoGenConfig.colorWeights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return BRAND_PALETTE[0]; // 防御
  let randomVal = random(totalWeight);
  let sum = 0;
  for (let i = 0; i < BRAND_PALETTE.length; i++) {
    sum += logoGenConfig.colorWeights[i];
    if (randomVal <= sum) return BRAND_PALETTE[i];
  }
  return BRAND_PALETTE[0];
}

function getWeightedShape() {
  let totalWeight = logoGenConfig.shapeWeights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  let randomVal = random(totalWeight);
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += logoGenConfig.shapeWeights[i];
    if (randomVal <= sum) return i;
  }
  return 0;
}

// --- 核心生成算法 ---
function generateLogoArt() {
  logoGraphics.clear();
  logoGraphics.noStroke();

  // 【重要】步骤1：先用一个加权颜色完全填满画布
  // 这保证了 LOGO 形状内绝对不会有透明缝隙
  logoGraphics.background(getWeightedColor());

  if (logoGenConfig.subMode === "GRID") {
    // --- 1. 网格模式 (马赛克) ---
    // 在底色上绘制网格，覆盖
    let tileSize = 50;
    for (let x = 0; x < DESIGN_SIZE; x += tileSize) {
      for (let y = 0; y < DESIGN_SIZE; y += tileSize) {
        let col = getWeightedColor();
        logoGraphics.fill(col);

        let shapeType = getWeightedShape();
        if (shapeType === 0) {
          // Rect (Full Block)
          logoGraphics.rect(x, y, tileSize, tileSize);
        } else if (shapeType === 1) {
          // Circle
          logoGraphics.circle(
            x + tileSize / 2,
            y + tileSize / 2,
            tileSize * 0.9
          );
        } else {
          // Triangle
          logoGraphics.push();
          logoGraphics.translate(x + tileSize / 2, y + tileSize / 2);
          logoGraphics.rotate(floor(random(4)) * 90);
          logoGraphics.triangle(
            -tileSize / 2,
            -tileSize / 2,
            tileSize / 2,
            -tileSize / 2,
            -tileSize / 2,
            tileSize / 2
          );
          logoGraphics.pop();
        }
      }
    }
  } else if (logoGenConfig.subMode === "SHARP") {
    // --- 2. 尖锐模式 (碎片) ---
    // 覆盖大量巨大的几何形状，确保填满
    let count = 100; // 数量够多
    for (let i = 0; i < count; i++) {
      logoGraphics.fill(getWeightedColor());

      // 绘制“切片” (Triangles / Quads)
      // 坐标范围扩大到负值和超过画板，确保边缘也被切到
      let x1 = random(-200, DESIGN_SIZE + 200);
      let y1 = random(-200, DESIGN_SIZE + 200);
      let size = random(300, 1000); // 巨大的尺寸

      logoGraphics.beginShape();
      logoGraphics.vertex(x1, y1);
      logoGraphics.vertex(x1 + random(-size, size), y1 + random(-size, size));
      logoGraphics.vertex(x1 + random(-size, size), y1 + random(-size, size));
      // 50% 概率画四边形，增加复杂度
      if (random(1) > 0.5)
        logoGraphics.vertex(x1 + random(-size, size), y1 + random(-size, size));
      logoGraphics.endShape(CLOSE);
    }
  } else if (logoGenConfig.subMode === "CURVED") {
    // --- 3. 曲线模式 (流体) ---
    // 覆盖大量巨大的圆形和斑点
    let count = 80;
    for (let i = 0; i < count; i++) {
      logoGraphics.fill(getWeightedColor());

      let cx = random(DESIGN_SIZE);
      let cy = random(DESIGN_SIZE);
      let w = random(200, 800); // 巨大的圆
      let h = random(200, 800);

      // 绘制圆或椭圆
      logoGraphics.ellipse(cx, cy, w, h);

      // 偶尔绘制变形的波浪块
      if (i % 5 === 0) {
        logoGraphics.beginShape();
        for (let j = 0; j < 5; j++) {
          logoGraphics.curveVertex(
            random(-200, DESIGN_SIZE + 200),
            random(-200, DESIGN_SIZE + 200)
          );
        }
        logoGraphics.endShape(CLOSE);
      }
    }
  }

  // 应用遮罩
  let maskedLogo = logoGraphics.get();
  maskedLogo.mask(logoImage);
  logoGraphics.clear();
  logoGraphics.image(maskedLogo, 0, 0, DESIGN_SIZE, DESIGN_SIZE);
}

function createLogoUI() {
  let container = createDiv();
  container.id("logo-controls");
  controlPanel.elt.insertBefore(container.elt, controlPanel.elt.firstChild);
  container.style("width", "100%");
  container.style("background", "#f5f5f5");
  container.style("padding", "15px");
  container.style("border-radius", "15px");
  container.style("max-height", "80vh");
  container.style("overflow-y", "auto");

  let btnRow = createDiv();
  btnRow.parent(container);
  btnRow.style("display", "flex");
  btnRow.style("gap", "10px");
  btnRow.style("margin-bottom", "15px");

  let btnBack = createButton("⬅ Back");
  styleMainButton(btnBack, "#f44336");
  btnBack.parent(btnRow);
  btnBack.style("flex", "1");
  btnBack.mousePressed(stopLogoGenMode);

  let btnDown = createButton("💾 PNG");
  styleMainButton(btnDown, "#1C7A5E");
  btnDown.parent(btnRow);
  btnDown.style("flex", "1");
  btnDown.mousePressed(() => save(logoGraphics, "brand_logo_pro.png"));

  createSectionTitle("1. Pattern Mode", container);
  let modeRow = createDiv();
  modeRow.parent(container);
  modeRow.style("display", "flex");
  modeRow.style("gap", "5px");
  modeRow.style("margin-bottom", "15px");

  let modes = ["GRID", "SHARP", "CURVED"];
  modes.forEach((m) => {
    let b = createButton(m);
    b.parent(modeRow);
    b.style("flex", "1");
    b.style("padding", "8px");
    b.style("border", "1px solid #999");
    b.style("background", logoGenConfig.subMode === m ? "#333" : "#fff");
    b.style("color", logoGenConfig.subMode === m ? "#fff" : "#333");
    b.style("cursor", "pointer");
    b.mousePressed(() => {
      logoGenConfig.subMode = m;
      let allBtns = modeRow.elt.querySelectorAll("button");
      allBtns.forEach((btn) => {
        btn.style.background = "#fff";
        btn.style.color = "#333";
      });
      b.style("background", "#333");
      b.style("color", "#fff");
      generateLogoArt();
    });
    logoUIElements.push(b);
  });

  createSectionTitle("2. Color Ratios", container);
  BRAND_PALETTE.forEach((colorHex, idx) => {
    let row = createDiv();
    row.parent(container);
    row.style("display: flex; align-items: center; margin-bottom: 5px;");
    let dot = createDiv();
    dot.parent(row);
    dot.style(
      `width:20px; height:20px; background:${colorHex}; border-radius:50%; margin-right:10px; border:1px solid #ddd;`
    );
    let slider = createSlider(0, 10, logoGenConfig.colorWeights[idx], 1);
    slider.parent(row);
    slider.style("flex-grow", "1");
    slider.input(() => {
      logoGenConfig.colorWeights[idx] = slider.value();
      generateLogoArt();
    });
    logoUIElements.push(slider);
  });

  createSectionTitle("3. Shape Ratios (Grid Only)", container);
  const shapeLabels = ["◼️ Rect", "● Circle", "▲ Triangle"];
  shapeLabels.forEach((label, idx) => {
    let row = createDiv();
    row.parent(container);
    row.style("display: flex; align-items: center; margin-bottom: 5px;");
    let txt = createSpan(label);
    txt.parent(row);
    txt.style("width", "80px; font-size:12px; font-weight:bold;");
    let slider = createSlider(0, 10, logoGenConfig.shapeWeights[idx], 1);
    slider.parent(row);
    slider.style("flex-grow", "1");
    slider.input(() => {
      logoGenConfig.shapeWeights[idx] = slider.value();
      if (logoGenConfig.subMode === "GRID") generateLogoArt();
    });
    logoUIElements.push(slider);
  });

  let btnRegen = createButton("🎲 REGENERATE");
  styleMainButton(btnRegen, "#FF9800");
  btnRegen.parent(container);
  btnRegen.style("width", "100%");
  btnRegen.style("margin-top", "15px");
  btnRegen.mousePressed(generateLogoArt);
  logoUIElements.push(btnRegen);
}

function createSectionTitle(textStr, parent) {
  let t = createP(textStr);
  t.parent(parent);
  t.style(
    "font-weight:bold; font-size:14px; margin: 10px 0 5px 0; border-bottom:1px solid #ddd;"
  );
  logoUIElements.push(t);
}

function drawLogoGenMode() {
  background(240);
  fill(220);
  let g = 20;
  for (let x = 0; x < width; x += g)
    for (let y = 0; y < height; y += g)
      if ((x / g + y / g) % 2 == 0) rect(x, y, g, g);

  push();
  imageMode(CENTER);
  translate(width / 2, height / 2);
  let sc = (min(width, height) / DESIGN_SIZE) * 0.85;
  scale(sc);
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = "rgba(0,0,0,0.2)";
  image(logoGraphics, 0, 0);
  pop();
}

// ---------------- 辅助函数 ----------------
function generateRandomIndices() {
  return {
    ear: floor(random(assets.ear.length)),
    mouth: floor(random(assets.mouth.length)),
    nose: floor(random(assets.nose.length)),
    eyes: floor(random(assets.eyes.length)),
    beard: floor(random(assets.beard.length)),
    ornaments: floor(random(assets.ornaments.length)),
  };
}

// ... (drawFaceMask, drawPart, styleMainButton 等函数保持不变) ...
function drawFaceMask(face, s, vW, vH, indices) {
  let kp = face.keypoints;
  let ox = -vW / 2;
  let oy = -vH / 2;
  function getP(index) {
    return createVector((kp[index].x + ox) * s, (kp[index].y + oy) * s);
  }
  let noseTip = getP(4);
  let leftCheek = getP(234);
  let rightCheek = getP(454);
  let leftEye = getP(33);
  let rightEye = getP(263);
  let angle = atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  let faceWidth = p5.Vector.dist(leftCheek, rightCheek);
  let maskScale = (faceWidth * 2.2) / DESIGN_SIZE;
  push();
  noStroke();
  drawingContext.shadowBlur = 0;
  translate(noseTip.x, noseTip.y);
  rotate(angle);
  scale(maskScale);
  drawPart(assets.ear, indices.ear);
  drawPart(assets.beard, indices.beard);
  if (assets.nose[indices.nose]) {
    let img = assets.nose[indices.nose];
    image(
      img,
      0,
      -50,
      DESIGN_SIZE,
      DESIGN_SIZE,
      CROP_PIXELS,
      CROP_PIXELS,
      img.width - CROP_PIXELS * 2,
      img.height - CROP_PIXELS * 2
    );
  }
  drawPart(assets.ornaments, indices.ornaments);
  let topLip = getP(13);
  let botLip = getP(14);
  let mouthOpenDist = p5.Vector.dist(topLip, botLip);
  let relativeOpen = mouthOpenDist / maskScale;
  let mouthStretch = map(relativeOpen, 0, 100, 0.8, 2.5, true);
  if (assets.mouth[indices.mouth]) {
    let img = assets.mouth[indices.mouth];
    image(
      img,
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE * mouthStretch,
      CROP_PIXELS,
      CROP_PIXELS,
      img.width - CROP_PIXELS * 2,
      img.height - CROP_PIXELS * 2
    );
  }
  let leftEyeTop = getP(159);
  let leftEyeBot = getP(145);
  let eyeOpenDist = p5.Vector.dist(leftEyeTop, leftEyeBot);
  let relativeEyeOpen = eyeOpenDist / maskScale;
  let eyeSquash = map(relativeEyeOpen, 0, 20, 0.1, 1.0, true);
  if (assets.eyes[indices.eyes]) {
    let img = assets.eyes[indices.eyes];
    image(
      img,
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE * eyeSquash,
      CROP_PIXELS,
      CROP_PIXELS,
      img.width - CROP_PIXELS * 2,
      img.height - CROP_PIXELS * 2
    );
  }
  pop();
}

function drawPart(imgArray, index) {
  if (imgArray.length > 0 && imgArray[index]) {
    let img = imgArray[index];
    noStroke();
    image(
      img,
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE,
      CROP_PIXELS,
      CROP_PIXELS,
      img.width - CROP_PIXELS * 2,
      img.height - CROP_PIXELS * 2
    );
  }
}

// ---------------- UI & DOM ----------------
let controlPanel,
  btnStartAR,
  btnBack,
  btnSnap,
  btnSwitchMode,
  bgControlDiv,
  bgLabel,
  statusP;

function createEditorUI() {
  if (controlPanel) controlPanel.remove();
  controlPanel = createDiv();
  controlPanel.parent(mainContainer);
  if (isMobile) {
    controlPanel.style("width", "95%");
    controlPanel.style("text-align", "center");
  } else {
    controlPanel.style("width", "320px");
    controlPanel.style("height", displaySize + "px");
    controlPanel.style("overflow-y", "auto");
    controlPanel.style("text-align", "left");
    controlPanel.style("padding", "25px");
    controlPanel.style("background", "white");
    controlPanel.style("border-radius", "20px");
    controlPanel.style("box-shadow", "0 20px 50px rgba(0,0,0,0.05)");
    controlPanel.style("display", "flex");
    controlPanel.style("flex-direction", "column");
    controlPanel.style("justify-content", "flex-start");
  }
  let btnContainer = createDiv();
  btnContainer.id("editor-btn-group");
  btnContainer.parent(controlPanel);
  btnContainer.style("display", "flex");
  btnContainer.style("gap", "10px");
  btnContainer.style("margin-bottom", "30px");
  btnContainer.style("flex-wrap", "wrap");

  btnStartAR = createButton("📸 Start Camera");
  styleMainButton(btnStartAR, "#2196F3");
  btnStartAR.style("flex-grow", "1");
  btnStartAR.parent(btnContainer);
  btnStartAR.mousePressed(startWebcamMode);

  let btnRand = createButton("🎲 Face");
  styleMainButton(btnRand, "#FF9800");
  btnRand.parent(btnContainer);
  btnRand.mousePressed(() => {
    currentIndices = generateRandomIndices();
    redraw();
  });

  let btnSave = createButton("💾 Save");
  styleMainButton(btnSave, "#4CAF50");
  btnSave.parent(btnContainer);
  btnSave.mousePressed(() => saveCanvas("my_face_design", "png"));

  // 新增：进入 Logo 生成器模式的按钮
  let btnLogoMode = createButton("🎨 Logo Gen");
  styleMainButton(btnLogoMode, "#000000");
  btnLogoMode.parent(btnContainer);
  btnLogoMode.style("width", "100%");
  btnLogoMode.mousePressed(startLogoGenMode);

  let listDiv = createDiv();
  listDiv.id("part-list-container");
  listDiv.parent(controlPanel);
  listDiv.style("width", "100%");
  for (let part of partsList) createPartRow(part, listDiv);
  let spacer = createDiv();
  spacer.parent(controlPanel);
  spacer.style("flex-grow", "1");
  statusP = createP("🔴 AI Loading...");
  statusP.parent(controlPanel);
  statusP.style("font-family", "sans-serif");
  statusP.style("font-size", "16px");
  statusP.style("font-weight", "bold");
  statusP.style("color", "red");
  statusP.style("text-align", "center");
  statusP.style("width", "100%");
  statusP.style("margin", "20px 0");
  let logoImg = createImg("LOGO.png", "Brand Logo");
  logoImg.parent(controlPanel);
  logoImg.style("width", "100px");
  logoImg.style("height", "auto");
  logoImg.style("display", "block");
  logoImg.style("margin", "0 auto 10px auto");
  logoImg.style("opacity", "0.8");
  let signature = createP("SUN XIANGYU");
  signature.parent(controlPanel);
  signature.style("font-family", "sans-serif");
  signature.style("font-size", "14px");
  signature.style("font-weight", "bold");
  signature.style("color", "#888");
  signature.style("text-align", "center");
  signature.style("margin", "0");
}

function updateStatusText() {
  if (statusP) {
    if (modelLoaded) {
      statusP.html("🟢 AI Ready!");
      statusP.style("color", "#009900");
    } else {
      statusP.html("🔴 AI Loading...");
      statusP.style("color", "red");
    }
  }
}
function startWebcamMode() {
  if (!modelLoaded) {
    alert("AI Model is still loading...");
    return;
  }
  mode = "WEBCAM";
  arMode = "SYNC";
  maskLayer.clear();
  maskLayer.noStroke();
  faceMesh.detectStart(video, (results) => (faces = results));
  let btns = selectAll("button", "#editor-btn-group");
  btns.forEach((b) => b.hide());
  if (!btnBack) {
    let arBtnContainer = createDiv();
    arBtnContainer.id("ar-btns");
    controlPanel.elt.insertBefore(
      arBtnContainer.elt,
      controlPanel.elt.firstChild
    );
    arBtnContainer.style("display", "flex");
    arBtnContainer.style("gap", "10px");
    arBtnContainer.style("margin-bottom", "20px");
    arBtnContainer.style("flex-wrap", "wrap");
    btnBack = createButton("⬅ Back");
    styleMainButton(btnBack, "#f44336");
    btnBack.parent(arBtnContainer);
    btnBack.style("flex-grow", "1");
    btnBack.mousePressed(stopWebcamMode);
    btnSwitchMode = createButton("🔄 Mode: SYNC");
    styleMainButton(btnSwitchMode, "#9C27B0");
    btnSwitchMode.parent(arBtnContainer);
    btnSwitchMode.style("flex-grow", "2");
    btnSwitchMode.mousePressed(toggleArMode);
    btnSnap = createButton("📸 Snap");
    styleMainButton(btnSnap, "#E91E63");
    btnSnap.parent(arBtnContainer);
    btnSnap.style("flex-grow", "1");
    btnSnap.mousePressed(() => saveCanvas("ar_snapshot", "png"));

    let btnArRand = createButton("🎲");
    styleMainButton(btnArRand, "#FF9800");
    btnArRand.parent(arBtnContainer);
    btnArRand.mousePressed(() => {
      if (arMode === "MULTI") faceConfigMap = {};
      else currentIndices = generateRandomIndices();
    });

    bgControlDiv = createDiv();
    bgControlDiv.id("bg-ctrl");
    bgControlDiv.parent(controlPanel);
    bgControlDiv.style("background", "#f0f0f0");
    bgControlDiv.style("padding", "15px");
    bgControlDiv.style("border-radius", "12px");
    bgControlDiv.style("display", "flex");
    bgControlDiv.style("align-items", "center");
    bgControlDiv.style("justify-content", "space-between");
    bgControlDiv.style("margin-bottom", "20px");
    controlPanel.elt.insertBefore(bgControlDiv.elt, statusP.elt);
    let btnBgPrev = createButton("◀");
    styleArrowBtn(btnBgPrev);
    btnBgPrev.parent(bgControlDiv);
    btnBgPrev.mousePressed(() => changeBg(-1));
    bgLabel = createSpan(`BG: ${bgOptions[bgIndex]}`);
    bgLabel.parent(bgControlDiv);
    bgLabel.style("font-family", "sans-serif");
    bgLabel.style("font-weight", "bold");
    bgLabel.style("font-size", "14px");
    let btnBgNext = createButton("▶");
    styleArrowBtn(btnBgNext);
    btnBgNext.parent(bgControlDiv);
    btnBgNext.mousePressed(() => changeBg(1));
  } else {
    select("#ar-btns").style("display", "flex");
    select("#bg-ctrl").style("display", "flex");
    arMode = "SYNC";
    btnSwitchMode.html("🔄 Mode: SYNC");
    btnSwitchMode.style("background", "#9C27B0");
    select("#part-list-container").show();
  }
  loop();
}
function toggleArMode() {
  if (arMode === "SYNC") {
    arMode = "MULTI";
    btnSwitchMode.html("🔀 Mode: MULTI");
    btnSwitchMode.style("background", "#FF9800");
    select("#part-list-container").hide();
    faceConfigMap = {};
  } else {
    arMode = "SYNC";
    btnSwitchMode.html("🔄 Mode: SYNC");
    btnSwitchMode.style("background", "#9C27B0");
    select("#part-list-container").show();
  }
}
function stopWebcamMode() {
  mode = "EDITOR";
  faceMesh.detectStop();
  faces = [];
  noLoop();
  let btns = selectAll("button", "#editor-btn-group");
  btns.forEach((b) => b.show());
  select("#part-list-container").show();
  if (select("#ar-btns")) select("#ar-btns").hide();
  if (select("#bg-ctrl")) select("#bg-ctrl").hide();
  redraw();
}
function changeBg(dir) {
  bgIndex = (bgIndex + dir + bgOptions.length) % bgOptions.length;
  bgLabel.html(`BG: ${bgOptions[bgIndex]}`);
}
function createPartRow(part, parent) {
  let row = createDiv();
  row.parent(parent);
  row.style(
    "display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; margin-bottom:10px; padding:10px; border-radius:10px; border:1px solid #eee; transition: all 0.2s;"
  );
  row.mouseOver(() => row.style("background", "#f0f8ff"));
  row.mouseOut(() => row.style("background", "#f9f9f9"));
  let btnPrev = createButton("◀");
  btnPrev.mousePressed(() => changeIndex(part.key, -1));
  btnPrev.parent(row);
  styleArrowBtn(btnPrev);
  let label = createSpan(part.label);
  label.style("font-weight:bold; font-size: 16px; color:#333");
  label.parent(row);
  let btnNext = createButton("▶");
  btnNext.mousePressed(() => changeIndex(part.key, 1));
  btnNext.parent(row);
  styleArrowBtn(btnNext);
}
function changeIndex(key, dir) {
  let len = assets[key].length;
  currentIndices[key] = (currentIndices[key] + dir + len) % len;
  redraw();
}
function styleMainButton(btn, color) {
  btn.style(
    `background:${color}; color:white; border:none; padding:12px 20px; border-radius:10px; cursor:pointer; font-size:15px; font-weight:bold; box-shadow: 0 4px 10px rgba(0,0,0,0.15); transition: transform 0.1s;`
  );
  btn.mousePressed(() => btn.style("transform", "scale(0.95)"));
  btn.mouseReleased(() => btn.style("transform", "scale(1)"));
}
function styleArrowBtn(btn) {
  btn.style(
    "background:white; border:1px solid #ddd; border-radius:8px; width:36px; height:36px; cursor:pointer; font-size: 16px; display:flex; align-items:center; justify-content:center; color:#555;"
  );
}
function windowResized() {
  if (mode === "EDITOR") {
    let size = min(windowWidth * 0.6, windowHeight * 0.85);
    resizeCanvas(size, size);
    maskLayer = createGraphics(size, size);
    maskLayer.noStroke();
    redraw();
  }
}
