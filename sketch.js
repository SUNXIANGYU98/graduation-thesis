/*
  VS Code Local Version - Signature Moved Edition
  修复：
  1. "SUN XIANGYU" 署名从左上角移到了右侧工具栏 LOGO 的下方
  2. 保持了所有之前的去黑线、防卡死、UI优化功能
*/

// ================= 1. 路径配置 =================
const pathConfig = {
  ear: "e",
  mouth: "m",
  nose: "n",
  eyes: "y",
  beard: "b",
  ornaments: "o",
};

const IMAGE_COUNT = 6;
// ===========================================

const CROP_PIXELS = 25;

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
let isMobile = false;
let mainContainer;

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
  // 注意：删除了这里的 createWatermark() 调用

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

  mainCanvas.style("outline", "none");
  mainCanvas.style("box-shadow", "none");
  mainCanvas.style("border", "none");
  mainCanvas.style("border-radius", "20px");

  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke();

  noLoop();
  imageMode(CENTER);
  angleMode(DEGREES);

  createEditorUI();

  let constraints;
  if (isMobile) {
    constraints = { video: { facingMode: "user" }, audio: false };
  } else {
    constraints = VIDEO;
  }

  video = createCapture(constraints);
  video.hide();

  console.log("Starting FaceMesh...");
  let options = { maxFaces: 5, refineLandmarks: true, flipHorizontal: false };

  faceMesh = ml5.faceMesh(options, () => {
    console.log("✅ Model Loaded!");
    modelLoaded = true;
    updateStatusText();
    redraw();
  });
}

// 注意：删除了 createWatermark 函数定义

function draw() {
  noStroke();
  strokeWeight(0);
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
  strokeWeight(0);

  if (!video || video.width === 0 || video.height === 0) return;

  let scaleW = width / video.width;
  let scaleH = height / video.height;
  let scaleFactor = max(scaleW, scaleH);
  let finalW = video.width * scaleFactor;
  let finalH = video.height * scaleFactor;

  push();
  translate(width / 2, height / 2);
  scale(-1, 1);
  noStroke();

  // 1. 绘制视频
  if (bgIndex <= 3) {
    drawingContext.shadowBlur = 0;
    image(video, 0, 0, finalW, finalH);
  }

  // 2. 绘制遮罩
  if (bgIndex > 0) {
    maskLayer.clear();
    maskLayer.noStroke();
    maskLayer.drawingContext.shadowBlur = 0;

    let bgColor;
    if (bgIndex === 1 || bgIndex === 4) bgColor = color(255);
    else if (bgIndex === 2 || bgIndex === 5) bgColor = color(128);
    else if (bgIndex === 3 || bgIndex === 6) bgColor = color(0);

    maskLayer.fill(bgColor);
    maskLayer.rect(0, 0, width, height);

    if (bgIndex >= 1 && bgIndex <= 3 && faces.length > 0) {
      maskLayer.erase();
      maskLayer.noStroke();
      for (let i = 0; i < faces.length; i++) {
        let face = faces[i];
        let kp = face.keypoints;
        let ox = (width - finalW) / 2;
        let oy = (height - finalH) / 2;

        maskLayer.beginShape();
        for (let idx of silhouetteIndices) {
          let p = kp[idx];
          let mirroredX = video.width - p.x;
          let x = mirroredX * scaleFactor + ox;
          let y = p.y * scaleFactor + oy;
          maskLayer.vertex(x, y);
        }
        maskLayer.endShape(CLOSE);
      }
      maskLayer.noErase();
    }
    image(maskLayer, 0, 0, width, height);
  }

  // 3. 纯色覆盖
  if (bgIndex >= 4) {
    let c;
    if (bgIndex === 4) c = color(255);
    else if (bgIndex === 5) c = color(128);
    else c = color(0);
    fill(c);
    noStroke();
    rect(0, 0, width * 2, height * 2);
  }

  // 4. 绘制面具
  for (let i = 0; i < faces.length; i++) {
    drawFaceMask(faces[i], scaleFactor, video.width, video.height);
  }

  pop();

  if (faceMesh && faces.length === 0 && frameCount % 30 === 0) {
    faceMesh.detectStart(video, (results) => {
      faces = results;
    });
  }

  if (!modelLoaded) {
    fill(bgIndex === 1 || bgIndex === 4 ? 0 : 255);
    noStroke();
    textSize(width * 0.05);
    textAlign(CENTER);
    text("AI Loading...", width / 2, height / 2);
  }
}

// AR 算法
function drawFaceMask(face, s, vW, vH) {
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

  drawPart(assets.ear, currentIndices.ear);
  drawPart(assets.beard, currentIndices.beard);

  if (assets.nose[currentIndices.nose]) {
    let img = assets.nose[currentIndices.nose];
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

  drawPart(assets.ornaments, currentIndices.ornaments);

  let topLip = getP(13);
  let botLip = getP(14);
  let mouthOpenDist = p5.Vector.dist(topLip, botLip);
  let relativeOpen = mouthOpenDist / maskScale;
  let mouthStretch = map(relativeOpen, 0, 100, 0.8, 2.5, true);
  if (assets.mouth[currentIndices.mouth]) {
    let img = assets.mouth[currentIndices.mouth];
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
  if (assets.eyes[currentIndices.eyes]) {
    let img = assets.eyes[currentIndices.eyes];
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
let controlPanel, btnStartAR, btnBack, btnSnap, bgControlDiv, bgLabel, statusP;

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
  btnContainer.parent(controlPanel);
  btnContainer.style("display", "flex");
  btnContainer.style("gap", "10px");
  btnContainer.style("margin-bottom", "30px");
  btnContainer.style("flex-wrap", "wrap");

  btnStartAR = createButton("📸 AR Camera");
  styleMainButton(btnStartAR, "#2196F3");
  btnStartAR.style("flex-grow", "1");
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

  // 【修改处】LOGO 移到底部
  let logoImg = createImg("LOGO.png", "Brand Logo");
  logoImg.parent(controlPanel);
  logoImg.style("width", "100px");
  logoImg.style("height", "auto");
  logoImg.style("display", "block");
  logoImg.style("margin", "0 auto 10px auto");
  logoImg.style("opacity", "0.8");

  // 【新增功能】署名 SUN XIANGYU
  // 放在 LOGO 下面
  let signature = createP("SUN XIANGYU");
  signature.parent(controlPanel);
  signature.style("font-family", "sans-serif");
  signature.style("font-size", "14px");
  signature.style("font-weight", "bold");
  signature.style("color", "#888"); // 灰色
  signature.style("text-align", "center");
  signature.style("margin", "0"); // 紧贴着 LOGO
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

  maskLayer.clear();
  maskLayer.noStroke();

  faceMesh.detectStart(video, (results) => {
    faces = results;
  });

  btnStartAR.hide();

  if (!btnBack) {
    let arBtnContainer = createDiv();
    arBtnContainer.id("ar-btns");
    // 插入到最前面
    controlPanel.elt.insertBefore(
      arBtnContainer.elt,
      controlPanel.elt.firstChild
    );

    arBtnContainer.style("display", "flex");
    arBtnContainer.style("gap", "10px");
    arBtnContainer.style("margin-bottom", "20px");

    btnBack = createButton("⬅ Back");
    styleMainButton(btnBack, "#f44336");
    btnBack.parent(arBtnContainer);
    btnBack.style("flex-grow", "1");
    btnBack.mousePressed(stopWebcamMode);

    btnSnap = createButton("📸 Snap");
    styleMainButton(btnSnap, "#E91E63");
    btnSnap.parent(arBtnContainer);
    btnSnap.style("flex-grow", "1");
    btnSnap.mousePressed(() => {
      saveCanvas("ar_shot", "png");
    });

    bgControlDiv = createDiv();
    bgControlDiv.id("bg-ctrl");
    bgControlDiv.parent(controlPanel); // 放在控制面板里
    bgControlDiv.style("background", "#f0f0f0");
    bgControlDiv.style("padding", "15px");
    bgControlDiv.style("border-radius", "12px");
    bgControlDiv.style("display", "flex");
    bgControlDiv.style("align-items", "center");
    bgControlDiv.style("justify-content", "space-between");
    bgControlDiv.style("margin-bottom", "20px"); // 和 AI 状态保持距离

    // 插入到状态文字之前
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
  }
  loop();
}

function stopWebcamMode() {
  mode = "EDITOR";
  faceMesh.detectStop();
  faces = [];
  noLoop();

  btnStartAR.show();
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
function randomizeFace() {
  for (let part of partsList)
    currentIndices[part.key] = floor(random(assets[part.key].length));
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
