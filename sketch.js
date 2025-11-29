/*
  VS Code Local Version - Distortion Fix Edition
  修复：
  1. PC端：移除强制分辨率限制，解决黑屏
  2. 手机端：使用“等比缩放+居中剪裁”算法，人脸不再变形
  3. 坐标对齐：修复 AI 坐标映射，确保面具紧贴人脸
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
let isMobile = false;

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
  isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // 画布尺寸初始化
  if (isMobile) {
    displaySize = windowWidth;
  } else {
    displaySize = min(windowWidth * 0.95, windowHeight * 0.8);
  }

  mainCanvas = createCanvas(displaySize, displaySize);
  mainCanvas.style("display", "block");
  mainCanvas.style("margin", "0 auto");
  mainCanvas.style("outline", "none");

  maskLayer = createGraphics(displaySize, displaySize);
  maskLayer.noStroke();

  noLoop();
  imageMode(CENTER);
  angleMode(DEGREES);

  createEditorUI();

  // 【修复 1】摄像头初始化逻辑重写
  // 不再强制设置 video.size，让浏览器决定最佳分辨率
  let constraints;
  if (isMobile) {
    constraints = {
      video: {
        facingMode: "user",
      },
      audio: false,
    };
  } else {
    // PC 端使用最基础配置，兼容性最好
    constraints = VIDEO;
  }

  // 使用回调函数确认摄像头启动
  video = createCapture(constraints, function (stream) {
    console.log("Camera stream started.");
  });
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

// ---------------- 模式 2: AR (防畸变修复版) ----------------
function drawWebcam() {
  background(0);
  noStroke();

  // 等待视频流准备好
  if (!video || video.width === 0 || video.height === 0) {
    return;
  }

  // 【修复 2】防畸变核心算法 (Aspect Ratio Cover)
  // 计算画布比例和视频比例
  let canvasRatio = width / height;
  let videoRatio = video.width / video.height;

  let drawW, drawH;

  // 如果画布比视频更宽 (屏幕宽，视频窄) -> 以宽度为准，上下剪裁
  // 如果画布比视频更瘦 (手机竖屏) -> 以高度为准，左右剪裁
  if (canvasRatio > videoRatio) {
    drawW = width;
    drawH = width / videoRatio;
  } else {
    drawH = height;
    drawW = height * videoRatio;
  }

  // 这里的 scaleRatio 是指视频被放大/缩小的倍数
  // 我们需要用这个倍数去修正 AI 的坐标
  let scaleRatio = drawW / video.width;

  // 1. 绘制底层视频 (居中绘制，多余部分会自动被画布裁掉)
  image(video, width / 2, height / 2, drawW, drawH);

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
        // 计算偏移量：(画布宽 - 实际绘制宽) / 2
        let ox = (width - drawW) / 2;
        let oy = (height - drawH) / 2;

        maskLayer.beginShape();
        for (let idx of silhouetteIndices) {
          let p = kp[idx];
          // 【关键】坐标必须跟随缩放逻辑
          let x = p.x * scaleRatio + ox;
          let y = p.y * scaleRatio + oy;
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

  if (!modelLoaded) {
    fill(bgIndex === 1 || bgIndex === 4 ? 0 : 255);
    noStroke();
    textSize(width * 0.05);
    textAlign(CENTER);
    text("AI Loading...", width / 2, height / 2);
    return;
  }

  // 4. 绘制 AR 面具
  // 把计算好的缩放参数传进去
  for (let i = 0; i < faces.length; i++) {
    drawFaceMask(faces[i], scaleRatio, drawW, drawH);
  }
}

// AR 算法
function drawFaceMask(face, s, drawW, drawH) {
  let kp = face.keypoints;

  // 重新计算偏移量
  let ox = (width - drawW) / 2;
  let oy = (height - drawH) / 2;

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
  // 镜像翻转逻辑：前置摄像头通常需要翻转旋转方向
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
  controlPanel.style("width", "95%");
  controlPanel.style("max-width", "800px");
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

  // AR 模式全屏适配逻辑
  let w = windowWidth;
  let h = windowHeight;
  if (!isMobile) {
    w = min(windowWidth, 800);
    h = min(windowHeight * 0.8, 600);
  }

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
  if (isMobile) {
    location.reload();
  } else {
    if (mode === "EDITOR") {
      let size = min(windowWidth * 0.95, windowHeight * 0.75);
      resizeCanvas(size, size);
      redraw();
    }
  }
}
