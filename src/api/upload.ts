import { fileToBase64, isValidFileType, isValidFileSize, getMimeType } from "../utils.ts";
import type { FileUpload, ProcessResult, InvoiceData } from "../types.ts";
import { processWithGemini } from "../services/gemini.ts";
import { createInvoicePage } from "../services/notion.ts";

const MAX_FILE_SIZE_MB = 50;

/**
 * Handle file upload request
 * Parses FormData, validates files, encodes to base64, sends to Gemini, saves to Notion
 */
export async function handleUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files uploaded" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const results: ProcessResult[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      const fileName = file.name;
      const mimeType = file.type || getMimeType(fileName);
      const size = file.size;

      // Validate file type
      if (!isValidFileType(mimeType)) {
        results.push({
          success: false,
          fileName,
          error: `Unsupported file type: ${mimeType}. Allowed: PNG, JPG, JPEG, WEBP, PDF`,
        });
        continue;
      }

      // Validate file size
      if (!isValidFileSize(size, MAX_FILE_SIZE_MB)) {
        results.push({
          success: false,
          fileName,
          error: `File too large: ${(size / 1024 / 1024).toFixed(2)}MB. Max: ${MAX_FILE_SIZE_MB}MB`,
        });
        continue;
      }

      // Encode to base64
      const base64 = await fileToBase64(file);

      const fileUpload: FileUpload = {
        base64,
        mimeType,
        name: fileName,
        size,
      };

      // Process with Gemini
      console.log(`📄 Processing: ${fileName} (${mimeType}, ${(size / 1024).toFixed(2)}KB)`);
      const geminiResult = await processWithGemini(fileUpload);

      if (!geminiResult.success) {
        results.push({
          success: false,
          fileName,
          error: geminiResult.error,
        });
        continue;
      }

      const invoiceData = geminiResult.invoiceData as InvoiceData;

      // Save to Notion
      try {
        const notionPageId = await createInvoicePage(invoiceData);
        results.push({
          success: true,
          fileName,
          invoiceData,
          notionPageId,
        });
        console.log(`✅ Saved to Notion: ${invoiceData.invoiceNumber}`);
      } catch (error) {
        console.error("Notion error:", error);
        results.push({
          success: true,
          fileName,
          invoiceData,
          error: `Extracted data saved locally but failed to save to Notion: ${error instanceof Error ? error.message : "Unknown error"}`,
          notionPageId: undefined,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        successCount,
        failCount,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Upload handler error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process upload",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
