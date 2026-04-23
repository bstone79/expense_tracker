import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

let workerConfigured = false;

function ensurePdfWorkerConfigured(): void {
  if (workerConfigured) {
    return;
  }

  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  workerConfigured = true;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  ensurePdfWorkerConfigured();

  const fileBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: fileBuffer });
  const pdf = await loadingTask.promise;
  const pagesText: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) {
      pagesText.push(pageText);
    }
  }

  await loadingTask.destroy();
  return pagesText.join("\n\n").trim();
}
