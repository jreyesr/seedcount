importScripts("https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js");

let resolveLoaded, Log;

const functions = {
    init: function (logger) {
        Log = logger
    },
    load: async function () {
        let loaded = new Promise((resolve) => resolveLoaded = resolve)
        self.importScripts('https://docs.opencv.org/4.x/opencv.js')
        await loaded // block until Module.onRuntimeInitialized() below runs
    },
    process: processImage,
};

Comlink.expose(functions);

let Module = {
    // https://emscripten.org/docs/api_reference/module.html#Module.onRuntimeInitialized
    onRuntimeInitialized() {
        resolveLoaded() // This will kick functions.load(), which was stuck on the await
    }
};

// This is a part of cv.imshow's JS version
// https://github.com/opencv/opencv/blob/eab21b61067385515c77783608f8c374bfe131c6/modules/js/src/helpers.js#L93-L113
// Copyright (C) 2013, OpenCV Foundation, all rights reserved.
// Third party copyrights are property of their respective owners.
// See https://github.com/opencv/opencv/blob/4.x/LICENSE
function matToImageData(mat) {
    let img = new cv.Mat;
    let depth = mat.type() % 8;
    let scale = depth <= cv.CV_8S ? 1 : depth <= cv.CV_32S ? 1 / 256 : 255;
    let shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128 : 0;
    mat.convertTo(img, cv.CV_8U, scale, shift);
    switch (img.type()) {
        case cv.CV_8UC1:
            cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA);
            break;
        case cv.CV_8UC3:
            cv.cvtColor(img, img, cv.COLOR_RGB2RGBA);
            break;
        case cv.CV_8UC4:
            break;
        default:
            throw new Error("Bad number of channels (Source image must have 1, 3 or 4 channels)");
            return
    }
    return new ImageData(new Uint8ClampedArray(img.data), img.cols, img.rows);
}

function median(arr) {
    const middle = Math.floor(arr.length / 2);
    const nums = [...arr].sort((a, b) => a - b);
    return arr.length % 2 !== 0 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

const SHOW_CONTOURS = true;

function mostCommonValue(img, hist) {
    let r = cv.minMaxLoc(img);
    let min = r.minVal, max = r.maxVal;

    let r2 = cv.minMaxLoc(hist);
    let mostCommonGray = r2.maxLoc.y;

    return {min, max, mostCommon: mostCommonGray};
}

function processImage(img) {
    let src = cv.matFromImageData(img);

    Log.image("Source", matToImageData(src))
    let dsize = new cv.Size(1280, 960);
    cv.resize(src, src, dsize, 0, 0, cv.INTER_AREA);

    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY, 0);
    Log.image("Grayscale", matToImageData(gray));

    let histSrc = new cv.MatVector();
    histSrc.push_back(gray);
    let hist = new cv.Mat(), mask = new cv.Mat();
    cv.calcHist(histSrc, [0], mask, hist, [256], [0, 255], /*accumulate*/false);
    let max = cv.minMaxLoc(hist, mask).maxVal;
    const histScale = 3, histHeight = 300;
    let histFigure = new cv.Mat.zeros(histHeight, 256 * histScale, cv.CV_8UC3);
    // draw histogram
    for (let i = 0; i < 256; i++) {
        let binVal = hist.data32F[i] * histHeight / max;
        let point1 = new cv.Point(i * histScale, histHeight);
        let point2 = new cv.Point((i + 1) * histScale - 1, histHeight - binVal);
        cv.rectangle(histFigure, point1, point2, [255, 255, 255, 255], cv.FILLED);
    }

    const imageStats = mostCommonValue(gray, hist);
    // imageStats.mostCommon is most common gray value, we assume that it's the BG color
    const distToTop = imageStats.max - imageStats.mostCommon,
        distToBottom = imageStats.mostCommon - imageStats.min;
    let threshType;
    if (distToTop < distToBottom) {
        // most common value is closer to top => peak is lighter => white BG => invert
        threshType = cv.THRESH_BINARY_INV;
        Log.data("background_detection", {...imageStats, decision: "invert"})
    } else {
        // most common value is closer to bottom => peak is darker => dark BG => don't invert
        threshType = cv.THRESH_BINARY;
        Log.data("background_detection", {...imageStats, decision: "no_invert"})
    }

    let binary = new cv.Mat();
    Log.log("Thresholding algorithm=Adaptive")
    // NOTE: We need to swap C around too, it's usually negative on "normal" binarization so we need it to be positive on inverted binarization
    const blockSize = 51,
        C = threshType === cv.THRESH_BINARY_INV ? 20 : -20;
    Log.data("thresholding params", {blockSize, C})
    // const cutoff = cv.threshold(gray, binary, 0, 255, threshType + cv.THRESH_OTSU);
    // const cutoff = cv.threshold(gray, binary, 0, 255, threshType + cv.THRESH_TRIANGLE);
    cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_MEAN_C, threshType, blockSize, C);
    const cutoff = -1;
    // draw red line on threshold
    if (cutoff > -1) {
        cv.rectangle(histFigure, {x: cutoff * histScale, y: histHeight}, {
            x: cutoff * histScale + 1,
            y: 0
        }, [255, 0, 0, 255], cv.FILLED);
    }
    Log.image("Hist", matToImageData(histFigure));
    Log.log(`Threshold=${cutoff}`)
    gray.delete();
    hist.delete();
    histSrc.delete();
    mask.delete();
    histFigure.delete();

    let opened = binary.clone();
    Log.image("Opening", matToImageData(opened));

    let blobLabels = new cv.Mat(), blobStats = new cv.Mat(), centroids = new cv.Mat();
    let seedData = [];
    const numBlobs = cv.connectedComponentsWithStats(opened, blobLabels, blobStats, centroids);
    blobLabels.delete();
    opened.delete();
    for (let i = 1; i < numBlobs; i++) {
        const blobStat = blobStats.intPtr(i);
        const x0 = blobStat[0], y0 = blobStat[1];
        const w = blobStat[2], h = blobStat[3];
        const area = blobStat[4];
        const fillRatio = area / (w * h);

        if (area <= 16) continue; // speck of something
        if (fillRatio < 0.3) continue; // same
        if (w / h < 0.05 || w / h > 20) continue; // too skinny, very unlikely to be a row of 20 seeds in a perfect orthogonal row

        const PADDING = 0;
        cv.rectangle(src, new cv.Point(x0 - PADDING, y0 - PADDING), new cv.Point(x0 + w + PADDING, y0 + h + PADDING), [255, 0, 0, 255], 1);
        //cv.putText(src, ""+area/*+"="+fillRatio*/, {x:x0, y:y0-10}, cv.FONT_HERSHEY_SIMPLEX, 0.5, [255,0,0,0], 1)

        seedData.push({
            i,
            corner: {x0, y0},
            center: {x: centroids.doubleAt(i, 0), y: centroids.doubleAt(i, 1)},
            size: {w, h},
            area: blobStat[4],
            fillRatio
        });
    }
    blobStats.delete();
    centroids.delete();

    const areas = seedData.map(x => x.area);
    const frs = seedData.map(x => x.fillRatio);
    const medianArea = median(areas);

    let totalSeeds = 0;
    for (let seed of seedData) {
        seed.numSeeds = seed.area / medianArea;
        const numSeeds = Math.round(seed.area / medianArea);
        const numSeedsX = (seed.area / medianArea).toFixed(2);
        totalSeeds += numSeeds;
        cv.putText(src, "x" + numSeeds/*+"="+fillRatio*/, {
            x: seed.corner.x0,
            y: seed.corner.y0 - 2
        }, cv.FONT_HERSHEY_SIMPLEX, 0.5, [255, 255, 255, 255], 1)
    }

    Log.data("seed_data", seedData);
    Log.data("final_stats", {medianArea, totalSeeds})
    cv.putText(src, "Total=" + totalSeeds, {x: 5, y: 35}, cv.FONT_HERSHEY_SIMPLEX, 1.0, [255, 255, 255, 255], 2)
    Log.image("Output", matToImageData(src));

    if (SHOW_CONTOURS) {
        let contours = new cv.MatVector(), hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        cv.drawContours(src, contours, -1, [0, 0, 255, 255], 1, cv.LINE_8, hierarchy, 100);
        Log.image("Contours", matToImageData(src));
        contours.delete();
        hierarchy.delete();
    }

    return [totalSeeds, matToImageData(src)];
}