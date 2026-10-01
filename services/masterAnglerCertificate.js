const PDFDocument = require("pdfkit");

// Render from server-owned catch data; authorization belongs to the endpoint.
function createMasterAnglerCertificate(fish) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER", layout: "landscape", margin: 36,
      info: { Title: "Master Angler Certificate", Author: "Anglers Index" },
    });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const navy = "#082f6b";
    const gold = "#b18a3d";
    const width = 648;
    function centered(value, y, size, font = "Helvetica", color = navy) {
      const text = String(value).replace(/[\r\n\t]+/g, " ");
      doc.font(font).fontSize(size);
      while (doc.widthOfString(text) > width && size > 10) doc.fontSize(--size);
      doc.fillColor(color).text(text, 72, y, { width, align: "center", lineBreak: false });
    }
    doc.rect(0, 0, 792, 612).fill("#fffdf8");
    doc.lineWidth(2).rect(28, 28, 736, 556).stroke(navy);
    doc.lineWidth(0.6).rect(35, 35, 722, 542).stroke(gold);
    centered("ANGLERS INDEX", 65, 13, "Helvetica-Bold");
    centered("Master Angler", 107, 40, "Times-Bold");
    centered("CERTIFICATE OF ACHIEVEMENT", 160, 12, "Helvetica", gold);
    doc.moveTo(276, 192).lineTo(516, 192).stroke(gold);
    centered("Presented to", 216, 13, "Helvetica", "#53657a");
    centered([fish.user?.first_name, fish.user?.last_name].filter(Boolean).join(" ") || fish.user?.username || "Angler", 245, 30, "Times-Bold");
    centered("In recognition of an outstanding catch", 290, 13, "Helvetica", "#53657a");
    centered(fish.species?.name || "Species not recorded", 320, 25, "Helvetica-Bold");
    const measurements = [
      Number(fish.length) > 0 ? `${fish.length} inches` : null,
      Number(fish.weight) > 0 ? `${fish.weight} lb` : null,
    ].filter(Boolean).join("  |  ");
    centered(measurements || "Measurements not recorded", 358, 16);
    centered([fish.lake?.name, fish.lake?.county, fish.lake?.state].filter(Boolean).join(" · ") || "Location not recorded", 393, 15);
    const date = fish.date ? new Date(`${String(fish.date).slice(0, 10)}T12:00:00Z`) : null;
    centered(date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "Date not recorded", 420, 13, "Helvetica", "#53657a");
    if (fish.witness && !["NA", "N/A"].includes(fish.witness)) centered(`Witness: ${fish.witness}`, 456, 11, "Helvetica", "#53657a");
    doc.moveTo(120, 503).lineTo(672, 503).stroke(gold);
    centered(`Anglers Index Master Angler Program  |  Catch #${fish.id}`, 522, 10, "Helvetica", "#53657a");
    doc.end();
  });
}

module.exports = { createMasterAnglerCertificate };
