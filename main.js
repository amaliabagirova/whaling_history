const DATA = window.DATA || {};

const progressBar = document.getElementById("progressBar");
const chapterLinks = Array.from(document.querySelectorAll(".chapter-rail__item"));
const sceneAnchorMap = {
  method: "method",
  framing: "framing",
  "part-one": "part-one",
  rhythms: "product-rhythms",
  shares: "product-shares",
  "part-one-conclusion": "part-one-conclusion",
  "part-two": "part-two",
  yield: "catch-per-voyage",
  divergence: "divergence",
  voyages: "voyage-changes",
  "part-two-conclusion": "part-two-conclusion",
  "part-three": "part-three",
  geography: "geography-widens",
  finale: "finale",
  epilogue: "epilogue",
  "crew-profile": "crew-profile",
  "crew-geography": "crew-geography",
  sources: "sources",
};

function updateProgress() {
  if (!progressBar) return;
  const doc = document.documentElement;
  const scrollTop = doc.scrollTop || document.body.scrollTop;
  const max = doc.scrollHeight - doc.clientHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
  progressBar.style.transform = `scaleX(${ratio})`;
}

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();


function setActiveScene(sceneId) {
  if (sceneId) document.body.dataset.scene = sceneId;
  const targetId = sceneAnchorMap[sceneId] || "top";
  chapterLinks.forEach((link) => {
    const href = link.getAttribute("href")?.replace("#", "");
    link.classList.toggle("is-active", href === targetId);
  });
}

setActiveScene("hero");

const svgNS = "http://www.w3.org/2000/svg";

function decadeTicks(years) {
  const ticks = years.filter((year) => year % 10 === 0);
  if (years.length && years[0] % 10 !== 0) ticks.unshift(years[0]);
  const last = years[years.length - 1];
  if (last && last % 10 !== 0) ticks.push(last);
  return ticks;
}

function createSvg(container) {
  container.innerHTML = "";
  const svg = document.createElementNS(svgNS, "svg");
  container.appendChild(svg);
  return svg;
}

function createGroup(parent, className) {
  const g = document.createElementNS(svgNS, "g");
  if (className) g.setAttribute("class", className);
  parent.appendChild(g);
  return g;
}

function createPath(parent, className) {
  const path = document.createElementNS(svgNS, "path");
  if (className) path.setAttribute("class", className);
  parent.appendChild(path);
  return path;
}

function createLine(parent, className) {
  const line = document.createElementNS(svgNS, "line");
  if (className) line.setAttribute("class", className);
  parent.appendChild(line);
  return line;
}

function createRect(parent, className) {
  const rect = document.createElementNS(svgNS, "rect");
  if (className) rect.setAttribute("class", className);
  parent.appendChild(rect);
  return rect;
}

function createText(parent, className) {
  const text = document.createElementNS(svgNS, "text");
  if (className) text.setAttribute("class", className);
  parent.appendChild(text);
  return text;
}

function scaleLinear(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0 || 1);
  return (v) => r0 + (v - d0) * m;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function linePath(data, x, y, key) {
  return data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d[key])}`)
    .join(" ");
}

function areaPath(data, x, y, key, baseY) {
  const top = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d[key])}`).join(" ");
  const bottom = data
    .slice()
    .reverse()
    .map((d, i) => `${i === 0 ? "L" : "L"} ${x(d.year)} ${baseY}`)
    .join(" ");
  return `${top} ${bottom} Z`;
}

function drawAxis(group, scale, ticks, orient, length, format = (value) => String(value)) {
  group.innerHTML = "";
  const tickCount = ticks.length;
  ticks.forEach((t) => {
    const g = createGroup(group, "axis__tick");
    const line = document.createElementNS(svgNS, "line");
    const pos = scale(t);
    if (orient === "bottom") {
      line.setAttribute("x1", pos);
      line.setAttribute("x2", pos);
      line.setAttribute("y1", 0);
      line.setAttribute("y2", 6);
    } else {
      line.setAttribute("x1", 0);
      line.setAttribute("x2", -6);
      line.setAttribute("y1", pos);
      line.setAttribute("y2", pos);
    }
    g.appendChild(line);

    const label = createText(g, "axis__label");
    if (orient === "bottom") {
      label.setAttribute("x", pos);
      label.setAttribute("y", 20);
      label.setAttribute("text-anchor", "middle");
    } else {
      label.setAttribute("x", -10);
      label.setAttribute("y", pos + 4);
      label.setAttribute("text-anchor", "end");
    }
    label.textContent = format(t);
  });

  const axisLine = document.createElementNS(svgNS, "line");
  if (orient === "bottom") {
    axisLine.setAttribute("x1", 0);
    axisLine.setAttribute("x2", length);
    axisLine.setAttribute("y1", 0);
    axisLine.setAttribute("y2", 0);
  } else {
    axisLine.setAttribute("x1", 0);
    axisLine.setAttribute("x2", 0);
    axisLine.setAttribute("y1", 0);
    axisLine.setAttribute("y2", length);
  }
  group.appendChild(axisLine);
}

function createProductChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisY = createGroup(root, "axis axis--y");
  const axisYAlt = createGroup(root, "axis axis--y axis--y-alt");
  const axisLabelMain = createText(root, "axis-label axis-label--main");
  const axisLabelAlt = createText(root, "axis-label axis-label--alt");
  const controls = container.closest(".scene__visual")?.querySelector(".chart__controls");

  const confidenceBand = createRect(root, "confidence-band");
  const confidenceLabel = createGroup(root, "confidence-label");
  const confidenceLine = createLine(confidenceLabel, "confidence-line");
  const confidenceText = createText(confidenceLabel, "confidence-text");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-rhythms");

  const series = [
    { key: "sperm", className: "line line--sperm", label: "Спермацет" },
    { key: "whale", className: "line line--whale", label: "Ворвань" },
    { key: "baleen", className: "line line--baleen", label: "Китовый ус" },
  ];

  const lines = Object.fromEntries(series.map((s) => [s.key, createPath(root, s.className)]));
  const peakGroup = createGroup(root, "peak-group");
  const peaks = {};

  series.forEach((s) => {
    const group = createGroup(peakGroup, `peak peak--${s.key}`);
    const leader = createLine(group, "peak__line");
    const halo = document.createElementNS(svgNS, "circle");
    halo.setAttribute("class", "peak__halo");
    group.appendChild(halo);
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("class", "peak__dot");
    group.appendChild(dot);
    const arrow = createPath(group, "peak__arrow");
    const label = createText(group, "peak__label");
    peaks[s.key] = { group, leader, halo, dot, arrow, label };
  });

  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  const focusDots = {};
  series.forEach((s) => {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("class", `focus-dot focus-dot--${s.key}`);
    focusGroup.appendChild(dot);
    focusDots[s.key] = dot;
  });
  focusGroup.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 } };
  let mode = "index";
  let currentStep = 0;
  let currentData = [];
  let currentYMax = { main: 1, alt: 1 };
  let isAnimating = false;
  let hoverKey = null;
  let activeFilter = null;
  let currentScales = null;
  let currentFrameData = [];

  const indexData = DATA.productsIndex || DATA.products || [];
  const absData = DATA.productsAbs || indexData;
  const years = (indexData.length ? indexData : absData).map((d) => d.year);

  function getData() {
    return mode === "absolute" ? absData : indexData;
  }

  function seriesArrays(data) {
    return {
      sperm: data.map((d) => d.sperm),
      whale: data.map((d) => d.whale),
      baleen: data.map((d) => d.baleen),
    };
  }

  function buildDataFromArrays(arrays) {
    return years.map((year, i) => ({
      year,
      sperm: arrays.sperm[i] ?? 0,
      whale: arrays.whale[i] ?? 0,
      baleen: arrays.baleen[i] ?? 0,
    }));
  }

  function formatAxisValue(value) {
    const rounded = Math.round(value);
    if (!Number.isFinite(rounded)) return "";
    return rounded.toLocaleString("ru-RU");
  }

  function formatValue(value) {
    if (!Number.isFinite(value)) return "";
    const decimals = mode === "absolute" ? 1 : 0;
    return value.toFixed(decimals).replace(".", ",");
  }

  function visibleKeys() {
    return activeFilter ? [activeFilter] : series.map((s) => s.key);
  }

  function computeYBounds(data, nextMode = mode) {
    if (!data.length) return { main: 1, alt: 1 };
    const maxS = Math.max(...data.map((d) => d.sperm));
    const maxW = Math.max(...data.map((d) => d.whale));
    const maxB = Math.max(...data.map((d) => d.baleen));
    if (nextMode === "absolute") {
      return {
        main: Math.max(1, Math.max(maxS, maxW) * 1.08),
        alt: Math.max(1, maxB * 1.08),
      };
    }
    const maxAll = Math.max(maxS, maxW, maxB);
    const overall = Math.max(1, maxAll * 1.08);
    return { main: overall, alt: overall };
  }

  function computePeaks(data) {
    const result = {};
    series.forEach((s) => {
      let peak = { year: null, value: -Infinity };
      data.forEach((d) => {
        if (d[s.key] > peak.value) peak = { year: d.year, value: d[s.key] };
      });
      result[s.key] = peak;
    });
    return result;
  }

  function renderFrame(data, yBounds) {
    if (!data.length) return;
    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, size.w - size.m.right]);
    const innerH = size.h - size.m.top - size.m.bottom;
    let topY0 = size.m.top;
    let topH = innerH;
    let bottomY0 = size.m.top;
    let bottomH = innerH;
    if (mode === "absolute") {
      const gap = Math.max(24, innerH * 0.06);
      const bottomMin = 90;
      const topMin = 160;
      topH = Math.max(topMin, innerH * 0.64);
      bottomH = innerH - topH - gap;
      if (bottomH < bottomMin) {
        bottomH = bottomMin;
        topH = Math.max(topMin, innerH - bottomH - gap);
      }
      bottomY0 = topY0 + topH + gap;
    }
    const yMainLocal = scaleLinear([0, yBounds.main], [topH, 0]);
    const yAltLocal = scaleLinear([0, yBounds.alt], [bottomH, 0]);
    const yMain = (v) => topY0 + yMainLocal(v);
    const yAlt = (v) => bottomY0 + yAltLocal(v);
    currentScales = {
      x,
      yMain,
      yAlt,
      panels: {
        top: { y0: topY0, y1: topY0 + topH },
        bottom: { y0: bottomY0, y1: bottomY0 + bottomH },
      },
    };
    currentFrameData = data;

    const band = DATA.confidenceBand;
    if (band && band.start && band.end) {
      const x0 = x(Math.max(years[0], band.start));
      const x1 = x(Math.min(years[years.length - 1], band.end));
      confidenceBand.setAttribute("x", Math.min(x0, x1));
      confidenceBand.setAttribute("y", size.m.top);
      confidenceBand.setAttribute("width", Math.abs(x1 - x0));
      confidenceBand.setAttribute("height", size.h - size.m.top - size.m.bottom);
      confidenceBand.style.opacity = "1";

      const bandX = Math.min(x0, x1);
      const bandY = size.m.top;
      const bandH = size.h - size.m.top - size.m.bottom;
      const lineX = bandX + 6;
      confidenceLine.setAttribute("x1", lineX);
      confidenceLine.setAttribute("y1", bandY);
      confidenceLine.setAttribute("x2", lineX);
      confidenceLine.setAttribute("y2", bandY + bandH);
      const labelX = bandX + 16;
      const labelY = bandY + bandH * 0.5;
      confidenceText.setAttribute("x", labelX);
      confidenceText.setAttribute("y", labelY);
      confidenceText.setAttribute("text-anchor", "middle");
      confidenceText.setAttribute("transform", `rotate(-90 ${labelX} ${labelY})`);
      confidenceText.textContent = "низкая уверенность данных";
      confidenceLabel.style.opacity = "0.7";
    } else {
      confidenceBand.style.opacity = "0";
      confidenceLabel.style.opacity = "0";
    }

    Object.keys(lines).forEach((key) => {
      const yScale = mode === "absolute" && key === "baleen" ? yAlt : yMain;
      lines[key].setAttribute("d", linePath(data, x, yScale, key));
    });

    const peakData = computePeaks(data);
    const offsets = { sperm: [14, -18], whale: [14, 20], baleen: [14, -14] };

    Object.entries(peakData).forEach(([key, peak]) => {
      const target = peaks[key];
      if (!target || peak.value <= 0) {
        if (target) target.group.style.opacity = "0";
        return;
      }
      const px = x(peak.year);
      const yScale = mode === "absolute" && key === "baleen" ? yAlt : yMain;
      const py = yScale(peak.value);
      target.group.style.opacity = "1";
      target.halo.setAttribute("cx", px);
      target.halo.setAttribute("cy", py);
      target.halo.setAttribute("r", "9");
      target.dot.setAttribute("cx", px);
      target.dot.setAttribute("cy", py);
      target.dot.setAttribute("r", "4");
      const [dx, dy] = offsets[key] || [12, -12];
      const lx = px + dx;
      const ly = py + dy;
      target.leader.setAttribute("x1", px);
      target.leader.setAttribute("y1", py);
      target.leader.setAttribute("x2", lx - 4);
      target.leader.setAttribute("y2", ly - 2);
      target.label.setAttribute("x", lx);
      target.label.setAttribute("y", ly);
      target.label.textContent = `${peak.year}`;

      const vx = px - lx;
      const vy = py - ly;
      const vlen = Math.hypot(vx, vy) || 1;
      const ux = vx / vlen;
      const uy = vy / vlen;
      const tipX = lx + ux * 2;
      const tipY = ly + uy * 2;
      const baseX = tipX - ux * 6;
      const baseY = tipY - uy * 6;
      const perpX = -uy;
      const perpY = ux;
      const size = 3.5;
      const p1x = baseX + perpX * size;
      const p1y = baseY + perpY * size;
      const p2x = baseX - perpX * size;
      const p2y = baseY - perpY * size;
      target.arrow.setAttribute("d", `M ${tipX} ${tipY} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`);
    });

    axisX.setAttribute("transform", `translate(0 ${size.h - size.m.bottom})`);
    axisY.setAttribute("transform", `translate(${size.m.left} ${topY0})`);
    axisYAlt.setAttribute("transform", `translate(${size.m.left} ${bottomY0})`);

    drawAxis(axisX, x, decadeTicks(years), "bottom", size.w - size.m.left - size.m.right);
    drawAxis(
      axisY,
      yMainLocal,
      [0, Math.round(yBounds.main / 2), Math.round(yBounds.main)],
      "left",
      topH,
      formatAxisValue,
    );
    axisLabelMain.setAttribute("x", size.m.left - 12);
    axisLabelMain.setAttribute("y", topY0 + 4);
    axisLabelMain.setAttribute("text-anchor", "end");
    axisLabelMain.textContent = mode === "absolute" ? "тыс. барр." : "Индекс (база=100)";
    if (mode === "absolute") {
      axisYAlt.style.opacity = "1";
      drawAxis(
        axisYAlt,
        yAltLocal,
        [0, Math.round(yBounds.alt / 2), Math.round(yBounds.alt)],
        "left",
        bottomH,
        formatAxisValue,
      );
      axisLabelAlt.style.opacity = "1";
      axisLabelAlt.setAttribute("x", size.m.left - 12);
      axisLabelAlt.setAttribute("y", bottomY0 + 4);
      axisLabelAlt.setAttribute("text-anchor", "end");
      axisLabelAlt.textContent = "тыс. фунтов";
    } else {
      axisYAlt.style.opacity = "0";
      axisLabelAlt.style.opacity = "0";
      axisLabelAlt.textContent = "";
    }

  }

  function updateNote(step, activeKey) {
    const baseYears = DATA.productsMeta?.baseYears;
    const baseNote = baseYears
      ? `База индекса: спермацет ${baseYears.sperm}, ворвань ${baseYears.whale}, ус ${baseYears.baleen}.`
      : "";
    const absNote = "Абсолютные объёмы показаны в двух шкалах: спермацет/ворвань в тыс. баррелей, ус в тыс. фунтов.";

    const notesIndex = [
      "Индекс фиксирует ритм каждой линии, не её абсолютный масштаб.",
      "Спермацет достигает пика заметно раньше других линий.",
      "Китовый ус формирует поздний и длительный максимум.",
      "Промысел живёт несколькими темпами одновременно.",
    ];
    const notesAbs = [
      "Абсолютные объёмы показывают материальный масштаб добычи.",
      "Ранний пик спермацета виден и в объёмах.",
      "Китовый ус позже выходит в максимум.",
      "Масштаб и ритм расходятся: линии не синхронны.",
    ];
    const lead = mode === "absolute" ? notesAbs[step] || notesAbs[0] : notesIndex[step] || notesIndex[0];
    const tail =
      mode === "absolute"
        ? absNote
        : `Нормированный рост: каждая линия приведена к своему старту; базовый год = 100, далее видно относительное изменение. ${baseNote}`.trim();
    const dataForNote = mode === "absolute" ? absData : indexData;
    const peakData = computePeaks(dataForNote);
    const labelMap = { sperm: "Спермацет", whale: "Ворвань", baleen: "Китовый ус" };
    let peakNote = "";
    if (activeKey && peakData[activeKey]?.year) {
      peakNote = `Пик: ${labelMap[activeKey]} — ${peakData[activeKey].year}.`;
    } else if (!activeKey && peakData.sperm?.year && peakData.whale?.year && peakData.baleen?.year) {
      peakNote = `Пики: спермацет ${peakData.sperm.year}, ворвань ${peakData.whale.year}, ус ${peakData.baleen.year}.`;
    }
    const parts = [lead, peakNote, tail].filter(Boolean);
    if (noteEl) noteEl.textContent = parts.join(" ");
  }

  function applyEmphasis(emphasis) {
    const focusKey = emphasis || activeFilter;
    Object.keys(lines).forEach((key) => {
      const isFilteredOut = activeFilter && key !== activeFilter;
      const isEmphasis = focusKey ? key === focusKey : false;
      lines[key].style.pointerEvents = isFilteredOut ? "none" : "auto";
      if (focusKey) {
        lines[key].style.opacity = isEmphasis ? "1" : isFilteredOut ? "0.08" : "0.4";
        lines[key].style.strokeWidth = isEmphasis ? "1.6" : "1.0";
      } else {
        lines[key].style.opacity = isFilteredOut ? "0.2" : "0.85";
        lines[key].style.strokeWidth = isFilteredOut ? "0.9" : "1.2";
      }
    });
    Object.keys(peaks).forEach((key) => {
      if (focusKey) {
        const isEmphasis = key === focusKey;
        peaks[key].group.style.opacity = isEmphasis ? "0.75" : "0";
        peaks[key].label.style.opacity = isEmphasis ? "1" : "0";
        peaks[key].leader.style.opacity = isEmphasis ? "0.5" : "0";
        peaks[key].arrow.style.opacity = isEmphasis ? "0.4" : "0";
        peaks[key].halo.style.opacity = isEmphasis ? "0.35" : "0";
      } else {
        peaks[key].group.style.opacity = "0.25";
        peaks[key].label.style.opacity = "0";
        peaks[key].leader.style.opacity = "0.2";
        peaks[key].arrow.style.opacity = "0.2";
        peaks[key].halo.style.opacity = "0.2";
      }
    });
  }

  function update(step) {
    currentStep = step;
    const focusMap = { 0: null, 1: "sperm", 2: "baleen", 3: "whale" };
    const focus = focusMap[step] ?? null;
    const emphasis = hoverKey ?? focus ?? activeFilter;
    applyEmphasis(emphasis);
    updateNote(step, emphasis || activeFilter);
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    if (isAnimating) return;
    const nextData = nextMode === "absolute" ? absData : indexData;
    if (!nextData.length) return;

    const startData = currentData.length ? currentData : getData();
    const startYMax = currentYMax || computeYBounds(startData, mode);
    const targetYMax = computeYBounds(nextData, nextMode);
    const startArrays = seriesArrays(startData);
    const targetArrays = seriesArrays(nextData);
    const duration = 700;
    const start = performance.now();

    isAnimating = true;
    mode = nextMode;
    updateToggles();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const interpArrays = {
        sperm: startArrays.sperm.map((v, i) => lerp(v, targetArrays.sperm[i], eased)),
        whale: startArrays.whale.map((v, i) => lerp(v, targetArrays.whale[i], eased)),
        baleen: startArrays.baleen.map((v, i) => lerp(v, targetArrays.baleen[i], eased)),
      };
      const frameData = buildDataFromArrays(interpArrays);
      const frameYMax = {
        main: lerp(startYMax.main, targetYMax.main, eased),
        alt: lerp(startYMax.alt, targetYMax.alt, eased),
      };
      renderFrame(frameData, frameYMax);
      update(currentStep);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        currentData = nextData;
        currentYMax = targetYMax;
        isAnimating = false;
        renderFrame(currentData, currentYMax);
        update(currentStep);
      }
    };

    requestAnimationFrame(tick);
  }

  function updateToggles() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function resize() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m, gap: size.gap };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    currentData = getData();
    currentYMax = computeYBounds(currentData, mode);
    renderFrame(currentData, currentYMax);
  }

  if (controls) {
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "absolute" ? "absolute" : "index";
        setMode(nextMode);
      });
    });
  }


  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = activeFilter && key !== activeFilter;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        hoverKey = null;
        updateLegend();
        update(currentStep);
      });
    });
    updateLegend();
  }

  function findNearestPoint(pixelX) {
    const data = currentFrameData.length ? currentFrameData : getData();
    if (!data.length) return null;
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = data[0];
    let minDiff = Math.abs(nearest.year - year);
    data.forEach((d) => {
      const diff = Math.abs(d.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    });
    return nearest;
  }

  function updateTooltip(point, pixelX) {
    if (!currentScales || !point) return;
    const { x, yMain, yAlt } = currentScales;
    const yForKey = (key) => (mode === "absolute" && key === "baleen" ? yAlt : yMain);
    const xPos = x(point.year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", size.m.top);
    focusLine.setAttribute("y2", size.h - size.m.bottom);

    const keys = visibleKeys();
    keys.forEach((key) => {
      const dot = focusDots[key];
      if (!dot) return;
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", yForKey(key)(point[key]));
      dot.setAttribute("r", "4");
      dot.style.opacity = "1";
    });
    Object.keys(focusDots).forEach((key) => {
      if (!keys.includes(key)) focusDots[key].style.opacity = "0";
    });

    if (tooltipTitle && tooltipRows) {
      tooltipTitle.textContent = `${point.year}`;
      tooltipRows.innerHTML = "";
      keys.forEach((key) => {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = `chart__tooltip-swatch chart__tooltip-swatch--${key}`;
        label.appendChild(swatch);
        label.appendChild(document.createTextNode(series.find((s) => s.key === key)?.label || key));
        const value = document.createElement("div");
        let suffix = "";
        if (mode === "absolute") {
          suffix = key === "baleen" ? " тыс. фунтов" : " тыс. барр.";
        }
        value.textContent = `${formatValue(point[key])}${suffix}`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      });
    }

    const rect = container.getBoundingClientRect();
    let left = (xPos / size.w) * rect.width;
    const primaryKey = (hoverKey && keys.includes(hoverKey) && hoverKey) || keys[0];
    const yPos = yForKey(primaryKey)(point[primaryKey] ?? point[keys[0]]);
    let top = (yPos / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    focusGroup.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  }

  svg.addEventListener("mousemove", (event) => {
    if (!currentScales) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const point = findNearestPoint(pixelX);
    updateTooltip(point, pixelX);
  });

  svg.addEventListener("mouseleave", hideTooltip);

  Object.entries(lines).forEach(([key, path]) => {
    path.addEventListener("mouseenter", () => {
      hoverKey = key;
      update(currentStep);
    });
    path.addEventListener("mouseleave", () => {
      hoverKey = null;
      update(currentStep);
    });
  });

  resize();
  update(0);
  updateToggles();
  return { resize, update, setMode };
}

function stackedAreaPath(points, x, y) {
  const top = points.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.y1)}`).join(" ");
  const bottom = points
    .slice()
    .reverse()
    .map((d, i) => `${i === 0 ? "L" : "L"} ${x(d.year)} ${y(d.y0)}`)
    .join(" ");
  return `${top} ${bottom} Z`;
}

function createShareChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  focusGroup.style.opacity = "0";

  const phases = DATA.productPhases;
  if (!phases || !phases.years || !phases.series) return { resize: () => {}, update: () => {} };

  const years = phases.years;
  const series = [
    { key: "sperm", label: "Спермацет", unit: "баррели" },
    { key: "baleen", label: "Китовый ус", unit: "фунты" },
    { key: "whale", label: "Ворвань", unit: "баррели" },
  ];

  const panels = {};
  series.forEach((s) => {
    const group = createGroup(root, `phase-panel phase-panel--${s.key}`);
    const axisY = createGroup(group, "axis axis--y");
    const gridLines = [createLine(group, "phase-grid"), createLine(group, "phase-grid"), createLine(group, "phase-grid")];
    const gridLabels = [createText(group, "phase-axis"), createText(group, "phase-axis"), createText(group, "phase-axis")];
    const rawLine = createPath(group, "phase-line phase-line--raw");
    const smoothLine = createPath(group, "phase-line phase-line--smooth");
    const label = createText(group, "phase-label");
    const unit = createText(group, "phase-unit");
    const peakDot = document.createElementNS(svgNS, "circle");
    peakDot.setAttribute("class", "phase-peak");
    group.appendChild(peakDot);
    const peakLabel = createText(group, "phase-peak-label");
    const growthLine = createLine(group, "phase-marker phase-marker--growth");
    const growthLabel = createText(group, "phase-marker__label");
    const declineLine = createLine(group, "phase-marker phase-marker--decline");
    const declineLabel = createText(group, "phase-marker__label");
    panels[s.key] = {
      group,
      axisY,
      gridLines,
      gridLabels,
      rawLine,
      smoothLine,
      label,
      unit,
      peakDot,
      peakLabel,
      growthLine,
      growthLabel,
      declineLine,
      declineLabel,
    };
  });

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 80 }, gap: 22 };
  let currentStep = 0;
  let currentScale = null;
  let currentYear = null;
  let hoverYear = null;

  function buildSeriesData(key) {
    const raw = phases.series[key]?.raw || [];
    const smooth = phases.series[key]?.smooth || [];
    return years.map((year, i) => ({ year, value: raw[i] ?? 0, smooth: smooth[i] ?? 0 }));
  }

  function formatValue(value) {
    if (!Number.isFinite(value)) return "";
    return Math.round(value).toLocaleString("ru-RU");
  }

  function render() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size.w = w;
    size.h = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    currentScale = x;
    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);

    const panelCount = series.length;
    const panelHeight = (h - size.m.top - size.m.bottom - size.gap * (panelCount - 1)) / panelCount;

    series.forEach((s, i) => {
      const panel = panels[s.key];
      const data = buildSeriesData(s.key);
      const top = size.m.top + i * (panelHeight + size.gap);
      const bottom = top + panelHeight;
      const maxVal = Math.max(...data.map((d) => d.value), 1);
      const y = scaleLinear([0, maxVal * 1.08], [bottom, top]);

      const gridValues = [maxVal, maxVal * 0.5, 0];
      gridValues.forEach((val, idx) => {
        const line = panel.gridLines[idx];
        const label = panel.gridLabels[idx];
        const yy = y(val);
        line.setAttribute("x1", size.m.left);
        line.setAttribute("x2", w - size.m.right);
        line.setAttribute("y1", yy);
        line.setAttribute("y2", yy);
        label.setAttribute("x", size.m.left - 10);
        label.setAttribute("y", yy + 4);
        label.setAttribute("text-anchor", "end");
        label.textContent = formatValue(val);
      });

      panel.label.setAttribute("x", size.m.left);
      panel.label.setAttribute("y", top + 14);
      panel.label.textContent = s.label;
      panel.unit.setAttribute("x", w - size.m.right);
      panel.unit.setAttribute("y", top + 14);
      panel.unit.setAttribute("text-anchor", "end");
      panel.unit.textContent = s.unit;

      panel.rawLine.setAttribute("d", linePath(data, x, y, "value"));
      panel.smoothLine.setAttribute("d", linePath(data, x, y, "smooth"));

      const peak = phases.series[s.key]?.peak;
      if (peak?.year) {
        const peakIdx = years.indexOf(peak.year);
        const peakVal = phases.series[s.key]?.smooth?.[peakIdx] ?? peak.value ?? 0;
        const px = x(peak.year);
        const py = y(peakVal);
        panel.peakDot.setAttribute("cx", px);
        panel.peakDot.setAttribute("cy", py);
        panel.peakDot.setAttribute("r", "4");
        panel.peakLabel.setAttribute("x", px + 6);
        panel.peakLabel.setAttribute("y", py - 6);
        panel.peakLabel.textContent = `${peak.year}`;
        panel.peakDot.style.opacity = "1";
        panel.peakLabel.style.opacity = "1";
      } else {
        panel.peakDot.style.opacity = "0";
        panel.peakLabel.style.opacity = "0";
      }

      const growthStart = phases.series[s.key]?.growthStart;
      if (growthStart) {
        const gx = x(growthStart);
        panel.growthLine.setAttribute("x1", gx);
        panel.growthLine.setAttribute("x2", gx);
        panel.growthLine.setAttribute("y1", top);
        panel.growthLine.setAttribute("y2", bottom);
        panel.growthLabel.setAttribute("x", gx + 4);
        panel.growthLabel.setAttribute("y", top + 12);
        panel.growthLabel.textContent = "рост";
        panel.growthLine.style.opacity = "1";
        panel.growthLabel.style.opacity = "1";
      } else {
        panel.growthLine.style.opacity = "0";
        panel.growthLabel.style.opacity = "0";
      }

      const declineStart = phases.series[s.key]?.declineStart;
      if (declineStart) {
        const dx = x(declineStart);
        panel.declineLine.setAttribute("x1", dx);
        panel.declineLine.setAttribute("x2", dx);
        panel.declineLine.setAttribute("y1", top);
        panel.declineLine.setAttribute("y2", bottom);
        panel.declineLabel.setAttribute("x", dx + 4);
        panel.declineLabel.setAttribute("y", bottom - 6);
        panel.declineLabel.textContent = "спад";
        panel.declineLine.style.opacity = "1";
        panel.declineLabel.style.opacity = "1";
      } else {
        panel.declineLine.style.opacity = "0";
        panel.declineLabel.style.opacity = "0";
      }
    });

    if (currentYear !== null) {
      const xPos = x(currentYear);
      focusLine.setAttribute("x1", xPos);
      focusLine.setAttribute("x2", xPos);
      focusLine.setAttribute("y1", size.m.top);
      focusLine.setAttribute("y2", h - size.m.bottom);
      focusGroup.style.opacity = "1";
    } else {
      focusGroup.style.opacity = "0";
    }
  }

  function update(step) {
    currentStep = step;
    if (noteEl) {
      noteEl.textContent =
        "Каждая линия показана отдельно. Тонкая линия — сырой годовой ряд; жирная — 5‑летняя скользящая средняя (центрированное окно). Пик — максимум сглаженного ряда; «рост» фиксирует начало устойчивого подъёма, «спад» — начало устойчивого снижения после пика. Здесь нет долей и смешения единиц: только внутренняя динамика каждой товарной линии.";
    }
  }

  function findNearestYear(pixelX) {
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = years[0];
    let minDiff = Math.abs(nearest - year);
    years.forEach((y) => {
      const diff = Math.abs(y - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = y;
      }
    });
    return nearest;
  }

  function updateTooltip(year, clientX, clientY) {
    if (!tooltipTitle || !tooltipRows) return;
    const idx = years.indexOf(year);
    if (idx < 0) return;
    tooltipTitle.textContent = `${year}`;
    tooltipRows.innerHTML = "";
    series.forEach((s) => {
      const row = document.createElement("div");
      row.className = "chart__tooltip-row";
      const label = document.createElement("div");
      label.className = "chart__tooltip-label";
      const swatch = document.createElement("span");
      swatch.className = `chart__tooltip-swatch chart__tooltip-swatch--${s.key}`;
      label.appendChild(swatch);
      label.appendChild(document.createTextNode(s.label));
      const value = document.createElement("div");
      const raw = phases.series[s.key]?.raw?.[idx] ?? 0;
      const smooth = phases.series[s.key]?.smooth?.[idx] ?? 0;
      value.textContent = `${formatValue(raw)} · ср.5 ${formatValue(smooth)}`;
      row.appendChild(label);
      row.appendChild(value);
      tooltipRows.appendChild(row);
    });

    const rect = container.getBoundingClientRect();
    let left = clientX - rect.left;
    let top = clientY - rect.top;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
  }

  svg.addEventListener("mousemove", (event) => {
    if (!currentScale) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    hoverYear = findNearestYear(pixelX);
    currentYear = hoverYear;
    updateTooltip(hoverYear, event.clientX, event.clientY);
    render();
  });

  svg.addEventListener("mouseleave", () => {
    hoverYear = null;
    currentYear = null;
    hideTooltip();
    render();
  });

  render();
  update(0);
  return { resize: render, update };
}

function createYieldChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  focusGroup.style.opacity = "0";

  const panelsRoot = createGroup(root, "yield-panels");
  const compositeRoot = createGroup(root, "yield-composite");

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  const controls = container.closest(".scene__visual")?.querySelector("#controls-yield");

  const data = DATA.voyageProductivity;
  if (!data || !data.years || !data.series) {
    return { resize: () => {}, update: () => {} };
  }

  const years = data.years;
  const counts = data.N || [];
  const seriesMeta = [
    {
      key: "sperm",
      label: "Спермацет",
      unit: "баррели",
      panelClass: "phase-panel--sperm",
      focusClass: "focus-dot--sperm",
      swatchClass: "chart__tooltip-swatch--sperm",
    },
    {
      key: "whale",
      label: "Ворвань",
      unit: "баррели",
      panelClass: "phase-panel--whale",
      focusClass: "focus-dot--whale",
      swatchClass: "chart__tooltip-swatch--whale",
    },
    {
      key: "baleen",
      label: "Китовый ус",
      unit: "фунты",
      panelClass: "phase-panel--baleen",
      focusClass: "focus-dot--baleen",
      swatchClass: "chart__tooltip-swatch--baleen",
    },
  ];

  const seriesData = {};
  seriesMeta.forEach((meta) => {
    const s = data.series?.[meta.key];
    if (!s) return;
    seriesData[meta.key] = years.map((year, i) => ({
      year,
      mean: s.mean?.[i] ?? 0,
      median: s.median?.[i] ?? 0,
      p10: s.p10?.[i] ?? 0,
      p90: s.p90?.[i] ?? 0,
      smooth: s.smooth?.[i] ?? 0,
    }));
  });

  const compositeData = years.map((year, i) => ({
    year,
    mean: data.composite?.index?.[i] ?? 0,
    smooth: data.composite?.smooth?.[i] ?? 0,
  }));

  function createPanel(parent, className) {
    const group = createGroup(parent, `phase-panel ${className}`);
    const axisY = createGroup(group, "axis axis--y");
    const gridLines = [createLine(group, "phase-grid"), createLine(group, "phase-grid"), createLine(group, "phase-grid")];
    const gridLabels = [createText(group, "phase-axis"), createText(group, "phase-axis"), createText(group, "phase-axis")];
    const rawLine = createPath(group, "phase-line phase-line--raw");
    const smoothLine = createPath(group, "phase-line phase-line--smooth");
    const label = createText(group, "phase-label");
    const unit = createText(group, "phase-unit");
    const peakDot = document.createElementNS(svgNS, "circle");
    peakDot.setAttribute("class", "phase-peak");
    group.appendChild(peakDot);
    const peakLabel = createText(group, "phase-peak-label");
    const growthLine = createLine(group, "phase-marker phase-marker--growth");
    const growthLabel = createText(group, "phase-marker__label");
    const declineLine = createLine(group, "phase-marker phase-marker--decline");
    const declineLabel = createText(group, "phase-marker__label");
    return {
      group,
      axisY,
      gridLines,
      gridLabels,
      rawLine,
      smoothLine,
      label,
      unit,
      peakDot,
      peakLabel,
      growthLine,
      growthLabel,
      declineLine,
      declineLabel,
    };
  }

  const panels = {};
  seriesMeta.forEach((meta) => {
    panels[meta.key] = createPanel(panelsRoot, meta.panelClass);
  });

  const compositePanel = createPanel(compositeRoot, "phase-panel--composite");

  const focusDots = {};
  seriesMeta.forEach((meta) => {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("class", `focus-dot ${meta.focusClass}`);
    focusGroup.appendChild(dot);
    focusDots[meta.key] = dot;
  });
  const compositeDot = document.createElementNS(svgNS, "circle");
  compositeDot.setAttribute("class", "focus-dot focus-dot--yield");
  focusGroup.appendChild(compositeDot);

  let size = { w: 0, h: 0, m: { top: 70, right: 60, bottom: 60, left: 80 }, gap: 22 };
  let currentStep = 0;
  let mode = "separate";
  let panelLayout = {};
  let currentScale = null;

  function formatValue(value, isComposite = false) {
    if (!Number.isFinite(value)) return "";
    if (isComposite) return value.toFixed(2).replace(".", ",");
    if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("ru-RU");
    if (Math.abs(value) >= 100) return value.toFixed(0).replace(".", ",");
    return value.toFixed(1).replace(".", ",");
  }

  function findNearestYear(pixelX) {
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = years[0];
    let minDiff = Math.abs(nearest - year);
    years.forEach((y) => {
      const diff = Math.abs(y - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = y;
      }
    });
    return nearest;
  }

  function renderPanel(panel, meta, dataPoints, top, bottom, x, maxVal, phase, isComposite = false) {
    const y = scaleLinear([0, maxVal * 1.08], [bottom, top]);
    const gridValues = [maxVal, maxVal * 0.5, 0];
    gridValues.forEach((val, idx) => {
      const line = panel.gridLines[idx];
      const label = panel.gridLabels[idx];
      const yy = y(val);
      line.setAttribute("x1", size.m.left);
      line.setAttribute("x2", size.w - size.m.right);
      line.setAttribute("y1", yy);
      line.setAttribute("y2", yy);
      label.setAttribute("x", size.m.left - 10);
      label.setAttribute("y", yy + 4);
      label.setAttribute("text-anchor", "end");
      label.textContent = formatValue(val, isComposite);
    });

    panel.label.setAttribute("x", size.m.left);
    panel.label.setAttribute("y", top + 14);
    panel.label.textContent = meta.label;
    panel.unit.setAttribute("x", size.w - size.m.right);
    const unitOffset = isComposite ? 84 : 14;
    panel.unit.setAttribute("y", top + unitOffset);
    panel.unit.setAttribute("text-anchor", "end");
    panel.unit.textContent = meta.unit;

    panel.rawLine.setAttribute("d", linePath(dataPoints, x, y, "mean"));
    panel.smoothLine.setAttribute("d", linePath(dataPoints, x, y, "smooth"));

    const peak = phase?.peak;
    if (peak?.year) {
      const peakIdx = years.indexOf(peak.year);
      const peakVal = dataPoints[peakIdx]?.smooth ?? peak.value ?? 0;
      const px = x(peak.year);
      const py = y(peakVal);
      panel.peakDot.setAttribute("cx", px);
      panel.peakDot.setAttribute("cy", py);
      panel.peakDot.setAttribute("r", "4");
      panel.peakLabel.setAttribute("x", px + 6);
      panel.peakLabel.setAttribute("y", py - 6);
      panel.peakLabel.textContent = `${peak.year}`;
      panel.peakDot.style.opacity = "1";
      panel.peakLabel.style.opacity = "1";
    } else {
      panel.peakDot.style.opacity = "0";
      panel.peakLabel.style.opacity = "0";
    }

    const growthStart = phase?.growthStart;
    if (growthStart) {
      const gx = x(growthStart);
      panel.growthLine.setAttribute("x1", gx);
      panel.growthLine.setAttribute("x2", gx);
      panel.growthLine.setAttribute("y1", top);
      panel.growthLine.setAttribute("y2", bottom);
      panel.growthLabel.setAttribute("x", gx + 4);
      const growthOffset = isComposite ? 36 : meta.key === "sperm" ? 30 : 12;
      panel.growthLabel.setAttribute("y", top + growthOffset);
      panel.growthLabel.textContent = "рост";
      panel.growthLine.style.opacity = "1";
      panel.growthLabel.style.opacity = "1";
    } else {
      panel.growthLine.style.opacity = "0";
      panel.growthLabel.style.opacity = "0";
    }

    const declineStart = phase?.declineStart;
    if (declineStart) {
      const dx = x(declineStart);
      panel.declineLine.setAttribute("x1", dx);
      panel.declineLine.setAttribute("x2", dx);
      panel.declineLine.setAttribute("y1", top);
      panel.declineLine.setAttribute("y2", bottom);
      panel.declineLabel.setAttribute("x", dx + 4);
      panel.declineLabel.setAttribute("y", bottom - 6);
      panel.declineLabel.textContent = "спад";
      panel.declineLine.style.opacity = "1";
      panel.declineLabel.style.opacity = "1";
    } else {
      panel.declineLine.style.opacity = "0";
      panel.declineLabel.style.opacity = "0";
    }

    return y;
  }

  function render() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size.w = w;
    size.h = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    currentScale = x;
    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);

    panelLayout = {};

    if (mode === "composite") {
      panelsRoot.style.display = "none";
      compositeRoot.style.display = "";
      const top = size.m.top;
      const bottom = h - size.m.bottom;
      const maxVal = Math.max(...compositeData.map((d) => d.mean), 0.01);
      const y = renderPanel(
        compositePanel,
        { label: "Композитный индекс", unit: "нормированный (0–1)" },
        compositeData,
        top,
        bottom,
        x,
        maxVal,
        data.composite?.phase,
        true,
      );
      panelLayout.composite = { top, bottom, y, data: compositeData };
    } else {
      panelsRoot.style.display = "";
      compositeRoot.style.display = "none";
      const panelCount = seriesMeta.length;
      const panelHeight = (h - size.m.top - size.m.bottom - size.gap * (panelCount - 1)) / panelCount;
      seriesMeta.forEach((meta, i) => {
        const top = size.m.top + i * (panelHeight + size.gap);
        const bottom = top + panelHeight;
        const dataPoints = seriesData[meta.key] || [];
        const maxVal = Math.max(...dataPoints.map((d) => d.mean), 0.01);
        const y = renderPanel(
          panels[meta.key],
          meta,
          dataPoints,
          top,
          bottom,
          x,
          maxVal,
          data.series?.[meta.key]?.phase,
        );
        panelLayout[meta.key] = { top, bottom, y, data: dataPoints };
      });
    }
  }

  function updateNote() {
    if (!noteEl) return;
    const notes = [
      "Каждая линия показывает средний объём соответствующего продукта на один уникальный рейс (год возврата).",
      "Сглаживание — центрированная 5‑летняя скользящая средняя, позволяющая выделять фазы роста, пика и спада.",
      "Спермацет и ворвань заданы в баррелях, китовый ус — в фунтах; линии не складываются в один физический объём.",
    ];
    const base = notes[currentStep] || notes[0];
    if (mode === "composite") {
      noteEl.textContent = `${base} Композитный индекс — нормированная аналитическая величина, не равная физическому объёму.`;
    } else {
      noteEl.textContent = base;
    }
  }

  function update(step) {
    currentStep = step;
    updateNote();
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    mode = nextMode;
    updateControls();
    updateNote();
    hideTooltip();
    render();
  }

  if (controls) {
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "composite" ? "composite" : "separate";
        setMode(nextMode);
      });
    });
  }

  function updateTooltip(panelKey, year, clientX, clientY) {
    if (!tooltipTitle || !tooltipRows) return;
    const idx = years.indexOf(year);
    if (idx < 0) return;

    tooltipRows.innerHTML = "";

    if (panelKey === "composite") {
      tooltipTitle.textContent = `${year}`;
      const row = document.createElement("div");
      row.className = "chart__tooltip-row";
      const label = document.createElement("div");
      label.className = "chart__tooltip-label";
      const swatch = document.createElement("span");
      swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--yield";
      label.appendChild(swatch);
      label.appendChild(document.createTextNode("Композитный индекс"));
      const value = document.createElement("div");
      value.textContent = formatValue(compositeData[idx]?.mean ?? 0, true);
      row.appendChild(label);
      row.appendChild(value);
      tooltipRows.appendChild(row);
    } else {
      const meta = seriesMeta.find((s) => s.key === panelKey);
      const point = seriesData[panelKey]?.[idx];
      if (!meta || !point) return;
      tooltipTitle.textContent = `${year} • ${meta.label}`;
      const mainRow = document.createElement("div");
      mainRow.className = "chart__tooltip-row";
      const label = document.createElement("div");
      label.className = "chart__tooltip-label";
      const swatch = document.createElement("span");
      swatch.className = `chart__tooltip-swatch ${meta.swatchClass}`;
      label.appendChild(swatch);
      label.appendChild(document.createTextNode("Среднее"));
      const value = document.createElement("div");
      value.textContent = formatValue(point.mean);
      mainRow.appendChild(label);
      mainRow.appendChild(value);
      tooltipRows.appendChild(mainRow);

      const medianRow = document.createElement("div");
      medianRow.className = "chart__tooltip-row";
      medianRow.innerHTML = `<div class="chart__tooltip-label">Медиана</div><div>${formatValue(point.median)}</div>`;
      tooltipRows.appendChild(medianRow);

      const bandRow = document.createElement("div");
      bandRow.className = "chart__tooltip-row";
      bandRow.innerHTML = `<div class="chart__tooltip-label">P10–P90</div><div>${formatValue(point.p10)}–${formatValue(
        point.p90,
      )}</div>`;
      tooltipRows.appendChild(bandRow);
    }

    const count = counts[idx] ?? 0;
    const nRow = document.createElement("div");
    nRow.className = "chart__tooltip-row";
    nRow.innerHTML = `<div class="chart__tooltip-label">Рейсы</div><div>${count}</div>`;
    tooltipRows.appendChild(nRow);

    const rect = container.getBoundingClientRect();
    let left = clientX - rect.left;
    let top = clientY - rect.top;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
    focusGroup.style.opacity = "0";
    Object.values(focusDots).forEach((dot) => (dot.style.opacity = "0"));
    compositeDot.style.opacity = "0";
  }

  function updateFocus(panelKey, year) {
    if (!panelKey || year == null) return;
    const layout = panelLayout[panelKey];
    if (!layout || !currentScale) return;
    const idx = years.indexOf(year);
    if (idx < 0) return;
    const xPos = currentScale(year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", size.m.top);
    focusLine.setAttribute("y2", size.h - size.m.bottom);

    Object.values(focusDots).forEach((dot) => (dot.style.opacity = "0"));
    compositeDot.style.opacity = "0";

    const point = layout.data?.[idx];
    if (!point) return;
    const yPos = layout.y(point.mean ?? 0);

    if (panelKey === "composite") {
      compositeDot.setAttribute("cx", xPos);
      compositeDot.setAttribute("cy", yPos);
      compositeDot.setAttribute("r", "4.5");
      compositeDot.style.opacity = "1";
    } else if (focusDots[panelKey]) {
      const dot = focusDots[panelKey];
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", yPos);
      dot.setAttribute("r", "4.5");
      dot.style.opacity = "1";
    }
  }

  svg.addEventListener("mousemove", (event) => {
    if (!currentScale) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const scaleY = size.h / rect.height;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const pixelY = (event.clientY - rect.top) * scaleY;
    const year = findNearestYear(pixelX);

    let panelKey = "composite";
    if (mode === "separate") {
      panelKey = seriesMeta.find((meta) => {
        const layout = panelLayout[meta.key];
        return layout && pixelY >= layout.top && pixelY <= layout.bottom;
      })?.key;
    }
    if (!panelKey) {
      hideTooltip();
      return;
    }
    updateFocus(panelKey, year);
    updateTooltip(panelKey, year, event.clientX, event.clientY);
  });

  svg.addEventListener("mouseleave", hideTooltip);

  function resize() {
    render();
  }

  render();
  update(0);
  updateControls();
  return { resize, update };
}

function createDivergenceChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisYComposite = createGroup(root, "axis axis--y axis--y-composite");
  const axisYVoyage = createGroup(root, "axis axis--y axis--y-voyage");
  const confidenceBand = createRect(root, "confidence-band");
  const confidenceLabel = createGroup(root, "confidence-label");
  const confidenceLine = createLine(confidenceLabel, "confidence-line");
  const confidenceText = createText(confidenceLabel, "confidence-text");
  const lineCatch = createPath(root, "line line--catch");
  const lineVoy = createPath(root, "line line--voyage");
  const breakA = createLine(root, "break-line");
  const breakB = createLine(root, "break-line");
  const controls = container.closest(".scene__visual")?.querySelector("#controls-divergence");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-divergence");

  const peakGroups = {
    catch: (() => {
      const group = createGroup(root, "peak peak--catch");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
    voyage: (() => {
      const group = createGroup(root, "peak peak--voyage");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
  };

  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  const focusDots = {
    catch: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--catch");
      focusGroup.appendChild(dot);
      return dot;
    })(),
    voyage: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--voyage");
      focusGroup.appendChild(dot);
      return dot;
    })(),
  };
  focusGroup.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 }, gap: 26 };
  let mode = "smooth";
  let activeFilter = null;
  let currentScales = null;
  let currentData = [];
  let currentStep = 0;
  let hoverKey = null;
  let isAnimating = false;
  let panelLayout = null;

  const rawData = DATA.divergence || [];
  const years = rawData.map((d) => d.year);

  function smoothSeries(data, windowSize = 5) {
    if (!data.length) return [];
    const half = Math.floor(windowSize / 2);
    return data.map((d, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(data.length - 1, i + half);
      const slice = data.slice(start, end + 1);
      const avgCatch = slice.reduce((acc, v) => acc + v.compositeIndex, 0) / slice.length;
      const avgVoy = slice.reduce((acc, v) => acc + v.voyageIndex, 0) / slice.length;
      return { year: d.year, compositeIndex: avgCatch, voyageIndex: avgVoy };
    });
  }

  const smoothData = smoothSeries(rawData, 5);

  function getData() {
    return mode === "smooth" && smoothData.length ? smoothData : rawData;
  }

  function visibleKeys() {
    return activeFilter ? [activeFilter] : ["catch", "voyage"];
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = activeFilter && key !== activeFilter;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function applyEmphasis(emphasis) {
    const focusKey = emphasis || activeFilter;
    const showCatch = !activeFilter || activeFilter === "catch";
    const showVoy = !activeFilter || activeFilter === "voyage";
    lineCatch.style.pointerEvents = showCatch ? "auto" : "none";
    lineVoy.style.pointerEvents = showVoy ? "auto" : "none";

    if (focusKey === "catch") {
      lineCatch.style.opacity = "1";
      lineCatch.style.strokeWidth = "1.6";
      lineVoy.style.opacity = showVoy ? "0.35" : "0.08";
      lineVoy.style.strokeWidth = "1.2";
    } else if (focusKey === "voyage") {
      lineCatch.style.opacity = showCatch ? "0.35" : "0.08";
      lineCatch.style.strokeWidth = "1.2";
      lineVoy.style.opacity = "1";
      lineVoy.style.strokeWidth = "1.6";
    } else {
      lineCatch.style.opacity = showCatch ? "0.85" : "0.08";
      lineCatch.style.strokeWidth = "1.4";
      lineVoy.style.opacity = showVoy ? "0.85" : "0.08";
      lineVoy.style.strokeWidth = "1.4";
    }
  }

  function computePeak(data, key) {
    return data.reduce((acc, d) => (d[key] > acc[key] ? d : acc), data[0]);
  }

  const peaks = {
    raw: {
      catch: rawData.length ? computePeak(rawData, "compositeIndex") : null,
      voyage: rawData.length ? computePeak(rawData, "voyageIndex") : null,
    },
    smooth: {
      catch: smoothData.length ? computePeak(smoothData, "compositeIndex") : null,
      voyage: smoothData.length ? computePeak(smoothData, "voyageIndex") : null,
    },
  };

  function setPeakVisibility(focusKey) {
    const key = focusKey || activeFilter || hoverKey;
    Object.entries(peakGroups).forEach(([k, peak]) => {
      if (key) {
        peak.group.style.opacity = k === key ? "1" : "0";
      } else {
        peak.group.style.opacity = "0.45";
      }
    });
  }

  function resize() {
    const data = getData();
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m, gap: size.gap };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const compositeMax = Math.max(...data.map((d) => d.compositeIndex)) * 1.08;
    const voyageMax = Math.max(...data.map((d) => d.voyageIndex)) * 1.08;
    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    const innerH = h - size.m.top - size.m.bottom;
    const topH = innerH * 0.62;
    const bottomH = innerH - topH - size.gap;
    const topTop = size.m.top;
    const topBottom = topTop + topH;
    const bottomTop = topBottom + size.gap;
    const bottomBottom = bottomTop + bottomH;

    const yCompositeLocal = scaleLinear([0, compositeMax], [topH, 0]);
    const yVoyLocal = scaleLinear([0, voyageMax], [bottomH, 0]);
    const yComposite = (v) => topTop + yCompositeLocal(v);
    const yVoy = (v) => bottomTop + yVoyLocal(v);

    panelLayout = {
      topTop,
      topBottom,
      bottomTop,
      bottomBottom,
      yComposite,
      yVoy,
      yCompositeLocal,
      yVoyLocal,
      compositeMax,
      voyageMax,
      topH,
      bottomH,
    };
    currentScales = { x, yComposite, yVoy };
    currentData = data;

    lineCatch.setAttribute("d", linePath(data, x, yComposite, "compositeIndex"));
    lineVoy.setAttribute("d", linePath(data, x, yVoy, "voyageIndex"));

    const band = DATA.confidenceBand;
    if (band && band.start && band.end) {
      const x0 = x(Math.max(years[0], band.start));
      const x1 = x(Math.min(years[years.length - 1], band.end));
      confidenceBand.setAttribute("x", Math.min(x0, x1));
      confidenceBand.setAttribute("y", topTop);
      confidenceBand.setAttribute("width", Math.abs(x1 - x0));
      confidenceBand.setAttribute("height", bottomBottom - topTop);
      confidenceBand.style.opacity = "1";

      const bandX = Math.min(x0, x1);
      const bandY = topTop;
      const bandH = bottomBottom - topTop;
      const lineX = bandX + 6;
      confidenceLine.setAttribute("x1", lineX);
      confidenceLine.setAttribute("y1", bandY);
      confidenceLine.setAttribute("x2", lineX);
      confidenceLine.setAttribute("y2", bandY + bandH);
      const labelX = bandX + 16;
      const labelY = bandY + bandH * 0.5;
      confidenceText.setAttribute("x", labelX);
      confidenceText.setAttribute("y", labelY);
      confidenceText.setAttribute("text-anchor", "middle");
      confidenceText.setAttribute("transform", `rotate(-90 ${labelX} ${labelY})`);
      confidenceText.textContent = "низкая уверенность данных";
      confidenceLabel.style.opacity = "0.7";
    } else {
      confidenceBand.style.opacity = "0";
      confidenceLabel.style.opacity = "0";
    }


    const breaks = DATA.breakYears || {};
    const breakYears = [breaks.compositePeak, breaks.voyagePeak].filter(Boolean);
    const breakLines = [breakA, breakB];
    breakLines.forEach((line, idx) => {
      const year = breakYears[idx];
      if (!year) {
        line.style.opacity = "0";
        return;
      }
      const xPos = x(year);
      line.setAttribute("x1", xPos);
      line.setAttribute("x2", xPos);
      line.setAttribute("y1", topTop);
      line.setAttribute("y2", bottomBottom);
      line.style.opacity = "0.6";
    });

    const peakSet = peaks[mode] || peaks.raw;
    Object.entries(peakGroups).forEach(([key, peak]) => {
      const point = peakSet[key];
      if (!point) return;
      const px = x(point.year);
      const py = key === "catch" ? yComposite(point.compositeIndex) : yVoy(point.voyageIndex);
      peak.dot.setAttribute("cx", px);
      peak.dot.setAttribute("cy", py);
      peak.dot.setAttribute("r", "4.6");
      peak.label.setAttribute("x", px + 10);
      peak.label.setAttribute("y", py - 10);
      peak.label.textContent = `${point.year}`;
    });

    axisX.setAttribute("transform", `translate(0 ${bottomBottom})`);
    axisYComposite.setAttribute("transform", `translate(${size.m.left} ${topTop})`);
    axisYVoyage.setAttribute("transform", `translate(${size.m.left} ${bottomTop})`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);
    drawAxis(axisYComposite, yCompositeLocal, [0, Math.round(compositeMax / 2), Math.round(compositeMax)], "left", topH);
    drawAxis(axisYVoyage, yVoyLocal, [0, Math.round(voyageMax / 2), Math.round(voyageMax)], "left", bottomH);
  }

  function findNearestPoint(pixelX) {
    const data = currentData.length ? currentData : getData();
    if (!data.length) return null;
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = data[0];
    let minDiff = Math.abs(nearest.year - year);
    data.forEach((d) => {
      const diff = Math.abs(d.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    });
    return nearest;
  }

  function updateTooltip(point) {
    if (!point || !currentScales || !panelLayout) return;
    const { x, yComposite, yVoy } = currentScales;
    const xPos = x(point.year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", panelLayout.topTop);
    focusLine.setAttribute("y2", panelLayout.bottomBottom);

    const keys = visibleKeys();
    keys.forEach((key) => {
      const dot = focusDots[key];
      if (!dot) return;
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", key === "catch" ? yComposite(point.compositeIndex) : yVoy(point.voyageIndex));
      dot.setAttribute("r", "4.5");
      dot.style.opacity = "1";
    });
    Object.keys(focusDots).forEach((key) => {
      if (!keys.includes(key)) focusDots[key].style.opacity = "0";
    });

    if (tooltipTitle && tooltipRows) {
      tooltipTitle.textContent = `${point.year}`;
      tooltipRows.innerHTML = "";
      if (keys.includes("catch")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--catch";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Композитный индекс"));
        const value = document.createElement("div");
        value.textContent = `${point.compositeIndex.toFixed(1).replace(".", ",")}`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
      if (keys.includes("voyage")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--voyage";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Рейсы"));
        const value = document.createElement("div");
        value.textContent = `${point.voyageIndex.toFixed(1).replace(".", ",")}`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
    }

    const rect = container.getBoundingClientRect();
    let left = (xPos / size.w) * rect.width;
    let top = (yComposite(point.compositeIndex) + yVoy(point.voyageIndex)) / 2;
    top = (top / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    focusGroup.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  }

  function update(step) {
    currentStep = step;
    const basePeriod = DATA.divergenceMeta?.basePeriod;
    const baseText = basePeriod ? `Базовый период: ${basePeriod.start}–${basePeriod.end}. ` : "";
    const baseNote =
      "Совокупный показатель включает спермацет, ворвань и китовый ус. Поскольку они заданы в разных единицах измерения, используется композитный индекс, построенный на основе отдельной нормировки каждой продуктовой линии к общей базе. Показатель не является физическим или стоимостным объёмом продукции.";
    const notes = [
      "Композитный индекс продуктовых линий и индекс числа рейсов расходятся.",
      "Линии перелома показывают смену режима роста.",
      "Ранняя зона — период слабой регистрации (архивной уверенности).",
    ];
    if (noteEl) noteEl.textContent = `${notes[step] || notes[0]} ${baseText}${baseNote}`;

    const focusMap = { 0: null, 1: "catch", 2: "voyage" };
    const focus = focusMap[step] ?? null;
    const emphasis = hoverKey ?? focus ?? activeFilter;
    applyEmphasis(emphasis);
    setPeakVisibility(emphasis);

    if (step === 2) {
      confidenceBand.style.opacity = "0.18";
    } else {
      confidenceBand.style.opacity = "0.1";
    }
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    if (isAnimating) return;
    const nextData = nextMode === "smooth" ? smoothData : rawData;
    if (!nextData.length) return;
    const startData = currentData.length ? currentData : getData();
    const duration = 700;
    const start = performance.now();

    isAnimating = true;
    mode = nextMode;
    updateControls();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const frameData = startData.map((d, i) => ({
        year: d.year,
        compositeIndex: lerp(d.compositeIndex, nextData[i]?.compositeIndex ?? d.compositeIndex, eased),
        voyageIndex: lerp(d.voyageIndex, nextData[i]?.voyageIndex ?? d.voyageIndex, eased),
      }));
      resizeFrame(frameData);
      update(currentStep);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        currentData = nextData;
        isAnimating = false;
        resize();
        update(currentStep);
      }
    };

    requestAnimationFrame(tick);
  }

  function resizeFrame(data) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m, gap: size.gap };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const compositeMax = Math.max(...data.map((d) => d.compositeIndex)) * 1.08;
    const voyageMax = Math.max(...data.map((d) => d.voyageIndex)) * 1.08;
    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    const innerH = h - size.m.top - size.m.bottom;
    const topH = innerH * 0.62;
    const bottomH = innerH - topH - size.gap;
    const topTop = size.m.top;
    const topBottom = topTop + topH;
    const bottomTop = topBottom + size.gap;
    const bottomBottom = bottomTop + bottomH;
    const yCompositeLocal = scaleLinear([0, compositeMax], [topH, 0]);
    const yVoyLocal = scaleLinear([0, voyageMax], [bottomH, 0]);
    const yComposite = (v) => topTop + yCompositeLocal(v);
    const yVoy = (v) => bottomTop + yVoyLocal(v);
    currentScales = { x, yComposite, yVoy };
    currentData = data;
    lineCatch.setAttribute("d", linePath(data, x, yComposite, "compositeIndex"));
    lineVoy.setAttribute("d", linePath(data, x, yVoy, "voyageIndex"));
    axisX.setAttribute("transform", `translate(0 ${bottomBottom})`);
    axisYComposite.setAttribute("transform", `translate(${size.m.left} ${topTop})`);
    axisYVoyage.setAttribute("transform", `translate(${size.m.left} ${bottomTop})`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);
    drawAxis(axisYComposite, yCompositeLocal, [0, Math.round(compositeMax / 2), Math.round(compositeMax)], "left", topH);
    drawAxis(axisYVoyage, yVoyLocal, [0, Math.round(voyageMax / 2), Math.round(voyageMax)], "left", bottomH);
    panelLayout = {
      topTop,
      topBottom,
      bottomTop,
      bottomBottom,
      yComposite,
      yVoy,
      yCompositeLocal,
      yVoyLocal,
      compositeMax,
      voyageMax,
      topH,
      bottomH,
    };
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "smooth" ? "smooth" : "raw";
        setMode(nextMode);
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        hoverKey = null;
        updateLegend();
        update(currentStep);
      });
    });
    updateLegend();
  }

  lineCatch.addEventListener("mouseenter", () => {
    hoverKey = "catch";
    update(currentStep);
  });
  lineCatch.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });
  lineVoy.addEventListener("mouseenter", () => {
    hoverKey = "voyage";
    update(currentStep);
  });
  lineVoy.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });

  svg.addEventListener("mousemove", (event) => {
    if (!currentScales) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const point = findNearestPoint(pixelX);
    updateTooltip(point);
  });

  svg.addEventListener("mouseleave", hideTooltip);

  resize();
  update(0);
  updateControls();
  updateLegend();
  return { resize, update };
}

function createPhaseChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisY = createGroup(root, "axis axis--y");
  const dotsGroup = createGroup(root, "scatter");

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 } };
  let dots = [];

  function resize() {
    const data = DATA.phaseDecades || [];
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    dotsGroup.innerHTML = "";
    dots = [];

    const xMax = Math.max(...data.map((d) => d.duration)) * 1.15;
    const yMax = Math.max(...data.map((d) => d.catch)) * 1.15;
    const x = scaleLinear([0, xMax], [size.m.left, w - size.m.right]);
    const y = scaleLinear([0, yMax], [h - size.m.bottom, size.m.top]);

    const maxVoy = Math.max(...data.map((d) => d.voyages));
    data.forEach((d) => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "scatter__dot");
      dot.setAttribute("cx", x(d.duration));
      dot.setAttribute("cy", y(d.catch));
      const r = 4 + Math.sqrt(d.voyages / maxVoy) * 6;
      dot.setAttribute("r", r.toFixed(2));
      dot.dataset.decade = String(d.decade);
      dotsGroup.appendChild(dot);
      const label = createText(dotsGroup, "scatter__label");
      label.setAttribute("x", x(d.duration) + 8);
      label.setAttribute("y", y(d.catch) - 6);
      label.textContent = `${d.decade}s`;
      dots.push({ dot, label, decade: d.decade });
    });

    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    axisY.setAttribute("transform", `translate(${size.m.left} 0)`);
    drawAxis(axisX, x, [0, Math.round(xMax / 2), Math.round(xMax)], "bottom", w - size.m.left - size.m.right);
    drawAxis(axisY, y, [0, Math.round(yMax / 2), Math.round(yMax)], "left", h - size.m.top - size.m.bottom);
  }

  function update(step) {
    const notes = [
      "Десятилетия: длительность рейса × добыча на рейс.",
      "Поздние десятилетия уходят в более длительные режимы.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    dots.forEach(({ dot, label, decade }) => {
      const isLate = decade >= 1850;
      const active = step === 1 ? isLate : true;
      dot.style.opacity = active ? "0.9" : "0.2";
      label.style.opacity = active ? "0.75" : "0.2";
    });
  }

  resize();
  update(0);
  return { resize, update };
}

function createFrontierChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const rings = createGroup(root, "frontier-rings");
  const path = createPath(root, "frontier-path");
  const marker = document.createElementNS(svgNS, "circle");
  marker.setAttribute("class", "marker");
  root.appendChild(marker);

  let size = { w: 0, h: 0, m: 60 };

  function resize() {
    const data = DATA.distanceIndex || [];
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size.w = w;
    size.h = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    rings.innerHTML = "";

    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.min(w, h) * 0.35;
    const rScale = scaleLinear([1, 3], [maxR * 0.35, maxR]);

    [1, 2, 3].forEach((level) => {
      const ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("cx", cx);
      ring.setAttribute("cy", cy);
      ring.setAttribute("r", rScale(level));
      ring.setAttribute("class", "frontier-ring");
      rings.appendChild(ring);
    });

    const years = data.map((d) => d.year);
    const angleScale = scaleLinear([years[0], years[years.length - 1]], [-Math.PI / 2, Math.PI * 1.5]);
    const points = data.map((d) => {
      const angle = angleScale(d.year);
      const r = rScale(Math.max(1, d.value || 1));
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });
    path.setAttribute("d", points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" "));

    marker.setAttribute("cx", points[points.length - 1][0]);
    marker.setAttribute("cy", points[points.length - 1][1]);
    marker.setAttribute("r", "4.5");
  }

  function update(step) {
    const notes = [
      "Радиальный фронтир: чем дальше, тем выше индекс дальности.",
      "Конец века фиксирует максимальную дальность промысла.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    path.style.opacity = step === 1 ? "0.95" : "0.75";
  }

  resize();
  update(0);
  return { resize, update };
}

function createModesChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const bands = createGroup(root, "modes-bands");
  const labels = createGroup(root, "modes-labels");
  const lines = {
    near: createPath(root, "line line--near"),
    mid: createPath(root, "line line--mid"),
    far: createPath(root, "line line--far"),
  };

  const controls = container.closest(".scene__visual")?.querySelector("#controls-modes");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-modes");

  const peakGroups = {
    near: (() => {
      const group = createGroup(root, "peak peak--near");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
    mid: (() => {
      const group = createGroup(root, "peak peak--mid");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
    far: (() => {
      const group = createGroup(root, "peak peak--far");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
  };

  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  const focusDots = {
    near: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--near");
      focusGroup.appendChild(dot);
      return dot;
    })(),
    mid: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--mid");
      focusGroup.appendChild(dot);
      return dot;
    })(),
    far: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--far");
      focusGroup.appendChild(dot);
      return dot;
    })(),
  };
  focusGroup.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 } };
  let mode = "smooth";
  let activeFilter = null;
  let currentScales = null;
  let currentData = [];
  let currentStep = 0;
  let hoverKey = null;
  let isAnimating = false;

  const rawData = DATA.logisticsShares || [];
  const years = rawData.map((d) => d.year);
  const zones = ["near", "mid", "far"];

  function smoothSeries(data, windowSize = 5) {
    if (!data.length) return [];
    const half = Math.floor(windowSize / 2);
    return data.map((d, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(data.length - 1, i + half);
      const slice = data.slice(start, end + 1);
      const avg = slice.reduce(
        (acc, v) => {
          acc.near += v.near;
          acc.mid += v.mid;
          acc.far += v.far;
          return acc;
        },
        { near: 0, mid: 0, far: 0 },
      );
      const n = slice.length || 1;
      return { year: d.year, near: avg.near / n, mid: avg.mid / n, far: avg.far / n };
    });
  }

  const smoothData = smoothSeries(rawData, 5);

  function getData() {
    return mode === "smooth" && smoothData.length ? smoothData : rawData;
  }

  function visibleKeys() {
    return activeFilter ? [activeFilter] : zones;
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = activeFilter && key !== activeFilter;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function applyEmphasis(emphasis) {
    const focusKey = emphasis || activeFilter;
    zones.forEach((zone) => {
      const isFilteredOut = activeFilter && zone !== activeFilter;
      const isEmphasis = focusKey ? zone === focusKey : false;
      lines[zone].style.pointerEvents = isFilteredOut ? "none" : "auto";
      if (focusKey) {
        lines[zone].style.opacity = isEmphasis ? "1" : isFilteredOut ? "0.05" : "0.22";
        lines[zone].style.strokeWidth = isEmphasis ? "3" : "1.4";
      } else {
        lines[zone].style.opacity = isFilteredOut ? "0.08" : "0.75";
        lines[zone].style.strokeWidth = "2.2";
      }
    });
  }

  function computePeaks(data) {
    const peaks = {};
    zones.forEach((zone) => {
      let peak = data[0] || null;
      data.forEach((d) => {
        if (!peak || d[zone] > peak[zone]) peak = d;
      });
      peaks[zone] = peak;
    });
    return peaks;
  }

  function setPeakVisibility(focusKey) {
    const key = focusKey || activeFilter || hoverKey;
    Object.entries(peakGroups).forEach(([k, peak]) => {
      if (key) {
        peak.group.style.opacity = k === key ? "1" : "0";
      } else {
        peak.group.style.opacity = "0.4";
      }
    });
  }

  function renderFrame(data) {
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    bands.innerHTML = "";
    labels.innerHTML = "";

    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    const bandHeight = (h - size.m.top - size.m.bottom) / zones.length;
    const yMap = {};

    zones.forEach((zone, i) => {
      const bandTop = size.m.top + i * bandHeight;
      const bandBottom = bandTop + bandHeight;
      const y = scaleLinear([0, 1], [bandBottom - 12, bandTop + 12]);
      yMap[zone] = y;
      lines[zone].setAttribute(
        "d",
        data.map((d, idx) => `${idx === 0 ? "M" : "L"} ${x(d.year)} ${y(d[zone])}`).join(" "),
      );

      const divider = createLine(bands, "modes-divider");
      divider.setAttribute("x1", size.m.left);
      divider.setAttribute("x2", w - size.m.right);
      divider.setAttribute("y1", bandBottom);
      divider.setAttribute("y2", bandBottom);

      const label = createText(labels, "modes-label");
      label.setAttribute("x", size.m.left - 14);
      label.setAttribute("y", bandTop + 18);
      label.setAttribute("text-anchor", "end");
      label.textContent = zone === "near" ? "Ближние" : zone === "mid" ? "Средние" : "Дальние";
    });

    currentScales = { x, yMap };
    currentData = data;

    const peakData = computePeaks(data);
    Object.entries(peakGroups).forEach(([zone, peak]) => {
      const point = peakData[zone];
      if (!point) return;
      const px = x(point.year);
      const py = yMap[zone](point[zone]);
      peak.dot.setAttribute("cx", px);
      peak.dot.setAttribute("cy", py);
      peak.dot.setAttribute("r", "4.4");
      peak.label.setAttribute("x", px + 10);
      peak.label.setAttribute("y", py - 10);
      peak.label.textContent = `${point.year}`;
    });

    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);
  }

  function findNearestPoint(pixelX) {
    const data = currentData.length ? currentData : getData();
    if (!data.length) return null;
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = data[0];
    let minDiff = Math.abs(nearest.year - year);
    data.forEach((d) => {
      const diff = Math.abs(d.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    });
    return nearest;
  }

  function updateTooltip(point) {
    if (!point || !currentScales) return;
    const { x, yMap } = currentScales;
    const xPos = x(point.year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", size.m.top);
    focusLine.setAttribute("y2", size.h - size.m.bottom);

    const keys = visibleKeys();
    keys.forEach((key) => {
      const dot = focusDots[key];
      if (!dot) return;
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", yMap[key](point[key]));
      dot.setAttribute("r", "4.2");
      dot.style.opacity = "1";
    });
    Object.keys(focusDots).forEach((key) => {
      if (!keys.includes(key)) focusDots[key].style.opacity = "0";
    });

    if (tooltipTitle && tooltipRows) {
      tooltipTitle.textContent = `${point.year}`;
      tooltipRows.innerHTML = "";
      keys.forEach((key) => {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = `chart__tooltip-swatch chart__tooltip-swatch--${key}`;
        label.appendChild(swatch);
        label.appendChild(
          document.createTextNode(key === "near" ? "Ближние" : key === "mid" ? "Средние" : "Дальние"),
        );
        const value = document.createElement("div");
        value.textContent = `${(point[key] * 100).toFixed(1).replace(".", ",")}%`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      });
    }

    const rect = container.getBoundingClientRect();
    let left = (xPos / size.w) * rect.width;
    const avgY =
      keys.reduce((acc, key) => acc + yMap[key](point[key]), 0) / (keys.length || 1);
    let top = (avgY / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    focusGroup.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  }

  function update(step) {
    currentStep = step;
    const notes = [
      "Доли рейсов по логистическим режимам.",
      "Дальние зоны постепенно становятся ключевыми.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    const focusMap = { 0: null, 1: "far" };
    const focus = focusMap[step] ?? null;
    const emphasis = hoverKey ?? focus ?? activeFilter;
    applyEmphasis(emphasis);
    setPeakVisibility(emphasis);
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    if (isAnimating) return;
    const nextData = nextMode === "smooth" ? smoothData : rawData;
    if (!nextData.length) return;
    const startData = currentData.length ? currentData : getData();
    const duration = 700;
    const start = performance.now();

    isAnimating = true;
    mode = nextMode;
    updateControls();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const frameData = startData.map((d, i) => ({
        year: d.year,
        near: lerp(d.near, nextData[i]?.near ?? d.near, eased),
        mid: lerp(d.mid, nextData[i]?.mid ?? d.mid, eased),
        far: lerp(d.far, nextData[i]?.far ?? d.far, eased),
      }));
      renderFrame(frameData);
      update(currentStep);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        currentData = nextData;
        isAnimating = false;
        renderFrame(currentData);
        update(currentStep);
      }
    };

    requestAnimationFrame(tick);
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "smooth" ? "smooth" : "raw";
        setMode(nextMode);
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        hoverKey = null;
        updateLegend();
        update(currentStep);
      });
    });
    updateLegend();
  }

  Object.entries(lines).forEach(([key, path]) => {
    path.addEventListener("mouseenter", () => {
      hoverKey = key;
      update(currentStep);
    });
    path.addEventListener("mouseleave", () => {
      hoverKey = null;
      update(currentStep);
    });
  });

  svg.addEventListener("mousemove", (event) => {
    if (!currentScales) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const point = findNearestPoint(pixelX);
    updateTooltip(point);
  });

  svg.addEventListener("mouseleave", hideTooltip);

  function resize() {
    renderFrame(currentData.length ? currentData : getData());
  }

  renderFrame(getData());
  update(0);
  updateControls();
  updateLegend();
  return { resize, update };
}

function createRigChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisY = createGroup(root, "axis axis--y");
  const dotsGroup = createGroup(root, "scatter");

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 } };
  let dots = [];

  function resize() {
    const data = DATA.rigTonnage || [];
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    dotsGroup.innerHTML = "";
    dots = [];

    const xMax = Math.max(...data.map((d) => d.duration)) * 1.15;
    const yMax = Math.max(...data.map((d) => d.tonnage)) * 1.15;
    const x = scaleLinear([0, xMax], [size.m.left, w - size.m.right]);
    const y = scaleLinear([0, yMax], [h - size.m.bottom, size.m.top]);
    const maxVoy = Math.max(...data.map((d) => d.voyages));

    data.forEach((d) => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", `scatter__dot scatter__dot--${d.dominant}`);
      dot.setAttribute("cx", x(d.duration));
      dot.setAttribute("cy", y(d.tonnage));
      dot.setAttribute("r", (4 + Math.sqrt(d.voyages / maxVoy) * 6).toFixed(2));
      dot.dataset.decade = String(d.decade);
      dotsGroup.appendChild(dot);
      const label = createText(dotsGroup, "scatter__label");
      label.setAttribute("x", x(d.duration) + 10);
      label.setAttribute("y", y(d.tonnage) - 6);
      label.textContent = `${d.decade}s`;
      dots.push({ dot, label, decade: d.decade });
    });

    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    axisY.setAttribute("transform", `translate(${size.m.left} 0)`);
    drawAxis(axisX, x, [0, Math.round(xMax / 2), Math.round(xMax)], "bottom", w - size.m.left - size.m.right);
    drawAxis(axisY, y, [0, Math.round(yMax / 2), Math.round(yMax)], "left", h - size.m.top - size.m.bottom);
  }

  function update(step) {
    const notes = [
      "Каждая точка — десятилетие: тоннаж × длительность.",
      "Цвет показывает доминирующий продукт десятилетия.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    dots.forEach(({ dot, label, decade }) => {
      const isLate = decade >= 1860;
      const active = step === 1 ? isLate : true;
      dot.style.opacity = active ? "0.9" : "0.2";
      label.style.opacity = active ? "0.75" : "0.2";
    });
  }

  resize();
  update(0);
  return { resize, update };
}

function createSeasonalityChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const labels = createGroup(root, "heat-labels");
  const grid = createGroup(root, "heat-grid");
  const controls = container.closest(".scene__visual")?.querySelector("#controls-seasonality");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-seasonality");
  const peakGroup = createGroup(root, "heat-peaks");
  const focusRect = createRect(root, "heat-focus");
  focusRect.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 40, bottom: 50, left: 70 } };
  let mode = "raw";
  let activeFilter = null;
  let stepFocusGroup = null;
  let currentData = [];
  let layout = null;
  let rows = [];
  let currentStep = 0;
  let hoverRow = null;
  let hoverCol = null;

  const rawData = DATA.seasonality?.rows || [];
  const monthLabels = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

  function normalizeRow(values) {
    const total = values.reduce((acc, v) => acc + v, 0) || 1;
    return values.map((v) => v / total);
  }

  function smoothRow(values, windowSize = 3) {
    const half = Math.floor(windowSize / 2);
    return values.map((_, i) => {
      const indices = Array.from({ length: windowSize }, (_, k) => (i - half + k + values.length) % values.length);
      const sum = indices.reduce((acc, idx) => acc + values[idx], 0);
      return sum / windowSize;
    });
  }

  function smoothData(data) {
    return data.map((row) => {
      const smoothed = smoothRow(row.values, 3);
      const normalized = normalizeRow(smoothed);
      return { ...row, values: normalized };
    });
  }

  const smoothRows = smoothData(rawData);

  function getData() {
    return mode === "smooth" ? smoothRows : rawData;
  }

  function decadeGroup(decade) {
    if (decade <= 1840) return "early";
    if (decade <= 1870) return "mid";
    return "late";
  }

  function visibleGroup() {
    return activeFilter || stepFocusGroup;
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    const target = visibleGroup();
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = target && key !== target;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function updatePeaks() {
    const target = visibleGroup();
    rows.forEach((row, idx) => {
      if (!row.peakEl) return;
      if (target && row.group !== target) {
        row.peakEl.style.opacity = "0.1";
        return;
      }
      if (hoverRow !== null) {
        row.peakEl.style.opacity = idx === hoverRow ? "0.9" : "0.1";
      } else {
        row.peakEl.style.opacity = "0.4";
      }
    });
  }

  function applyFilter() {
    const target = visibleGroup();
    rows.forEach((row, idx) => {
      const isMatch = !target || row.group === target;
      row.groupEl.style.opacity = isMatch ? "1" : "0.2";
      row.groupEl.style.pointerEvents = isMatch ? "auto" : "none";
      row.labelEl.style.opacity = isMatch ? "0.8" : "0.2";
      if (row.peakEl) row.peakEl.style.opacity = isMatch ? "0.4" : "0.1";
    });
    updateLegend();
    updatePeaks();
  }

  function buildLayout(data) {
    grid.innerHTML = "";
    labels.innerHTML = "";
    peakGroup.innerHTML = "";
    rows = [];

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const rowCount = data.length;
    const colCount = 12;
    const cellW = (w - size.m.left - size.m.right) / colCount;
    const cellH = (h - size.m.top - size.m.bottom) / rowCount;
    layout = { cellW, cellH, rowCount, colCount, gridX: size.m.left, gridY: size.m.top };

    monthLabels.forEach((label, i) => {
      const t = createText(labels, "heat-label");
      t.setAttribute("x", size.m.left + cellW * i + cellW / 2);
      t.setAttribute("y", size.m.top - 14);
      t.setAttribute("text-anchor", "middle");
      t.textContent = label;
    });

    data.forEach((row, r) => {
      const rowGroup = createGroup(grid, "heat-row");
      const label = createText(labels, "heat-label");
      label.setAttribute("x", size.m.left - 10);
      label.setAttribute("y", size.m.top + cellH * r + cellH * 0.7);
      label.setAttribute("text-anchor", "end");
      label.textContent = `${row.decade}s`;

      const cells = [];
      row.values.forEach((val, c) => {
        const rect = createRect(rowGroup, "heat-cell");
        rect.setAttribute("x", size.m.left + c * cellW);
        rect.setAttribute("y", size.m.top + r * cellH);
        rect.setAttribute("width", Math.max(2, cellW - 2));
        rect.setAttribute("height", Math.max(2, cellH - 2));
        rect.style.fill = `rgba(63, 115, 108, ${0.12 + val * 0.7})`;
        rect.dataset.row = String(r);
        rect.dataset.col = String(c);
        rect.dataset.value = String(val);
        cells.push(rect);
      });

      const group = decadeGroup(row.decade);
      rowGroup.dataset.group = group;
      const peakRect = createRect(peakGroup, "heat-peak");

      rows.push({
        decade: row.decade,
        group,
        labelEl: label,
        groupEl: rowGroup,
        cells,
        peakEl: peakRect,
      });
    });

    currentData = data;
    updateCells(data);
  }

  function updateCells(data) {
    if (!data.length || !layout) return;
    data.forEach((row, r) => {
      const rowState = rows[r];
      if (!rowState) return;
      rowState.decade = row.decade;
      rowState.group = decadeGroup(row.decade);
      rowState.groupEl.dataset.group = rowState.group;
      rowState.labelEl.textContent = `${row.decade}s`;

      let maxVal = -Infinity;
      let peakIdx = 0;
      row.values.forEach((val, c) => {
        if (val > maxVal) {
          maxVal = val;
          peakIdx = c;
        }
        const cell = rowState.cells[c];
        if (!cell) return;
        cell.dataset.value = String(val);
        cell.style.fill = `rgba(63, 115, 108, ${0.12 + val * 0.7})`;
      });
      if (rowState.peakEl) {
        const x = layout.gridX + peakIdx * layout.cellW;
        const y = layout.gridY + r * layout.cellH;
        rowState.peakEl.setAttribute("x", x + 1);
        rowState.peakEl.setAttribute("y", y + 1);
        rowState.peakEl.setAttribute("width", Math.max(2, layout.cellW - 2));
        rowState.peakEl.setAttribute("height", Math.max(2, layout.cellH - 2));
        rowState.peakEl.style.opacity = maxVal > 0 ? "0.4" : "0";
      }
    });
    applyFilter();
  }

  function renderFrame(data) {
    if (!layout || rows.length !== data.length) {
      buildLayout(data);
    } else {
      currentData = data;
      updateCells(data);
    }
  }

  function showFocus(rowIndex, colIndex) {
    if (!layout) return;
    const x = layout.gridX + colIndex * layout.cellW;
    const y = layout.gridY + rowIndex * layout.cellH;
    focusRect.setAttribute("x", x + 1);
    focusRect.setAttribute("y", y + 1);
    focusRect.setAttribute("width", Math.max(2, layout.cellW - 2));
    focusRect.setAttribute("height", Math.max(2, layout.cellH - 2));
    focusRect.style.opacity = "1";
  }

  function hideFocus() {
    focusRect.style.opacity = "0";
  }

  function updateTooltip(rowIndex, colIndex) {
    if (!layout || !currentData[rowIndex]) return;
    const row = currentData[rowIndex];
    const val = row.values[colIndex] ?? 0;
    const decade = row.decade;
    tooltipTitle.textContent = `${decade}s · ${monthLabels[colIndex]}`;
    tooltipRows.innerHTML = "";
    const row1 = document.createElement("div");
    row1.className = "chart__tooltip-row";
    row1.innerHTML = `<div class="chart__tooltip-label">Интенсивность</div><div>${(val * 100)
      .toFixed(1)
      .replace(".", ",")}%</div>`;
    tooltipRows.appendChild(row1);

    const rect = container.getBoundingClientRect();
    const x = layout.gridX + colIndex * layout.cellW + layout.cellW / 2;
    const y = layout.gridY + rowIndex * layout.cellH;
    let left = (x / size.w) * rect.width;
    let top = (y / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
  }

  function update(step) {
    currentStep = step;
    const notes = [
      "Интенсивность выходов по месяцам (нормировано по десятилетиям).",
      "Сезонный рисунок дрейфует вместе с логистикой.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    stepFocusGroup = step === 1 ? "late" : null;
    applyFilter();
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    mode = nextMode;
    updateControls();
    renderFrame(getData());
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "smooth" ? "smooth" : "raw";
        setMode(nextMode);
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        updateLegend();
        applyFilter();
      });
    });
    updateLegend();
  }

  svg.addEventListener("mousemove", (event) => {
    if (!layout) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const scaleY = size.h / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    const { gridX, gridY, cellW, cellH, rowCount, colCount } = layout;
    if (px < gridX || py < gridY || px > gridX + cellW * colCount || py > gridY + cellH * rowCount) {
      hoverRow = null;
      hoverCol = null;
      hideFocus();
      hideTooltip();
      updatePeaks();
      return;
    }
    const colIndex = Math.min(colCount - 1, Math.max(0, Math.floor((px - gridX) / cellW)));
    const rowIndex = Math.min(rowCount - 1, Math.max(0, Math.floor((py - gridY) / cellH)));
    const rowState = rows[rowIndex];
    if (rowState && visibleGroup() && rowState.group !== visibleGroup()) {
      hideFocus();
      hideTooltip();
      return;
    }
    hoverRow = rowIndex;
    hoverCol = colIndex;
    showFocus(rowIndex, colIndex);
    updateTooltip(rowIndex, colIndex);
    updatePeaks();
  });

  svg.addEventListener("mouseleave", () => {
    hoverRow = null;
    hoverCol = null;
    hideFocus();
    hideTooltip();
    updatePeaks();
  });

  renderFrame(getData());
  update(0);
  updateControls();
  updateLegend();
  return {
    resize: () => {
      layout = null;
      renderFrame(getData());
    },
    update,
  };
}

function createVisibilityChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisY = createGroup(root, "axis axis--y");
  const area = createPath(root, "visibility-area");
  const lineLog = createPath(root, "line line--logbook");
  const lineCrew = createPath(root, "line line--crew");
  const controls = container.closest(".scene__visual")?.querySelector("#controls-visibility");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-visibility");

  const peakGroups = {
    logbook: (() => {
      const group = createGroup(root, "peak peak--logbook");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
    crew: (() => {
      const group = createGroup(root, "peak peak--crew");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
  };

  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  const focusDots = {
    logbook: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--logbook");
      focusGroup.appendChild(dot);
      return dot;
    })(),
    crew: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--crew");
      focusGroup.appendChild(dot);
      return dot;
    })(),
  };
  focusGroup.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  let size = { w: 0, h: 0, m: { top: 60, right: 60, bottom: 50, left: 70 } };
  let mode = "raw";
  let activeFilter = null;
  let currentScales = null;
  let currentData = [];
  let currentStep = 0;
  let hoverKey = null;
  let isAnimating = false;

  const rawData = DATA.visibility || [];
  const years = rawData.map((d) => d.year);

  function smoothSeries(data, windowSize = 5) {
    if (!data.length) return [];
    const half = Math.floor(windowSize / 2);
    return data.map((d, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(data.length - 1, i + half);
      const slice = data.slice(start, end + 1);
      const avgLog = slice.reduce((acc, v) => acc + v.logbook, 0) / slice.length;
      const avgCrew = slice.reduce((acc, v) => acc + v.crew, 0) / slice.length;
      return { year: d.year, logbook: avgLog, crew: avgCrew };
    });
  }

  const smoothData = smoothSeries(rawData, 5);

  function getData() {
    return mode === "smooth" && smoothData.length ? smoothData : rawData;
  }

  function visibleKeys() {
    return activeFilter ? [activeFilter] : ["logbook", "crew"];
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = activeFilter && key !== activeFilter;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function applyEmphasis(emphasis) {
    const focusKey = emphasis || activeFilter;
    const showLog = !activeFilter || activeFilter === "logbook";
    const showCrew = !activeFilter || activeFilter === "crew";
    lineLog.style.pointerEvents = showLog ? "auto" : "none";
    lineCrew.style.pointerEvents = showCrew ? "auto" : "none";

    if (focusKey === "logbook") {
      lineLog.style.opacity = "1";
      lineLog.style.strokeWidth = "3";
      lineCrew.style.opacity = showCrew ? "0.25" : "0.05";
      lineCrew.style.strokeWidth = "2.2";
    } else if (focusKey === "crew") {
      lineLog.style.opacity = showLog ? "0.25" : "0.05";
      lineLog.style.strokeWidth = "2.2";
      lineCrew.style.opacity = "1";
      lineCrew.style.strokeWidth = "3";
    } else {
      lineLog.style.opacity = showLog ? "0.7" : "0.05";
      lineCrew.style.opacity = showCrew ? "0.7" : "0.05";
      lineLog.style.strokeWidth = "2.2";
      lineCrew.style.strokeWidth = "2.2";
    }
  }

  function computePeak(data, key) {
    return data.reduce((acc, d) => (d[key] > acc[key] ? d : acc), data[0]);
  }

  const peaks = {
    raw: {
      logbook: rawData.length ? computePeak(rawData, "logbook") : null,
      crew: rawData.length ? computePeak(rawData, "crew") : null,
    },
    smooth: {
      logbook: smoothData.length ? computePeak(smoothData, "logbook") : null,
      crew: smoothData.length ? computePeak(smoothData, "crew") : null,
    },
  };

  function setPeakVisibility(focusKey) {
    const key = focusKey || activeFilter || hoverKey;
    Object.entries(peakGroups).forEach(([k, peak]) => {
      if (key) {
        peak.group.style.opacity = k === key ? "1" : "0";
      } else {
        peak.group.style.opacity = "0.45";
      }
    });
  }

  function renderFrame(data) {
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    const y = scaleLinear([0, 1], [h - size.m.bottom, size.m.top]);
    currentScales = { x, y };
    currentData = data;

    lineLog.setAttribute("d", linePath(data, x, y, "logbook"));
    lineCrew.setAttribute("d", linePath(data, x, y, "crew"));

    const avgData = data.map((d) => ({ year: d.year, value: (d.logbook + d.crew) / 2 }));
    const top = avgData.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.value)}`).join(" ");
    const bottom = avgData
      .slice()
      .reverse()
      .map((d, i) => `${i === 0 ? "L" : "L"} ${x(d.year)} ${y(0)}`)
      .join(" ");
    area.setAttribute("d", `${top} ${bottom} Z`);

    const peakSet = peaks[mode] || peaks.raw;
    Object.entries(peakGroups).forEach(([key, peak]) => {
      const point = peakSet[key];
      if (!point) return;
      const px = x(point.year);
      const py = y(point[key]);
      peak.dot.setAttribute("cx", px);
      peak.dot.setAttribute("cy", py);
      peak.dot.setAttribute("r", "4.6");
      peak.label.setAttribute("x", px + 10);
      peak.label.setAttribute("y", py - 10);
      peak.label.textContent = `${point.year}`;
    });

    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    axisY.setAttribute("transform", `translate(${size.m.left} 0)`);
    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);
    drawAxis(axisY, y, [0, 0.5, 1], "left", h - size.m.top - size.m.bottom, (v) =>
      `${Math.round(v * 100)}%`,
    );
  }

  function findNearestPoint(pixelX) {
    const data = currentData.length ? currentData : getData();
    if (!data.length) return null;
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = data[0];
    let minDiff = Math.abs(nearest.year - year);
    data.forEach((d) => {
      const diff = Math.abs(d.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    });
    return nearest;
  }

  function updateTooltip(point) {
    if (!point || !currentScales) return;
    const { x, y } = currentScales;
    const xPos = x(point.year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", size.m.top);
    focusLine.setAttribute("y2", size.h - size.m.bottom);

    const keys = visibleKeys();
    keys.forEach((key) => {
      const dot = focusDots[key];
      if (!dot) return;
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", y(point[key]));
      dot.setAttribute("r", "4.5");
      dot.style.opacity = "1";
    });
    Object.keys(focusDots).forEach((key) => {
      if (!keys.includes(key)) focusDots[key].style.opacity = "0";
    });

    if (tooltipTitle && tooltipRows) {
      tooltipTitle.textContent = `${point.year}`;
      tooltipRows.innerHTML = "";
      if (keys.includes("logbook")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--logbook";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Logbook"));
        const value = document.createElement("div");
        value.textContent = `${(point.logbook * 100).toFixed(1).replace(".", ",")}%`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
      if (keys.includes("crew")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--crew";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Crew list"));
        const value = document.createElement("div");
        value.textContent = `${(point.crew * 100).toFixed(1).replace(".", ",")}%`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
    }

    const rect = container.getBoundingClientRect();
    let left = (xPos / size.w) * rect.width;
    let top = (y((point.logbook + point.crew) / 2) / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    focusGroup.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  }

  function update(step) {
    currentStep = step;
    const notes = [
      "Доля рейсов с logbook и crew list — рост наблюдаемости.",
      "Logbook растёт быстрее, чем crew list.",
      "Административная видимость становится инфраструктурой.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
    const focusMap = { 0: null, 1: "logbook", 2: "crew" };
    const focus = focusMap[step] ?? null;
    const emphasis = hoverKey ?? focus ?? activeFilter;
    applyEmphasis(emphasis);
    setPeakVisibility(emphasis);
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    if (isAnimating) return;
    const nextData = nextMode === "smooth" ? smoothData : rawData;
    if (!nextData.length) return;
    const startData = currentData.length ? currentData : getData();
    const duration = 700;
    const start = performance.now();

    isAnimating = true;
    mode = nextMode;
    updateControls();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const frameData = startData.map((d, i) => ({
        year: d.year,
        logbook: lerp(d.logbook, nextData[i]?.logbook ?? d.logbook, eased),
        crew: lerp(d.crew, nextData[i]?.crew ?? d.crew, eased),
      }));
      renderFrame(frameData);
      update(currentStep);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        currentData = nextData;
        isAnimating = false;
        renderFrame(currentData);
        update(currentStep);
      }
    };

    requestAnimationFrame(tick);
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "smooth" ? "smooth" : "raw";
        setMode(nextMode);
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        hoverKey = null;
        updateLegend();
        update(currentStep);
      });
    });
    updateLegend();
  }

  lineLog.addEventListener("mouseenter", () => {
    hoverKey = "logbook";
    update(currentStep);
  });
  lineLog.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });
  lineCrew.addEventListener("mouseenter", () => {
    hoverKey = "crew";
    update(currentStep);
  });
  lineCrew.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });

  svg.addEventListener("mousemove", (event) => {
    if (!currentScales) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const point = findNearestPoint(pixelX);
    updateTooltip(point);
  });

  svg.addEventListener("mouseleave", hideTooltip);

  function resize() {
    renderFrame(currentData.length ? currentData : getData());
  }

  renderFrame(getData());
  update(0);
  updateControls();
  updateLegend();
  return { resize, update };
}

function createVoyageChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const axisX = createGroup(root, "axis axis--x");
  const axisYLeft = createGroup(root, "axis axis--y");
  const axisYRight = createGroup(root, "axis axis--y");

  const area = createPath(root, "area area--voyages");
  const lineVoy = createPath(root, "line line--voyages");
  const line = createPath(root, "line line--duration");
  const peakGroups = {
    voyages: (() => {
      const group = createGroup(root, "peak peak--voyages");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
    duration: (() => {
      const group = createGroup(root, "peak peak--duration");
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "peak__dot");
      group.appendChild(dot);
      const label = createText(group, "peak__label");
      return { group, dot, label };
    })(),
  };

  const focusGroup = createGroup(root, "focus");
  const focusLine = createLine(focusGroup, "focus-line");
  const focusDots = {
    voyages: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--voyages");
      focusGroup.appendChild(dot);
      return dot;
    })(),
    duration: (() => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "focus-dot focus-dot--duration");
      focusGroup.appendChild(dot);
      return dot;
    })(),
  };
  focusGroup.style.opacity = "0";

  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);

  const controls = container.closest(".scene__visual")?.querySelector("#controls-voyages");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-voyages");

  let size = { w: 0, h: 0, m: { top: 60, right: 70, bottom: 50, left: 70 } };
  let mode = "raw";
  let activeFilter = null;
  let currentScales = null;
  let currentData = [];
  let currentStep = 0;
  let hoverKey = null;
  let hoverActive = false;
  let isAnimating = false;

  const rawData = DATA.voyages || [];
  const years = rawData.map((d) => d.year);

  function smoothSeries(data, windowSize = 5) {
    if (!data.length) return [];
    const half = Math.floor(windowSize / 2);
    return data.map((d, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(data.length - 1, i + half);
      const slice = data.slice(start, end + 1);
      const avgVoy = slice.reduce((acc, v) => acc + v.voyages, 0) / slice.length;
      const avgDur = slice.reduce((acc, v) => acc + v.duration, 0) / slice.length;
      return { year: d.year, voyages: avgVoy, duration: avgDur };
    });
  }

  const smoothData = smoothSeries(rawData, 5);

  function computePeak(data, key) {
    return data.reduce((acc, d) => (d[key] > acc[key] ? d : acc), data[0]);
  }

  const peaks = {
    raw: {
      voyages: rawData.length ? computePeak(rawData, "voyages") : null,
      duration: rawData.length ? computePeak(rawData, "duration") : null,
    },
    smooth: {
      voyages: smoothData.length ? computePeak(smoothData, "voyages") : null,
      duration: smoothData.length ? computePeak(smoothData, "duration") : null,
    },
  };

  const vMax = Math.max(
    ...rawData.map((d) => d.voyages),
    ...(smoothData.length ? smoothData.map((d) => d.voyages) : []),
  ) * 1.15;
  const dMax = Math.max(
    ...rawData.map((d) => d.duration),
    ...(smoothData.length ? smoothData.map((d) => d.duration) : []),
  ) * 1.15;

  function getData() {
    return mode === "smooth" && smoothData.length ? smoothData : rawData;
  }

  function visibleKeys() {
    return activeFilter ? [activeFilter] : ["voyages", "duration"];
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = activeFilter && key !== activeFilter;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function applyEmphasis(emphasis) {
    const focusKey = emphasis || activeFilter;
    const showVoy = !activeFilter || activeFilter === "voyages";
    const showDur = !activeFilter || activeFilter === "duration";

    area.style.pointerEvents = showVoy ? "auto" : "none";
    lineVoy.style.pointerEvents = showVoy ? "auto" : "none";
    line.style.pointerEvents = showDur ? "auto" : "none";

    if (focusKey === "voyages") {
      area.style.opacity = "0.18";
      lineVoy.style.opacity = "1";
      lineVoy.style.strokeWidth = "1.1";
      line.style.opacity = showDur ? "0.25" : "0.05";
      line.style.strokeWidth = "1.05";
    } else if (focusKey === "duration") {
      area.style.opacity = showVoy ? "0.08" : "0.03";
      lineVoy.style.opacity = showVoy ? "0.35" : "0.05";
      lineVoy.style.strokeWidth = "0.95";
      line.style.opacity = "1";
      line.style.strokeWidth = "1.15";
    } else {
      area.style.opacity = showVoy ? "0.12" : "0.03";
      lineVoy.style.opacity = showVoy ? "0.85" : "0.05";
      lineVoy.style.strokeWidth = "1.0";
      line.style.opacity = showDur ? "0.75" : "0.05";
      line.style.strokeWidth = "1.05";
    }
  }

  function setPeakVisibility(focusKey) {
    const key = focusKey || activeFilter || (hoverKey ?? null);
    Object.entries(peakGroups).forEach(([k, peak]) => {
      if (key) {
        peak.group.style.opacity = k === key ? "1" : "0";
      } else {
        peak.group.style.opacity = "0.5";
      }
    });
  }

  function renderFrame(data) {
    if (!data.length) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size = { w, h, m: size.m };
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const x = scaleLinear([years[0], years[years.length - 1]], [size.m.left, w - size.m.right]);
    const yVoy = scaleLinear([0, vMax], [h - size.m.bottom, size.m.top]);
    const yDur = scaleLinear([0, dMax], [h - size.m.bottom, size.m.top]);
    currentScales = { x, yVoy, yDur };
    currentData = data;

    area.setAttribute("d", areaPath(data, x, yVoy, "voyages", h - size.m.bottom));
    lineVoy.setAttribute("d", linePath(data, x, yVoy, "voyages"));
    line.setAttribute("d", linePath(data, x, yDur, "duration"));

    axisX.setAttribute("transform", `translate(0 ${h - size.m.bottom})`);
    axisYLeft.setAttribute("transform", `translate(${size.m.left} 0)`);
    axisYRight.setAttribute("transform", `translate(${w - size.m.right} 0)`);

    drawAxis(axisX, x, decadeTicks(years), "bottom", w - size.m.left - size.m.right);
    drawAxis(axisYLeft, yVoy, [0, Math.round(vMax / 2), Math.round(vMax)], "left", h - size.m.top - size.m.bottom);
    drawAxis(axisYRight, yDur, [0, Math.round(dMax / 2), Math.round(dMax)], "left", h - size.m.top - size.m.bottom);

    axisYRight.querySelectorAll("text").forEach((t) => t.setAttribute("text-anchor", "start"));
    axisYRight.querySelectorAll("text").forEach((t) => {
      t.setAttribute("x", 10);
    });
    axisYRight.querySelectorAll("line").forEach((lineEl) => {
      lineEl.setAttribute("x1", 0);
      lineEl.setAttribute("x2", 6);
    });

    const peakSet = peaks[mode] || peaks.raw;
    Object.entries(peakGroups).forEach(([key, group]) => {
      const peak = peakSet[key];
      if (!peak) return;
      const px = x(peak.year);
      const py = key === "voyages" ? yVoy(peak.voyages) : yDur(peak.duration);
      group.dot.setAttribute("cx", px);
      group.dot.setAttribute("cy", py);
      group.dot.setAttribute("r", "4.8");
      group.label.setAttribute("x", px + 10);
      group.label.setAttribute("y", py - 10);
      group.label.textContent = `${peak.year}`;
    });
  }

  function findNearestPoint(pixelX) {
    const data = currentData.length ? currentData : getData();
    if (!data.length) return null;
    const left = size.m.left;
    const right = size.w - size.m.right;
    const clamped = Math.min(Math.max(pixelX, left), right);
    const year =
      years[0] + ((clamped - left) / (right - left || 1)) * (years[years.length - 1] - years[0]);
    let nearest = data[0];
    let minDiff = Math.abs(nearest.year - year);
    data.forEach((d) => {
      const diff = Math.abs(d.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = d;
      }
    });
    return nearest;
  }

  function updateTooltip(point) {
    if (!point || !currentScales) return;
    const { x, yVoy, yDur } = currentScales;
    const xPos = x(point.year);
    focusGroup.style.opacity = "1";
    focusLine.setAttribute("x1", xPos);
    focusLine.setAttribute("x2", xPos);
    focusLine.setAttribute("y1", size.m.top);
    focusLine.setAttribute("y2", size.h - size.m.bottom);

    const keys = visibleKeys();
    keys.forEach((key) => {
      const dot = focusDots[key];
      if (!dot) return;
      dot.setAttribute("cx", xPos);
      dot.setAttribute("cy", key === "voyages" ? yVoy(point.voyages) : yDur(point.duration));
      dot.setAttribute("r", "4.5");
      dot.style.opacity = "1";
    });
    Object.keys(focusDots).forEach((key) => {
      if (!keys.includes(key)) focusDots[key].style.opacity = "0";
    });

    if (tooltipTitle && tooltipRows) {
      tooltipTitle.textContent = `${point.year}`;
      tooltipRows.innerHTML = "";
      if (keys.includes("voyages")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--voyages";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Рейсы"));
        const value = document.createElement("div");
        value.textContent = `${Math.round(point.voyages)}`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
      if (keys.includes("duration")) {
        const row = document.createElement("div");
        row.className = "chart__tooltip-row";
        const label = document.createElement("div");
        label.className = "chart__tooltip-label";
        const swatch = document.createElement("span");
        swatch.className = "chart__tooltip-swatch chart__tooltip-swatch--duration";
        label.appendChild(swatch);
        label.appendChild(document.createTextNode("Длительность"));
        const value = document.createElement("div");
        value.textContent = `${point.duration.toFixed(2).replace(".", ",")} лет`;
        row.appendChild(label);
        row.appendChild(value);
        tooltipRows.appendChild(row);
      }
    }

    const rect = container.getBoundingClientRect();
    let left = (xPos / size.w) * rect.width;
    let top = ((yVoy(point.voyages) + yDur(point.duration)) / 2 / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    focusGroup.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  }

  function update(step) {
    currentStep = step;
    if (noteEl) {
      noteEl.textContent =
        "График сопоставляет число завершённых рейсов и среднюю длительность рейса по году возвращения. Первая линия отражает масштаб промысла, вторая — временную нагрузку одной операции. Сопоставление используется для анализа фаз и организационной перестройки промысла.";
    }

    const focusMap = { 0: "voyages", 1: "duration", 2: null };
    const focus = focusMap[step] ?? null;
    const emphasis = hoverKey ?? focus ?? activeFilter;
    applyEmphasis(emphasis);
    setPeakVisibility(emphasis);
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === mode) return;
    if (isAnimating) return;
    const nextData = nextMode === "smooth" ? smoothData : rawData;
    if (!nextData.length) return;

    const startData = currentData.length ? currentData : getData();
    const duration = 700;
    const start = performance.now();

    isAnimating = true;
    mode = nextMode;
    updateControls();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const frameData = startData.map((d, i) => ({
        year: d.year,
        voyages: lerp(d.voyages, nextData[i]?.voyages ?? d.voyages, eased),
        duration: lerp(d.duration, nextData[i]?.duration ?? d.duration, eased),
      }));
      renderFrame(frameData);
      update(currentStep);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        currentData = nextData;
        isAnimating = false;
        renderFrame(currentData);
        update(currentStep);
      }
    };

    requestAnimationFrame(tick);
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === "smooth" ? "smooth" : "raw";
        setMode(nextMode);
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        activeFilter = activeFilter === key ? null : key;
        hoverKey = null;
        updateLegend();
        update(currentStep);
      });
    });
    updateLegend();
  }

  svg.addEventListener("mousemove", (event) => {
    if (!currentScales) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = size.w / rect.width;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const point = findNearestPoint(pixelX);
    hoverActive = true;
    updateTooltip(point);
  });

  svg.addEventListener("mouseleave", () => {
    hoverActive = false;
    hideTooltip();
  });

  lineVoy.addEventListener("mouseenter", () => {
    hoverKey = "voyages";
    update(currentStep);
  });
  lineVoy.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });
  line.addEventListener("mouseenter", () => {
    hoverKey = "duration";
    update(currentStep);
  });
  line.addEventListener("mouseleave", () => {
    hoverKey = null;
    update(currentStep);
  });

  function resize() {
    renderFrame(currentData.length ? currentData : getData());
  }

  renderFrame(getData());
  update(0);
  updateControls();
  updateLegend();
  return { resize, update };
}

function createGeographyChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const fallbackGeography = {
    early: [
      { x: 0.941, y: 0.576 },
      { x: 0.45, y: 0.708 },
      { x: 0.265, y: 0.459 },
      { x: 0.546, y: 0.307 },
    ],
    mid: [
      { x: 0.772, y: 0.95 },
      { x: 0.268, y: 0.804 },
      { x: 0.103, y: 0.482 },
      { x: 0.333, y: 0.22 },
      { x: 0.701, y: 0.237 },
      { x: 0.868, y: 0.517 },
    ],
    late: [
      { x: 0.096, y: 0.95 },
      { x: 0.05, y: 0.667 },
      { x: 0.05, y: 0.255 },
      { x: 0.364, y: 0.059 },
      { x: 0.767, y: 0.112 },
      { x: 0.95, y: 0.387 },
      { x: 0.949, y: 0.723 },
      { x: 0.632, y: 0.927 },
    ],
  };

  const geo = DATA.geography || fallbackGeography;
  const arcsEarly = createGroup(root, "arc-group arc-group--early");
  const arcsMid = createGroup(root, "arc-group arc-group--mid");
  const arcsLate = createGroup(root, "arc-group arc-group--late");
  const centerDot = document.createElementNS(svgNS, "circle");
  centerDot.setAttribute("r", "6");
  centerDot.setAttribute("class", "marker");
  root.appendChild(centerDot);

  let size = { w: 0, h: 0, m: 80 };

  function drawArcs(group, points, cx, cy, w, h) {
    group.innerHTML = "";
    points.forEach((pt) => {
      const x = size.m + pt.x * (w - size.m * 2);
      const y = size.m + pt.y * (h - size.m * 2);
      const mx = (cx + x) / 2;
      const my = (cy + y) / 2 - 50;
      const path = createPath(group, "geo-arc");
      path.setAttribute("d", `M ${cx} ${cy} Q ${mx} ${my} ${x} ${y}`);
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", "4");
      dot.setAttribute("class", "geo-point");
      group.appendChild(dot);
    });
  }

  function resize() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size.w = w;
    size.h = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const cx = w * 0.45;
    const cy = h * 0.55;
    centerDot.setAttribute("cx", cx);
    centerDot.setAttribute("cy", cy);
    drawArcs(arcsEarly, geo.early || [], cx, cy, w, h);
    drawArcs(arcsMid, geo.mid || [], cx, cy, w, h);
    drawArcs(arcsLate, geo.late || [], cx, cy, w, h);
  }

  function update(step) {
    const opacities = [
      { early: 1, mid: 0.15, late: 0.05 },
      { early: 0.35, mid: 1, late: 0.2 },
      { early: 0.2, mid: 0.4, late: 1 },
    ];
    const state = opacities[step] || opacities[0];
    arcsEarly.style.opacity = state.early;
    arcsMid.style.opacity = state.mid;
    arcsLate.style.opacity = state.late;

    const notes = [
      "Ранние маршруты держатся ближе к портам",
      "Промысел смещается в новые зоны",
      "Поздний этап — максимально удалённые воды",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
  }

  resize();
  update(0);
  return { resize, update };
}

function createArchiveChart(container, noteEl) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const gridGroup = createGroup(root, "archive-grid");
  const labelGroup = createGroup(root, "archive-labels");
  const focusRect = createRect(root, "archive-focus");
  focusRect.style.opacity = "0";
  const tooltip = document.createElement("div");
  tooltip.className = "chart__tooltip";
  tooltip.innerHTML = '<div class="chart__tooltip-title"></div><div class="chart__tooltip-rows"></div>';
  const tooltipTitle = tooltip.querySelector(".chart__tooltip-title");
  const tooltipRows = tooltip.querySelector(".chart__tooltip-rows");
  container.appendChild(tooltip);
  const controls = container.closest(".scene__visual")?.querySelector("#controls-archive");
  const legend = container.closest(".scene__visual")?.querySelector("#legend-archive");

  let cells = [];
  let size = { w: 0, h: 0, m: 70 };
  let layout = null;
  let currentLayer = "overall";
  let currentPeriod = null;
  let currentStep = 0;

  function resize() {
    const data = DATA.archiveLayers;
    if (!data) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    size.w = w;
    size.h = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    gridGroup.innerHTML = "";
    labelGroup.innerHTML = "";
    cells = [];

    const rows = data.rows;
    const cols = data.cols;
    const totalRows = rows * 3;
    const cellW = (w - size.m * 2) / cols;
    const cellH = (h - size.m * 2) / totalRows;
    layout = { rows, cols, totalRows, cellW, cellH, x0: size.m, y0: size.m };

    const periodLabels = ["Ранний", "Средний", "Поздний"];
    periodLabels.forEach((label, idx) => {
      const t = createText(labelGroup, "archive-label");
      t.setAttribute("x", size.m - 10);
      t.setAttribute("y", size.m + cellH * (rows * idx + 1.2));
      t.setAttribute("text-anchor", "end");
      t.textContent = label;
    });

    let index = 0;
    for (let r = 0; r < totalRows; r++) {
      const period = r < rows ? "early" : r < rows * 2 ? "mid" : "late";
      const localRow = r % rows;
      for (let c = 0; c < cols; c++) {
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", size.m + c * cellW);
        rect.setAttribute("y", size.m + r * cellH);
        rect.setAttribute("width", Math.max(2, cellW - 3));
        rect.setAttribute("height", Math.max(2, cellH - 3));
        rect.setAttribute("class", "archive-cell");
        rect.dataset.index = String(localRow * cols + c);
        rect.dataset.period = period;
        gridGroup.appendChild(rect);
        cells.push(rect);
        index += 1;
      }
    }
  }

  function applyLayer() {
    const data = DATA.archiveLayers;
    if (!data) return;
    const layerData = data.layers[currentLayer];
    cells.forEach((cell) => {
      const idx = Number(cell.dataset.index);
      const period = cell.dataset.period;
      const missing = layerData?.[period] || [];
      if (missing.includes(idx)) cell.classList.add("archive-cell--missing");
      else cell.classList.remove("archive-cell--missing");
    });
  }

  function applyPeriodFilter() {
    cells.forEach((cell) => {
      const isMuted = currentPeriod && cell.dataset.period !== currentPeriod;
      cell.classList.toggle("is-muted", Boolean(isMuted));
    });
  }

  function updateLegend() {
    if (!legend) return;
    const buttons = Array.from(legend.querySelectorAll(".legend__item"));
    buttons.forEach((button) => {
      const key = button.dataset.line;
      const isMuted = currentPeriod && key !== currentPeriod;
      button.classList.toggle("is-muted", Boolean(isMuted));
      button.classList.toggle("is-active", !isMuted);
    });
  }

  function updateControls() {
    if (!controls) return;
    const buttons = Array.from(controls.querySelectorAll(".chart__toggle"));
    buttons.forEach((button) => {
      const active = button.dataset.layer === currentLayer;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function update(step) {
    currentStep = step;
    const layerNames = ["overall", "tech", "labor", "ecology"];
    currentLayer = layerNames[Math.min(step, layerNames.length - 1)];
    updateControls();
    applyLayer();
    applyPeriodFilter();
    updateLegend();

    const notes = [
      "Суммарная карта пропусков по архивным слоям.",
      "Технический слой: rig и tonnage часто отсутствуют.",
      "Трудовой слой: crew list недоступен в ранних периодах.",
      "Экологический слой: logbook фиксирует лишь часть моря.",
    ];
    if (noteEl) noteEl.textContent = notes[step] || notes[0];
  }

  function showFocus(cell) {
    if (!layout) return;
    const index = Number(cell.dataset.index);
    const period = cell.dataset.period;
    const rows = layout.rows;
    const cols = layout.cols;
    const localRow = Math.floor(index / cols);
    const col = index % cols;
    const periodOffset = period === "early" ? 0 : period === "mid" ? rows : rows * 2;
    const r = localRow + periodOffset;
    const x = layout.x0 + col * layout.cellW;
    const y = layout.y0 + r * layout.cellH;
    focusRect.setAttribute("x", x + 1);
    focusRect.setAttribute("y", y + 1);
    focusRect.setAttribute("width", Math.max(2, layout.cellW - 3));
    focusRect.setAttribute("height", Math.max(2, layout.cellH - 3));
    focusRect.style.opacity = "1";
  }

  function hideFocus() {
    focusRect.style.opacity = "0";
  }

  function showTooltip(cell) {
    if (!layout || !cell) return;
    const index = Number(cell.dataset.index);
    const period = cell.dataset.period;
    const missing = cell.classList.contains("archive-cell--missing");
    tooltipTitle.textContent = `${period === "early" ? "Ранний" : period === "mid" ? "Средний" : "Поздний"} период`;
    tooltipRows.innerHTML = "";
    const row1 = document.createElement("div");
    row1.className = "chart__tooltip-row";
    const label = document.createElement("div");
    label.className = "chart__tooltip-label";
    label.textContent = "Ячейка";
    const value = document.createElement("div");
    value.textContent = `#${index + 1}`;
    row1.appendChild(label);
    row1.appendChild(value);
    tooltipRows.appendChild(row1);
    const row2 = document.createElement("div");
    row2.className = "chart__tooltip-row";
    const label2 = document.createElement("div");
    label2.className = "chart__tooltip-label";
    label2.textContent = "Статус";
    const value2 = document.createElement("div");
    value2.textContent = missing ? "Пропуск" : "Есть";
    row2.appendChild(label2);
    row2.appendChild(value2);
    tooltipRows.appendChild(row2);

    const rect = container.getBoundingClientRect();
    const x = parseFloat(cell.getAttribute("x") || "0") + layout.cellW / 2;
    const y = parseFloat(cell.getAttribute("y") || "0");
    let left = (x / size.w) * rect.width;
    let top = (y / size.h) * rect.height;
    const tipW = tooltip.offsetWidth || 180;
    const tipH = tooltip.offsetHeight || 60;
    const pad = 16;
    left = Math.min(Math.max(left, tipW / 2 + pad), rect.width - tipW / 2 - pad);
    top = Math.min(Math.max(top, tipH + pad), rect.height - pad);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
  }

  if (controls) {
    controls.querySelectorAll(".chart__toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const layer = button.dataset.layer;
        if (!layer) return;
        currentLayer = layer;
        updateControls();
        applyLayer();
      });
    });
  }

  if (legend) {
    legend.querySelectorAll(".legend__item").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.line;
        currentPeriod = currentPeriod === key ? null : key;
        applyPeriodFilter();
        updateLegend();
      });
    });
    updateLegend();
  }

  gridGroup.addEventListener("mousemove", (event) => {
    const target = event.target;
    if (!(target instanceof SVGRectElement)) return;
    if (!target.classList.contains("archive-cell")) return;
    if (currentPeriod && target.dataset.period !== currentPeriod) return;
    showFocus(target);
    showTooltip(target);
  });

  gridGroup.addEventListener("mouseleave", () => {
    hideFocus();
    hideTooltip();
  });

  resize();
  update(0);
  return { resize, update };
}

function createFinaleChart(container) {
  const svg = createSvg(container);
  const root = createGroup(svg, "chart-root");
  const ringGroup = createGroup(root, "finale-rings");
  const spiral = createPath(root, "finale-spiral");
  const limit = createPath(root, "finale-limit");
  const miniGroup = createGroup(root, "finale-mini");
  const miniAxis = createPath(miniGroup, "mini-axis");
  const miniPower = createPath(miniGroup, "mini-line mini-line--power");
  const miniResp = createPath(miniGroup, "mini-line mini-line--resp");
  const miniLabelPower = createText(miniGroup, "mini-label");
  const miniLabelResp = createText(miniGroup, "mini-label");
  const markerA = document.createElementNS(svgNS, "circle");
  const markerB = document.createElementNS(svgNS, "circle");
  markerA.setAttribute("class", "finale-marker");
  markerB.setAttribute("class", "finale-marker");
  root.appendChild(markerA);
  root.appendChild(markerB);
  const labelA = createText(root, "finale-label");
  const labelB = createText(root, "finale-label");
  const note = createText(root, "finale-note");

  function resize() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    ringGroup.innerHTML = "";

    const cx = w * 0.5;
    const cy = h * 0.52;
    const maxR = Math.min(w, h) * 0.38;

    for (let i = 0; i < 6; i++) {
      const ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("cx", cx);
      ring.setAttribute("cy", cy);
      ring.setAttribute("r", maxR * ((i + 1) / 6));
      ring.setAttribute("class", "finale-ring");
      ringGroup.appendChild(ring);
    }

    const spiralPoints = [];
    const loops = 3.2;
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * loops;
      const r = maxR * (0.15 + 0.75 * t);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r * 0.65;
      spiralPoints.push([x, y]);
    }
    spiral.setAttribute(
      "d",
      spiralPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" "),
    );

    const startAngle = Math.PI * 1.15;
    const endAngle = Math.PI * 1.82;
    const rLimit = maxR * 0.95;
    const x0 = cx + Math.cos(startAngle) * rLimit;
    const y0 = cy + Math.sin(startAngle) * rLimit;
    const x1 = cx + Math.cos(endAngle) * rLimit;
    const y1 = cy + Math.sin(endAngle) * rLimit;
    limit.setAttribute("d", `M ${x0} ${y0} A ${rLimit} ${rLimit} 0 0 1 ${x1} ${y1}`);

    markerA.setAttribute("cx", spiralPoints[Math.floor(steps * 0.32)][0]);
    markerA.setAttribute("cy", spiralPoints[Math.floor(steps * 0.32)][1]);
    markerA.setAttribute("r", "4.5");

    markerB.setAttribute("cx", spiralPoints[Math.floor(steps * 0.78)][0]);
    markerB.setAttribute("cy", spiralPoints[Math.floor(steps * 0.78)][1]);
    markerB.setAttribute("r", "5.5");

    labelA.setAttribute("x", spiralPoints[Math.floor(steps * 0.32)][0] + 10);
    labelA.setAttribute("y", spiralPoints[Math.floor(steps * 0.32)][1] - 10);
    labelA.textContent = "расширение";

    labelB.setAttribute("x", spiralPoints[Math.floor(steps * 0.78)][0] + 12);
    labelB.setAttribute("y", spiralPoints[Math.floor(steps * 0.78)][1] + 18);
    labelB.textContent = "предел";

    note.setAttribute("x", cx - maxR * 0.9);
    note.setAttribute("y", cy + maxR * 0.8);
    note.textContent = "Рост отодвигает предел, но не отменяет его";

    const miniW = maxR * 0.8;
    const miniH = maxR * 0.45;
    const miniX = cx - maxR * 0.95;
    const miniY = cy - maxR * 0.85;
    miniAxis.setAttribute(
      "d",
      `M ${miniX} ${miniY} L ${miniX} ${miniY + miniH} L ${miniX + miniW} ${miniY + miniH}`,
    );
    miniLabelPower.setAttribute("x", miniX);
    miniLabelPower.setAttribute("y", miniY - 8);
    miniLabelPower.textContent = "мощь";

    miniLabelResp.setAttribute("x", miniX + miniW);
    miniLabelResp.setAttribute("y", miniY + miniH + 18);
    miniLabelResp.setAttribute("text-anchor", "end");
    miniLabelResp.textContent = "ответственность";

    const respData = DATA.responsibility || [];
    if (respData.length) {
      const years = respData.map((d) => d.year);
      const x = scaleLinear([years[0], years[years.length - 1]], [miniX, miniX + miniW]);
      const y = scaleLinear([0, 1], [miniY + miniH, miniY]);
      miniPower.setAttribute(
        "d",
        respData.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.power)}`).join(" "),
      );
      miniResp.setAttribute(
        "d",
        respData.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.year)} ${y(d.responsibility)}`).join(" "),
      );
    }
  }

  resize();
  return { resize, update: () => {} };
}

function createCrewProfileChart(container) {
  if (!container || !DATA.crewSummary) return { resize: () => {}, update: () => {} };
  const agePanel = container.querySelector('[data-crew="age"]');
  const heightPanel = container.querySelector('[data-crew="height"]');
  if (!agePanel || !heightPanel) return { resize: () => {}, update: () => {} };

  const summary = DATA.crewSummary;
  const groupStats = new Map(summary.groups.map((d) => [d.group, d]));
  const labels = summary.labels || {};
  const groups = [
    "core_south_coast",
    "ct_ports",
    "atlantic_cities",
    "atlantic_islands",
    "cape_islands",
    "germany",
  ].filter((g) => groupStats.has(g));

  const formatCount = (value) => Number(value).toLocaleString("ru-RU");
  const formatValue = (value, unit = "") => {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const rounded = Math.round(value * 10) / 10;
    const formatted = `${rounded}`.replace(".", ",");
    return unit ? `${formatted}${unit}` : formatted;
  };

  function drawPanel(panelEl, key) {
    const rect = panelEl.getBoundingClientRect();
    const w = Math.max(360, rect.width || panelEl.offsetWidth || 0);
    const h = Math.max(220, rect.height || panelEl.offsetHeight || 0);
    const svg = createSvg(panelEl);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const left = Math.min(Math.max(220, w * 0.32), 360);
    const margin = { top: 18, right: 24, bottom: 26, left };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const rowH = innerH / groups.length;
    const values = groups.map((g) => groupStats.get(g));

    const p10s = values.map((d) => d[`${key}_p10`]);
    const p90s = values.map((d) => d[`${key}_p90`]);
    const min = Math.min(...p10s);
    const max = Math.max(...p90s);
    const pad = (max - min) * 0.08 || 1;
    const x = scaleLinear([min - pad, max + pad], [margin.left, margin.left + innerW]);

    const axis = createGroup(svg, "axis");
    axis.setAttribute("transform", `translate(0 ${margin.top + innerH})`);
    const ticks =
      key === "age"
        ? [10, 20, 30, 40, 50, 60, 70]
        : [60, 64, 68, 72, 76];
    drawAxis(axis, x, ticks, "bottom", innerW, (v) => String(v));

    const rows = [];
    values.forEach((d, i) => {
      const y = margin.top + rowH * i + rowH / 2;
      const row = createGroup(svg, "crew__row");
      row.dataset.index = String(i);

      const label = createText(row, "crew__label");
      label.setAttribute("x", margin.left - 12);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.textContent = `${labels[d.group] || d.group}  n=${formatCount(d.N)}`;

      const whisker = createLine(row, "crew__whisker");
      whisker.setAttribute("x1", x(d[`${key}_p10`]));
      whisker.setAttribute("x2", x(d[`${key}_p90`]));
      whisker.setAttribute("y1", y);
      whisker.setAttribute("y2", y);

      const box = createRect(row, "crew__box");
      const boxH = Math.min(16, rowH * 0.5);
      box.setAttribute("x", x(d[`${key}_p25`]));
      box.setAttribute("y", y - boxH / 2);
      box.setAttribute("width", Math.max(2, x(d[`${key}_p75`]) - x(d[`${key}_p25`])));
      box.setAttribute("height", boxH);

      const median = createLine(row, "crew__median");
      median.setAttribute("x1", x(d[`${key}_median`]));
      median.setAttribute("x2", x(d[`${key}_median`]));
      median.setAttribute("y1", y - boxH / 2);
      median.setAttribute("y2", y + boxH / 2);

      const mean = document.createElementNS(svgNS, "circle");
      mean.setAttribute("class", "crew__mean");
      mean.setAttribute("cx", x(d[`${key}_mean`]));
      mean.setAttribute("cy", y);
      mean.setAttribute("r", 2.5);
      row.appendChild(mean);
      rows.push({ row, data: d, y });
    });

    panelEl.style.position = "relative";
    let tooltip = panelEl.querySelector(".crew__tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "chart__tooltip crew__tooltip";
      panelEl.appendChild(tooltip);
    }

    function showTooltip(idx, clientY) {
      rows.forEach((r) => r.row.classList.toggle("is-active", r === rows[idx]));
      const d = rows[idx]?.data;
      if (!d) return;
      tooltip.innerHTML = `
        <div class="chart__tooltip-title">${labels[d.group] || d.group}</div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">N</div><div>${formatCount(d.N)}</div></div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">P10–P90</div><div>${formatValue(
          d[`${key}_p10`],
        )}–${formatValue(d[`${key}_p90`])}</div></div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">Медиана</div><div>${formatValue(
          d[`${key}_median`],
        )}</div></div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">Среднее</div><div>${formatValue(
          d[`${key}_mean`],
        )}</div></div>
      `;
      tooltip.classList.add("is-visible");
      const bounds = panelEl.getBoundingClientRect();
      const top = Math.min(bounds.height - 90, Math.max(8, clientY - bounds.top - 30));
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${bounds.width - 220}px`;
    }

    function hideTooltip() {
      rows.forEach((r) => r.row.classList.remove("is-active"));
      tooltip.classList.remove("is-visible");
    }

    svg.addEventListener("mousemove", (event) => {
      const bounds = panelEl.getBoundingClientRect();
      const y = event.clientY - bounds.top;
      const idx = Math.floor((y - margin.top) / rowH);
      if (idx < 0 || idx >= rows.length) {
        hideTooltip();
        return;
      }
      showTooltip(idx, event.clientY);
    });
    svg.addEventListener("mouseleave", hideTooltip);
  }

  function resize() {
    drawPanel(agePanel, "age");
    drawPanel(heightPanel, "height");
  }

  resize();
  return { resize, update: () => {} };
}

function createCrewGeoChart(container) {
  if (!container || !DATA.crewSummary) return { resize: () => {}, update: () => {} };
  const agePanel = container.querySelector('[data-crew="age"]');
  const heightPanel = container.querySelector('[data-crew="height"]');
  if (!agePanel || !heightPanel) return { resize: () => {}, update: () => {} };

  const summary = DATA.crewSummary;
  const groupStats = new Map(summary.groups.map((d) => [d.group, d]));
  const labels = summary.labels || {};
  const ref = "core_south_coast";
  const groups = [
    "core_south_coast",
    "ct_ports",
    "atlantic_cities",
    "atlantic_islands",
    "cape_islands",
    "germany",
    "other",
  ].filter((g) => groupStats.has(g));

  const formatCount = (value) => Number(value).toLocaleString("ru-RU");

  function drawCoef(panelEl, coeffs, ticks) {
    const rect = panelEl.getBoundingClientRect();
    const w = Math.max(360, rect.width || panelEl.offsetWidth || 0);
    const h = Math.max(220, rect.height || panelEl.offsetHeight || 0);
    const svg = createSvg(panelEl);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const left = Math.min(Math.max(220, w * 0.32), 360);
    const margin = { top: 18, right: 24, bottom: 26, left };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;
    const rowH = innerH / groups.length;

    const values = groups.map((g) => (g === ref ? 0 : coeffs[g] || 0));
    const maxAbs = Math.max(0.2, ...values.map((v) => Math.abs(v))) * 1.25;
    const x = scaleLinear([-maxAbs, maxAbs], [margin.left, margin.left + innerW]);

    const axis = createGroup(svg, "axis");
    axis.setAttribute("transform", `translate(0 ${margin.top + innerH})`);
    drawAxis(axis, x, ticks, "bottom", innerW, (v) => v.toFixed(1).replace(".0", ""));

    const zero = createLine(svg, "crew__zero");
    zero.setAttribute("x1", x(0));
    zero.setAttribute("x2", x(0));
    zero.setAttribute("y1", margin.top - 6);
    zero.setAttribute("y2", margin.top + innerH + 6);

    const rows = [];
    groups.forEach((g, i) => {
      const y = margin.top + rowH * i + rowH / 2;
      const row = createGroup(svg, "crew__row");
      row.dataset.index = String(i);

      const label = createText(row, "crew__label");
      label.setAttribute("x", margin.left - 12);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.textContent = `${labels[g] || g}  n=${formatCount(groupStats.get(g).N)}`;

      const value = g === ref ? 0 : coeffs[g] || 0;
      const line = createLine(row, "crew__coef");
      line.setAttribute("x1", x(0));
      line.setAttribute("x2", x(value));
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);

      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "crew__dot");
      dot.setAttribute("cx", x(value));
      dot.setAttribute("cy", y);
      dot.setAttribute("r", 3);
      row.appendChild(dot);
      rows.push({ row, group: g, value });
    });

    panelEl.style.position = "relative";
    let tooltip = panelEl.querySelector(".crew__tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "chart__tooltip crew__tooltip";
      panelEl.appendChild(tooltip);
    }

    function showTooltip(idx, clientY) {
      rows.forEach((r) => r.row.classList.toggle("is-active", r === rows[idx]));
      const row = rows[idx];
      if (!row) return;
      const unit = ticks.includes(2) ? " года" : "″";
      tooltip.innerHTML = `
        <div class="chart__tooltip-title">${labels[row.group] || row.group}</div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">Смещение</div><div>${formatValue(
          row.value,
          unit,
        )}</div></div>
        <div class="chart__tooltip-row"><div class="chart__tooltip-label">N</div><div>${formatCount(
          groupStats.get(row.group).N,
        )}</div></div>
      `;
      tooltip.classList.add("is-visible");
      const bounds = panelEl.getBoundingClientRect();
      const top = Math.min(bounds.height - 70, Math.max(8, clientY - bounds.top - 26));
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${bounds.width - 220}px`;
    }

    function hideTooltip() {
      rows.forEach((r) => r.row.classList.remove("is-active"));
      tooltip.classList.remove("is-visible");
    }

    svg.addEventListener("mousemove", (event) => {
      const bounds = panelEl.getBoundingClientRect();
      const y = event.clientY - bounds.top;
      const idx = Math.floor((y - margin.top) / rowH);
      if (idx < 0 || idx >= rows.length) {
        hideTooltip();
        return;
      }
      showTooltip(idx, event.clientY);
    });
    svg.addEventListener("mouseleave", hideTooltip);
  }

  function resize() {
    drawCoef(agePanel, summary.regression.age.coefficients, [-2, -1, 0, 1, 2]);
    drawCoef(heightPanel, summary.regression.height.coefficients, [-0.5, 0, 0.5]);
  }

  resize();
  return { resize, update: () => {} };
}

function bootChartsAndScenes() {
  if (window.__chartsBooted) return;
  window.__chartsBooted = true;
  const charts = {
  rhythms: createProductChart(document.getElementById("chart-rhythms"), document.getElementById("note-rhythms")),
  shares: createShareChart(document.getElementById("chart-shares"), document.getElementById("note-shares")),
  yield: createYieldChart(document.getElementById("chart-yield"), document.getElementById("note-yield")),
  divergence: createDivergenceChart(
    document.getElementById("chart-divergence"),
    document.getElementById("note-divergence"),
  ),
  voyages: createVoyageChart(document.getElementById("chart-voyages"), document.getElementById("note-voyages")),
  geography: createGeographyChart(
    document.getElementById("chart-geography"),
    document.getElementById("note-geography"),
  ),
  finale: createFinaleChart(document.getElementById("chart-finale")),
  "crew-profile": createCrewProfileChart(document.getElementById("chart-crew-profile")),
  "crew-geography": createCrewGeoChart(document.getElementById("chart-crew-geography")),
  };

const resizeObserver = new ResizeObserver(() => {
  Object.values(charts).forEach((chart) => chart.resize());
});

Object.keys(charts).forEach((key) => {
  const el = document.getElementById(`chart-${key}`);
  if (el) resizeObserver.observe(el);
});

const sceneTexts = document.querySelectorAll(".scene__text");
sceneTexts.forEach((text) => {
  if (text.querySelector(".scene__release")) return;
  const release = document.createElement("div");
  release.className = "scene__release";
  release.setAttribute("aria-hidden", "true");
  text.appendChild(release);
});

const steps = Array.from(document.querySelectorAll(".step"));
const sceneMap = new Map();

steps.forEach((step) => {
  const scene = step.closest("[data-scene]");
  if (!scene) return;
  const sceneId = scene.dataset.scene;
  if (!sceneMap.has(sceneId)) sceneMap.set(sceneId, []);
  sceneMap.get(sceneId).push(step);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const step = entry.target;
      const scene = step.closest("[data-scene]");
      if (!scene) return;
      const sceneId = scene.dataset.scene;
      const stepIndex = Number(step.dataset.step || 0);
      const sceneSteps = sceneMap.get(sceneId) || [];
      sceneSteps.forEach((s) => s.classList.toggle("is-active", s === step));
      const chart = charts[sceneId];
      if (chart && typeof chart.update === "function") chart.update(stepIndex);
      scene.dataset.reading = "true";
      scene.classList.add("is-reading");
      delete scene.dataset.post;
      setActiveScene(sceneId);
    });
  },
  { threshold: 0.3 },
);

steps.forEach((step) => observer.observe(step));

const sceneReleaseObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const release = entry.target;
      const scene = release.closest(".scene");
      if (!scene) return;
      if (entry.isIntersecting) {
        if (scene.dataset.reading === "true") return;
        scene.dataset.post = "true";
        delete scene.dataset.reading;
      } else {
        delete scene.dataset.post;
      }
    });
  },
  { rootMargin: "-30% 0px -30% 0px", threshold: 0 },
);

document.querySelectorAll(".scene__release").forEach((release) => {
  sceneReleaseObserver.observe(release);
});

const sceneTextObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const text = entry.target;
      const scene = text.closest(".scene");
      if (!scene) return;
      if (entry.isIntersecting) {
        scene.dataset.reading = "true";
        scene.classList.add("is-reading");
        delete scene.dataset.post;
      } else {
        delete scene.dataset.reading;
        scene.classList.remove("is-reading");
      }
    });
  },
  { rootMargin: "-30% 0px -30% 0px", threshold: 0 },
);

sceneTexts.forEach((text) => {
  sceneTextObserver.observe(text);
});

  const hero = document.getElementById("top");
  if (hero) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveScene("hero");
        });
      },
      { threshold: 0.4 },
    );
    heroObserver.observe(hero);
  }
}

bootChartsAndScenes();

const framingSupNotes = document.querySelectorAll(".framing__lead sup[data-note]");
const framingNotes = document.querySelectorAll(".framing__note");

function toggleFramingNote(noteId) {
  framingNotes.forEach((note) => {
    const isActive = note.dataset.note === noteId;
    note.classList.toggle("is-active", isActive);
    note.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
}

function clearFramingNotes() {
  framingNotes.forEach((note) => {
    note.classList.remove("is-active");
    note.setAttribute("aria-hidden", "true");
  });
}

framingSupNotes.forEach((sup) => {
  sup.addEventListener("click", (event) => {
    event.stopPropagation();
    const noteId = sup.dataset.note;
    if (!noteId) return;
    const target = document.querySelector(`.framing__note[data-note="${noteId}"]`);
    const isActive = target?.classList.contains("is-active");
    if (isActive) {
      clearFramingNotes();
    } else {
      toggleFramingNote(noteId);
    }
  });

  sup.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      sup.click();
    }
  });
});

document.addEventListener("click", () => {
  clearFramingNotes();
});

// Footnotes for product rhythms now live inline after the text block.

const methodNavItems = document.querySelectorAll(".method__nav-item");
const methodSections = document.querySelectorAll(".method__section");
const methodMarginNote = document.querySelector(".method__margin-note");
const methodAggNote = document.querySelector(".margin-note--agg");
const methodAggTrigger = document.querySelector(".method__underline--blue");
let currentMethodKey = "source";
let aggTriggerVisible = false;

function setMethodSection(key) {
  currentMethodKey = key;
  methodNavItems.forEach((item) => {
    const isActive = item.dataset.target === key;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  methodSections.forEach((section) => {
    const isActive = section.dataset.section === key;
    section.classList.toggle("is-active", isActive);
  });
  if (methodMarginNote) {
    methodMarginNote.classList.toggle("is-active", key === "source");
  }
  updateAggNote();
}

function updateAggNote() {
  if (!methodAggNote) return;
  const shouldShow = currentMethodKey === "rhythm" && aggTriggerVisible;
  methodAggNote.classList.toggle("is-active", shouldShow);
}

methodNavItems.forEach((item) => {
  item.addEventListener("click", () => setMethodSection(item.dataset.target));
});

if (methodNavItems.length) {
  setMethodSection("source");
}

if (methodAggTrigger) {
  const aggObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target !== methodAggTrigger) return;
        aggTriggerVisible = entry.isIntersecting;
        updateAggNote();
      });
    },
    { threshold: 0.6 },
  );
  aggObserver.observe(methodAggTrigger);
}

const handLines = document.querySelectorAll(".method__margin-note .hand-line");
handLines.forEach((line, lineIndex) => {
  if (line.dataset.jittered) return;
  const words = line.textContent.trim().split(/\s+/);
  const jittered = words
    .map((word, wordIndex) => {
      const seed = (lineIndex + 1) * 37 + wordIndex * 19;
      const jitterY = (Math.sin(seed) * 1.2).toFixed(2);
      const jitterR = (Math.cos(seed * 0.7) * 1.2).toFixed(2);
      return `<span class="hand-word" style="--jitter-y:${jitterY}px;--jitter-r:${jitterR}deg">${word}</span>`;
    })
    .join(" ");
  line.innerHTML = jittered;
  line.dataset.jittered = "true";
});

const sources = document.getElementById("sources");
if (sources) {
  const sourcesObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveScene("sources");
      });
    },
    { threshold: 0.4 },
  );
  sourcesObserver.observe(sources);
}

const finale = document.getElementById("finale");
if (finale) {
  const finaleObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveScene("finale");
      });
    },
    { threshold: 0.4 },
  );
  finaleObserver.observe(finale);
}

// chart info UI removed
