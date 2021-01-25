/**
 *
 * Run `yarn global add canvas` first
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");
const outputFolder = path.join(__dirname, "..", "buildings");
const dimensions = 192;
const lineSize = 92;
const lowerLineSize = 120;
const variantColor = "#6a7e98";
async function run() {
    console.log("Running");
    const promises = [];

    const parts = {
        forward: [[0.5, 0, 0.5, 1]],
        turn: [
            [0.5, 0.5, 0.5, 1],
            [0.5, 0.5, 1, 0.5],
        ],
    };

    for (const partId in parts) {
        const partLines = parts[partId];
        const canvas = createCanvas(dimensions, dimensions);
        const context = canvas.getContext("2d");
        context.quality = "best";
        context.clearRect(0, 0, dimensions, dimensions);
        const lineCanvas = createCanvas(dimensions, dimensions);
        const lineContext = lineCanvas.getContext("2d");
        lineContext.quality = "best";
        lineContext.clearRect(0, 0, dimensions, dimensions);
        lineContext.strokeStyle = variantColor;
        lineContext.lineWidth = lowerLineSize;
        lineContext.lineCap = "round";
        lineContext.imageSmoothingEnabled = false;

            // Draw lower lines
        partLines.forEach(([x1, y1, x2, y2]) => {
            lineContext.beginPath();
            lineContext.moveTo(x1 * dimensions, y1 * dimensions);
            lineContext.lineTo(x2 * dimensions, y2 * dimensions);
            lineContext.stroke();
        });

        context.globalAlpha = 0.4;
        context.drawImage(lineCanvas, 0, 0, dimensions, dimensions);

        context.globalAlpha = 1;
        context.imageSmoothingEnabled = false;
        context.lineCap = "round";
        context.strokeStyle = variantColor;
        context.lineWidth = lineSize;

        // Draw upper lines
        partLines.forEach(([x1, y1, x2, y2]) => {
            context.beginPath();
            context.moveTo(x1 * dimensions, y1 * dimensions);
            context.lineTo(x2 * dimensions, y2 * dimensions);
            context.stroke();
        });

        const out = fs.createWriteStream(path.join(outputFolder, "industrial" + "_" + partId + ".png"));
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        promises.push(new Promise(resolve => stream.on("end", resolve)));
    }

    console.log("Waiting for completion");
    await Promise.all(promises);

    console.log("Done!");
}
run();
