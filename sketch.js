/*
  VS Code Local Version - Final Clean Edition
  修复：
  1. 彻底移除 AR 模式下的所有黑色边框/方框 (noStroke)
  2. 包含所有功能：背景切换、拍照、设计保存、极简文件名适配
*/

// ================= 1. 路径配置 =================
const pathConfig = {
  ear: "e", // e1.png ...
  mouth: "m", // m1.png ...
  nose: "n", // n1.png ...
  eyes: "y", // y1.png ...
  beard: "b", // b1.png ...
  ornaments: "o", // o1.png ...
};

const IMAGE_COUNT = 6;
// ===========================================

let assets = {
  ear: [],
  mouth: [],
  nose: [],
  eyes: [],
  beard: [],
  ornaments: [],
};
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
let video;
let faceMesh;
let faces = [];
let modelLoaded = false;
let mainCanvas;
let maskLayer;
let displaySize = 800;
const DESIGN_SIZE = 1000;

// === 背景控制 ===
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

// 面部轮廓索引
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
}

function loadGroup(prefix, targetArray) {
  for (let i = 1; i <= IMAGE_COUNT; i++) {
    targetArray.push(loadImage(prefix + i + ".png"));
  }
}

function setup() {
  displaySize = min(windowWidth, windowHeight * 0.8);
  mainCanvas = createCanvas(displaySize, displaySize);

  // 移除画布本身的 CSS 边框
  mainCanvas.style("outline", "none");
  mainCanvas.style("box-shadow", "none");

  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke(); // 初始化遮罩层无描边

  noLoop();
  imageMode(CENTER);
  angleMode(DEGREES);

  createEditorUI();

  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  console.log("Starting FaceMesh...");
  let options = { maxFaces: 5, refineLandmarks: true, flipHorizontal: true };

  faceMesh = ml5.faceMesh(options, () => {
    console.log("✅ Model Loaded!");
    modelLoaded = true;
    updateStatusText();
    redraw();
  });
}

function draw() {
  // 【关键修复】全局禁止描边，确保任何地方都不会画出黑线
  noStroke();

  if (mode === "EDITOR") {
    drawEditor();
  } else if (mode === "WEBCAM") {
    drawWebcam();
  }
}

// ---------------- 模式 1: 编辑器 ----------------
function drawEditor() {
  clear();
  background(255);

  push();
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
    image(imgArray[index], 0, 0, DESIGN_SIZE, DESIGN_SIZE);
  }
}

// ---------------- 模式 2: AR (无黑线版) ----------------
function drawWebcam() {
  background(0);
  noStroke(); // 双重保险：确保主画布无描边

  let vW = video.width;
  let vH = video.height;
  if (vW === 0 || vH === 0) return;

  let scaleFactor = max(width / vW, height / vH);
  let finalW = vW * scaleFactor;
  let finalH = vH * scaleFactor;

  // 1. 始终绘制底层视频
  image(video, width / 2, height / 2, finalW, finalH);

  // 2. 绘制遮罩层 (Real+Color / Pure Color)
  if (bgIndex > 0) {
    maskLayer.clear();
    // 【关键修复】每次绘制遮罩前，必须强制关闭 maskLayer 的描边
    maskLayer.noStroke();

    // 设置背景色
    let bgColor;
    if (bgIndex === 1 || bgIndex === 4) bgColor = color(255); // White
    else if (bgIndex === 2 || bgIndex === 5) bgColor = color(128); // Grey
    else if (bgIndex === 3 || bgIndex === 6) bgColor = color(0); // Black

    // 使用 rect 填充背景
    maskLayer.fill(bgColor);
    maskLayer.rect(0, 0, width, height);

    // Real+Color 模式：挖洞
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
          let x = p.x * scaleFactor + ox;
          let y = p.y * scaleFactor + oy;
          maskLayer.vertex(x, y);
        }
        maskLayer.endShape(CLOSE);
      }
      maskLayer.noErase();
    }

    // 将遮罩层盖在视频上
    image(maskLayer, width / 2, height / 2, width, height);
  }

  // 3. AI 侦测
  if (faceMesh && faces.length === 0 && frameCount % 30 === 0) {
    faceMesh.detectStart(video, (results) => {
      faces = results;
    });
  }

  // AI Loading 提示
  if (!modelLoaded) {
    fill(bgIndex === 1 || bgIndex === 4 ? 0 : 255);
    noStroke();
    textSize(30);
    textAlign(CENTER);
    text("AI Loading...", width / 2, height / 2);
    return;
  }

  // 4. 绘制 AR 面具 (顶层)
  for (let i = 0; i < faces.length; i++) {
    drawFaceMask(faces[i], scaleFactor, finalW, finalH);
  }
}

// AR 算法
function drawFaceMask(face, s, vW, vH) {
  let kp = face.keypoints;
  let ox = (width - vW) / 2;
  let oy = (height - vH) / 2;
  function getP(index) {
    return createVector(kp[index].x * s + ox, kp[index].y * s + oy);
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
  translate(noseTip.x, noseTip.y);
  rotate(angle * -1);
  scale(maskScale);

  // 再次确保绘制面具时无描边
  noStroke();

  drawLayer(assets.ear, currentIndices.ear);
  drawLayer(assets.beard, currentIndices.beard);
  imageMode(CENTER);
  if (assets.nose[currentIndices.nose]) {
    image(assets.nose[currentIndices.nose], 0, -50, DESIGN_SIZE, DESIGN_SIZE);
  }
  drawLayer(assets.ornaments, currentIndices.ornaments);

  // 动态嘴巴
  let topLip = getP(13);
  let botLip = getP(14);
  let mouthOpenDist = p5.Vector.dist(topLip, botLip);
  let relativeOpen = mouthOpenDist / maskScale;
  let mouthStretch = map(relativeOpen, 0, 100, 0.8, 2.5, true);

  if (assets.mouth[currentIndices.mouth]) {
    image(
      assets.mouth[currentIndices.mouth],
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE * mouthStretch
    );
  }

  // 动态眼睛
  let leftEyeTop = getP(159);
  let leftEyeBot = getP(145);
  let eyeOpenDist = p5.Vector.dist(leftEyeTop, leftEyeBot);
  let relativeEyeOpen = eyeOpenDist / maskScale;
  let eyeSquash = map(relativeEyeOpen, 0, 20, 0.1, 1.0, true);

  if (assets.eyes[currentIndices.eyes]) {
    image(
      assets.eyes[currentIndices.eyes],
      0,
      0,
      DESIGN_SIZE,
      DESIGN_SIZE * eyeSquash
    );
  }

  pop();
}

function drawLayer(imgArray, index) {
  if (imgArray.length > 0 && imgArray[index]) {
    image(imgArray[index], 0, 0, DESIGN_SIZE, DESIGN_SIZE);
  }
}

// ---------------- UI & DOM ----------------
let controlPanel, btnStartAR, btnBack, btnSnap, bgControlDiv, bgLabel, statusP;

function createEditorUI() {
  if (controlPanel) controlPanel.remove();
  controlPanel = createDiv();
  controlPanel.style(
    `width:${displaySize}px; margin:20px auto; text-align:center; padding-bottom: 20px;`
  );

  btnStartAR = createButton("📸 Start AR Camera");
  styleMainButton(btnStartAR, "#2196F3");
  btnStartAR.parent(controlPanel);
  btnStartAR.mousePressed(startWebcamMode);

  let btnRand = createButton("🎲 Randomize");
  styleMainButton(btnRand, "#FF9800");
  btnRand.parent(controlPanel);
  btnRand.style("margin-left", "10px");
  btnRand.mousePressed(() => {
    randomizeFace();
    redraw();
  });

  let btnSave = createButton("💾 Save Design");
  styleMainButton(btnSave, "#4CAF50");
  btnSave.parent(controlPanel);
  btnSave.style("margin-left", "10px");
  btnSave.mousePressed(() => {
    saveCanvas("my_face_design", "png");
  });

  let listDiv = createDiv();
  listDiv.parent(controlPanel);
  listDiv.style("margin-top", "20px");
  for (let part of partsList) createPartRow(part, listDiv);

  statusP = createP("🔴 AI Loading...");
  statusP.parent(controlPanel);
  statusP.style("font-family", "sans-serif");
  statusP.style("font-size", "16px");
  statusP.style("font-weight", "bold");
  statusP.style("color", "red");
  statusP.style("margin-top", "15px");
}

function updateStatusText() {
  if (statusP) {
    if (modelLoaded) {
      statusP.html("🟢 AI Ready! Click 'Start AR Camera'");
      statusP.style("color", "#009900");
    } else {
      statusP.html("🔴 AI Loading... Please Wait...");
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
  resizeCanvas(640, 480);
  controlPanel.hide();

  maskLayer = createGraphics(640, 480);
  maskLayer.noStroke(); // 初始化 AR 遮罩层时关闭描边

  faceMesh.detectStart(video, (results) => {
    faces = results;
  });

  if (!btnBack) {
    btnBack = createButton("⬅ Back");
    btnBack.position(20, 20);
    styleMainButton(btnBack, "#f44336");
    btnBack.mousePressed(stopWebcamMode);

    btnSnap = createButton("📸 Snap");
    btnSnap.position(120, 20);
    styleMainButton(btnSnap, "#E91E63");
    btnSnap.mousePressed(() => {
      saveCanvas("ar_shot", "png");
    });

    bgControlDiv = createDiv();
    bgControlDiv.style("position", "fixed");
    bgControlDiv.style("bottom", "30px");
    bgControlDiv.style("left", "50%");
    bgControlDiv.style("transform", "translateX(-50%)");

    bgControlDiv.style("background", "white");
    bgControlDiv.style("padding", "10px 20px");
    bgControlDiv.style("border-radius", "50px");
    bgControlDiv.style("box-shadow", "0 4px 15px rgba(0,0,0,0.3)");
    bgControlDiv.style("display", "flex");
    bgControlDiv.style("align-items", "center");
    bgControlDiv.style("gap", "15px");
    bgControlDiv.style("z-index", "9999");

    let btnBgPrev = createButton("◀");
    styleArrowBtn(btnBgPrev);
    btnBgPrev.parent(bgControlDiv);
    btnBgPrev.mousePressed(() => changeBg(-1));

    bgLabel = createSpan(`BG: ${bgOptions[bgIndex]}`);
    bgLabel.parent(bgControlDiv);
    bgLabel.style("font-family", "sans-serif");
    bgLabel.style("font-weight", "bold");
    bgLabel.style("font-size", "16px");
    bgLabel.style("min-width", "140px");
    bgLabel.style("text-align", "center");

    let btnBgNext = createButton("▶");
    styleArrowBtn(btnBgNext);
    btnBgNext.parent(bgControlDiv);
    btnBgNext.mousePressed(() => changeBg(1));
  } else {
    btnBack.show();
    btnSnap.show();
    bgControlDiv.show();
  }
  loop();
}

function stopWebcamMode() {
  mode = "EDITOR";
  resizeCanvas(displaySize, displaySize);
  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke();

  faceMesh.detectStop();
  faces = [];
  noLoop();

  controlPanel.show();
  btnBack.hide();
  btnSnap.hide();
  bgControlDiv.hide();
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
    "display:flex; justify-content:space-between; background:white; margin-bottom:5px; padding:5px; border-radius:5px; border:1px solid #ccc"
  );
  let btnPrev = createButton("◀");
  btnPrev.mousePressed(() => changeIndex(part.key, -1));
  btnPrev.parent(row);
  let label = createSpan(part.label);
  label.style("font-weight:bold; line-height:25px;");
  label.parent(row);
  let btnNext = createButton("▶");
  btnNext.mousePressed(() => changeIndex(part.key, 1));
  btnNext.parent(row);
}
function changeIndex(key, dir) {
  let len = assets[key].length;
  currentIndices[key] = (currentIndices[key] + dir + len) % len;
  redraw();
}
function randomizeFace() {
  for (let part of partsList)
    currentIndices[part.key] = floor(random(assets[part.key].length));
}
function styleMainButton(btn, color) {
  btn.style(
    `background:${color}; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-size:16px;`
  );
}
function styleArrowBtn(btn) {
  btn.style(
    "background:#f0f0f0; border:1px solid #ccc; border-radius:4px; width:40px; height:40px; cursor:pointer; font-size: 18px;"
  );
}
function windowResized() {
  if (mode === "EDITOR") {
    displaySize = min(windowWidth, windowHeight * 0.8);
    resizeCanvas(displaySize, displaySize);
    redraw();
  }
}
