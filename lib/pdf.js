import { randomBytes } from "node:crypto";
import PDFDocument from "pdfkit";

const TIME_ZONE = "Africa/Accra";
const PAGE_MARGIN = 42;
const FOOTER_HEIGHT = 34;
const TABLE_COLUMNS = [
  { key: "number", label: "#", width: 34, align: "right" },
  { key: "indexNumber", label: "Index number", width: 142 },
  { key: "fullName", label: "Full name", width: 218 },
  { key: "signedAt", label: "Sign-in time", width: 117 },
];

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function scheduledTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

function drawCellText(doc, text, x, y, width, height, options = {}) {
  doc.fillColor(options.color ?? "#172b27");
  doc.text(String(text ?? ""), x + 7, y + 6, {
    width: width - 14,
    height: height - 12,
    ellipsis: true,
    align: options.align ?? "left",
    valign: "center",
  });
}

export async function buildAttendancePdf({ course, session, rows }) {
  const document = new PDFDocument({
    size: "A4",
    margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
    bufferPages: true,
    ownerPassword: randomBytes(32).toString("hex"),
    userPassword: "",
    permissions: {
      modifying: false,
      annotating: false,
      copying: true,
      printing: "highResolution",
    },
  });

  const code = course.course_code ?? course.courseCode;
  const name = course.course_name ?? course.courseName;
  const sessionStart = session.created_at ?? session.createdAt;
  const sessionEnd = session.closed_at ?? session.closedAt;
  const safeRows = Array.isArray(rows) ? rows : [];
  const contentWidth = document.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const drawTableHeader = () => {
    const height = 28;
    let x = PAGE_MARGIN;
    document.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
    for (const column of TABLE_COLUMNS) {
      document.rect(x, y, column.width, height).fill("#245c4b");
      drawCellText(document, column.label, x, y, column.width, height, {
        align: column.align,
        color: "#ffffff",
      });
      x += column.width;
    }
    y += height;
  };

  const content = new Promise((resolve, reject) => {
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    try {
      document.font("Helvetica-Bold").fontSize(19).fillColor("#172b27");
      document.text("Attendance report", PAGE_MARGIN, y, { width: contentWidth });
      y = document.y + 13;

      document.font("Helvetica-Bold").fontSize(11).fillColor("#245c4b");
      document.text(`${code}  |  ${name}`, PAGE_MARGIN, y, { width: contentWidth });
      y = document.y + 6;

      document.font("Helvetica").fontSize(9).fillColor("#41574e");
      document.text(`Venue: ${course.venue ?? "Not specified"}`, PAGE_MARGIN, y, { width: contentWidth });
      y = document.y + 3;
      document.text(`Date: ${formatDateTime(sessionStart)}`, PAGE_MARGIN, y, { width: contentWidth });
      y = document.y + 3;

      const startTime = scheduledTime(course.start_time ?? course.startTime);
      const endTime = scheduledTime(course.end_time ?? course.endTime);
      if (startTime && endTime) {
        document.text(`Scheduled time: ${startTime} - ${endTime} (Africa/Accra)`, PAGE_MARGIN, y, {
          width: contentWidth,
        });
        y = document.y + 3;
      }
      if (sessionEnd) {
        document.text(`Closed: ${formatDateTime(sessionEnd)}`, PAGE_MARGIN, y, { width: contentWidth });
        y = document.y + 3;
      }
      document.font("Helvetica-Bold").text(`Total attendance: ${safeRows.length}`, PAGE_MARGIN, y, {
        width: contentWidth,
      });
      y = document.y + 16;

      drawTableHeader();
      document.font("Helvetica").fontSize(8.5).fillColor("#172b27");

      safeRows.forEach((row, index) => {
        const values = {
          number: index + 1,
          indexNumber: row.index_number ?? row.indexNumber,
          fullName: row.full_name ?? row.fullName,
          signedAt: formatDateTime(row.signed_at ?? row.signedAt),
        };
        const heights = TABLE_COLUMNS.map((column) =>
          document.heightOfString(String(values[column.key] ?? ""), {
            width: column.width - 14,
            font: "Helvetica",
            fontSize: 8.5,
          }),
        );
        const rowHeight = Math.max(25, ...heights.map((height) => height + 12));
        const bottomLimit = document.page.height - PAGE_MARGIN - FOOTER_HEIGHT;

        if (y + rowHeight > bottomLimit) {
          document.addPage();
          y = PAGE_MARGIN;
          drawTableHeader();
          document.font("Helvetica").fontSize(8.5).fillColor("#172b27");
        }

        let x = PAGE_MARGIN;
        TABLE_COLUMNS.forEach((column) => {
          const background = index % 2 === 0 ? "#f1f5f2" : "#ffffff";
          document.rect(x, y, column.width, rowHeight).fillAndStroke(background, "#dce5df");
          drawCellText(document, values[column.key], x, y, column.width, rowHeight, {
            align: column.align,
            color: "#172b27",
          });
          x += column.width;
        });
        y += rowHeight;
      });

      const pageRange = document.bufferedPageRange();
      for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
        document.switchToPage(pageIndex);
        document
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#65756e")
          .text(
            `Generated automatically by KeySinc Attendance • Session ${session.id}`,
            PAGE_MARGIN,
            document.page.height - 27,
            { width: contentWidth, align: "center", lineBreak: false },
          );
      }

      document.end();
    } catch (error) {
      reject(error);
    }
  });

  return content;
}