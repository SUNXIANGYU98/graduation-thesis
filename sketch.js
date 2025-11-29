/*
  VS Code Local Version - Final Universal Edition (PC & Mobile)
  CN: 完美适配电脑和手机，自动处理屏幕旋转和窗口调整
  IT: Adattamento perfetto per PC e Mobile, gestisce rotazione e ridimensionamento
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
let isMobile = false; // 用于判断设备类型

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
  // 简单的设备检测
  isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // 计算自适应画布大小
  // 手机上占宽度的95%，电脑上限制最大高度
  displaySize = min(windowWidth * 0.95, windowHeight * 0.75);

  mainCanvas = createCanvas(displaySize, displaySize);

  // 样式优化
  mainCanvas.style("display", "block");
  mainCanvas.style("margin", "0 auto");
  mainCanvas.style("outline", "none");

  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke();

  noLoop();
  imageMode(CENTER);
  angleMode(DEGREES);

  createEditorUI();

  // 强制前置摄像头
  let constraints = {
    video: {
      facingMode: "user",
    },
    audio: false,
  };

  video = createCapture(constraints);
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

// ---------------- 模式 2: AR ----------------
function drawWebcam() {
  background(0);
  noStroke();

  let vW = video.width;
  let vH = video.height;
  if (vW === 0 || vH === 0) return;

  // Cover 模式：让视频铺满画布
  let scaleFactor = max(width / vW, height / vH);
  let finalW = vW * scaleFactor;
  let finalH = vH * scaleFactor;

  // 1. 绘制底层
  image(video, width / 2, height / 2, finalW, finalH);

  // 2. 绘制遮罩
  if (bgIndex > 0) {
    maskLayer.clear();
    maskLayer.noStroke();

    let bgColor;
    if (bgIndex === 1 || bgIndex === 4) bgColor = color(255);
    else if (bgIndex === 2 || bgIndex === 5) bgColor = color(128);
    else if (bgIndex === 3 || bgIndex === 6) bgColor = color(0);

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
          let x = p.x * scaleFactor + ox;
          let y = p.y * scaleFactor + oy;
          maskLayer.vertex(x, y);
        }
        maskLayer.endShape(CLOSE);
      }
      maskLayer.noErase();
    }
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
    textSize(width * 0.05);
    textAlign(CENTER);
    text("AI Loading...", width / 2, height / 2);
    return;
  }

  // 4. 绘制 AR 面具
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
  // 【双平台适配】
  // 电脑端：需要反转
  // 手机端：大多数前置也需要反转，保持一致
  rotate(angle * -1);
  scale(maskScale);

  noStroke();

  drawLayer(assets.ear, currentIndices.ear);
  drawLayer(assets.beard, currentIndices.beard);
  imageMode(CENTER);
  if (assets.nose[currentIndices.nose]) {
    image(assets.nose[currentIndices.nose], 0, -50, DESIGN_SIZE, DESIGN_SIZE);
  }
  drawLayer(assets.ornaments, currentIndices.ornaments);

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
  // 适配手机宽度
  controlPanel.style("width", "95%");
  controlPanel.style("max-width", "800px"); // 电脑上不过宽
  controlPanel.style("margin", "20px auto");
  controlPanel.style("text-align", "center");
  controlPanel.style("padding-bottom", "50px");

  let btnContainer = createDiv();
  btnContainer.parent(controlPanel);
  btnContainer.style("display", "flex");
  btnContainer.style("flex-wrap", "wrap");
  btnContainer.style("justify-content", "center");
  btnContainer.style("gap", "10px");
  btnContainer.style("margin-bottom", "20px");

  btnStartAR = createButton("📸 Start Camera");
  styleMainButton(btnStartAR, "#2196F3");
  btnStartAR.parent(btnContainer);
  btnStartAR.mousePressed(startWebcamMode);

  let btnRand = createButton("🎲 Random");
  styleMainButton(btnRand, "#FF9800");
  btnRand.parent(btnContainer);
  btnRand.mousePressed(() => {
    randomizeFace();
    redraw();
  });

  let btnSave = createButton("💾 Save");
  styleMainButton(btnSave, "#4CAF50");
  btnSave.parent(btnContainer);
  btnSave.mousePressed(() => {
    saveCanvas("my_face_design", "png");
  });

  let listDiv = createDiv();
  listDiv.parent(controlPanel);
  for (let part of partsList) createPartRow(part, listDiv);

  statusP = createP("🔴 AI Loading...");
  statusP.parent(controlPanel);
  statusP.style("font-family", "sans-serif");
  statusP.style("font-size", "16px");
  statusP.style("font-weight", "bold");
  statusP.style("color", "red");
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

  // AR 模式全屏适配
  // 手机端：全屏
  // 电脑端：保持合理比例，不要太大
  let w = windowWidth;
  let h = isMobile
    ? windowHeight * 0.8
    : min(windowHeight * 0.9, windowWidth * 0.75);

  resizeCanvas(w, h);
  mainCanvas.style("width", "100%");
  mainCanvas.style("height", "auto");

  controlPanel.hide();

  maskLayer = createGraphics(w, h);
  maskLayer.noStroke();

  faceMesh.detectStart(video, (results) => {
    faces = results;
  });

  if (!btnBack) {
    let topBtns = createDiv();
    topBtns.id("topBtns");
    topBtns.style("position", "absolute");
    topBtns.style("top", "10px");
    topBtns.style("left", "10px");
    topBtns.style("z-index", "1001");
    topBtns.style("display", "flex");
    topBtns.style("gap", "10px");

    btnBack = createButton("⬅ Back");
    styleMainButton(btnBack, "#f44336");
    btnBack.parent(topBtns);
    btnBack.mousePressed(stopWebcamMode);

    btnSnap = createButton("📸 Snap");
    styleMainButton(btnSnap, "#E91E63");
    btnSnap.parent(topBtns);
    btnSnap.mousePressed(() => {
      saveCanvas("ar_shot", "png");
    });

    bgControlDiv = createDiv();
    bgControlDiv.id("bgCtrl");
    bgControlDiv.style("position", "fixed");
    bgControlDiv.style("bottom", "20px");
    bgControlDiv.style("left", "50%");
    bgControlDiv.style("transform", "translateX(-50%)");
    bgControlDiv.style("background", "white");
    bgControlDiv.style("padding", "10px 15px");
    bgControlDiv.style("border-radius", "50px");
    bgControlDiv.style("box-shadow", "0 4px 15px rgba(0,0,0,0.3)");
    bgControlDiv.style("display", "flex");
    bgControlDiv.style("align-items", "center");
    bgControlDiv.style("gap", "10px");
    bgControlDiv.style("z-index", "1000");
    bgControlDiv.style("width", "max-content");

    let btnBgPrev = createButton("◀");
    styleArrowBtn(btnBgPrev);
    btnBgPrev.parent(bgControlDiv);
    btnBgPrev.mousePressed(() => changeBg(-1));

    bgLabel = createSpan(`BG: ${bgOptions[bgIndex]}`);
    bgLabel.parent(bgControlDiv);
    bgLabel.style("font-family", "sans-serif");
    bgLabel.style("font-weight", "bold");
    bgLabel.style("font-size", "14px");
    bgLabel.style("min-width", "120px");
    bgLabel.style("text-align", "center");

    let btnBgNext = createButton("▶");
    styleArrowBtn(btnBgNext);
    btnBgNext.parent(bgControlDiv);
    btnBgNext.mousePressed(() => changeBg(1));
  } else {
    select("#topBtns").show();
    select("#bgCtrl").show();
  }
  loop();
}

function stopWebcamMode() {
  mode = "EDITOR";

  // 恢复编辑器尺寸
  let size = min(windowWidth * 0.95, windowHeight * 0.75);
  resizeCanvas(size, size);
  mainCanvas.style("margin", "0 auto");

  maskLayer = createGraphics(size, size);
  maskLayer.noStroke();

  faceMesh.detectStop();
  faces = [];
  noLoop();

  controlPanel.show();
  if (select("#topBtns")) select("#topBtns").hide();
  if (select("#bgCtrl")) select("#bgCtrl").hide();

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
    "display:flex; justify-content:space-between; align-items:center; background:white; margin-bottom:8px; padding:8px; border-radius:8px; border:1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
  );

  let btnPrev = createButton("◀");
  btnPrev.mousePressed(() => changeIndex(part.key, -1));
  btnPrev.parent(row);
  styleArrowBtn(btnPrev);

  let label = createSpan(part.label);
  label.style("font-weight:bold; font-size: 16px;");
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
function randomizeFace() {
  for (let part of partsList)
    currentIndices[part.key] = floor(random(assets[part.key].length));
}

function styleMainButton(btn, color) {
  btn.style(
    `background:${color}; color:white; border:none; padding:12px 16px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); touch-action: manipulation;`
  );
}
function styleArrowBtn(btn) {
  btn.style(
    "background:#f8f9fa; border:1px solid #ddd; border-radius:6px; width:44px; height:44px; cursor:pointer; font-size: 18px; display:flex; align-items:center; justify-content:center; touch-action: manipulation;"
  );
}

function windowResized() {
  // 仅在手机上，旋转屏幕时刷新页面以重置布局
  if (isMobile) {
    location.reload();
  } else {
    // 电脑上只调整画布大小，不刷新
    if (mode === "EDITOR") {
      let size = min(windowWidth * 0.95, windowHeight * 0.75);
      resizeCanvas(size, size);
      redraw();
    }
  }
}
