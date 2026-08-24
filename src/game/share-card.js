function roundText(results) {
  if (!results || !results.length) {
    return "No rounds";
  }
  return results
    .map((row) => `R${row.round} ${row.passed ? "pass" : "fail"} ${row.score}`)
    .join("  ·  ");
}

function drawScoreCard({ won, totalPoints, lives, results }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a0b3d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5b39a6";
  ctx.fillRect(0, 0, canvas.width, 180);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t("shareTitle"), 540, 115);
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.fillText(won ? t("youFinished") : t("gameOver"), 540, 360);
  ctx.font = "bold 96px system-ui, sans-serif";
  ctx.fillText(String(totalPoints), 540, 520);
  ctx.font = "32px system-ui, sans-serif";
  ctx.fillText(t("totalScore"), 540, 580);
  ctx.font = "36px system-ui, sans-serif";
  const lifeWord = lives === 1 ? t("life") : t("lives");
  ctx.fillText(`${lives} ${lifeWord} ${t("left")}`, 540, 680);
  ctx.font = "28px system-ui, sans-serif";
  wrapText(ctx, roundText(results), 540, 780, 900, 40);
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillStyle = "#cbbbe8";
  ctx.fillText(t("cameraNotSaved"), 540, 1240);
  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let row = y;
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, row);
      line = word;
      row += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) {
    ctx.fillText(line, x, row);
  }
}

async function shareOrDownload(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    return "failed";
  }
  const file = new File([blob], "christmas-catch-score.png", { type: "image/png" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: t("shareTitle"),
        text: t("shareText"),
        files: [file],
      });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
