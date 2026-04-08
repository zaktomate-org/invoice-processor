import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { FileUpload, InvoiceData, ProcessResult, LineItem, APIKeyWithSecret } from "../types.ts";
import { getRandomKey, getAllKeys } from "../api/keys.ts";

const INVOICE_SCHEMA: any = {
  type: "object",
  properties: {
    invoiceNumber: { type: "string" },
    date: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
    dueDate: { type: "string", description: "Due date in YYYY-MM-DD format, or null if not specified" },
    vendor: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["name"],
    },
    customer: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
      },
      required: ["name"],
    },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          total: { type: "number" },
        },
        required: ["description", "quantity", "unitPrice", "total"],
      },
    },
    subtotal: { type: "number" },
    tax: { type: "number" },
    total: { type: "number" },
    currency: { type: "string", description: "ISO currency code (USD, EUR, GBP, INR, etc.)" },
  },
  required: ["invoiceNumber", "date", "vendor", "customer", "lineItems", "subtotal", "tax", "total", "currency"],
};

const SYSTEM_PROMPT = `You are an expert invoice OCR system. Extract all data from the provided invoice document (image or PDF) and return it as structured JSON.

Rules:
1. Extract ALL fields visible on the invoice
2. Use null or empty string for fields not found
3. Dates must be in YYYY-MM-DD format
4. Currency must be ISO code (USD, EUR, GBP, INR, etc.)
5. Line items must include all items listed on the invoice
6. Numbers should be plain numbers (no currency symbols, commas removed)
7. If tax is not specified, set to 0
8. If subtotal is not explicitly listed, calculate from line items
9. Total must match the invoice total exactly
10. Return ONLY valid JSON, no markdown, no explanations`;

/**
 * Process an invoice file with Gemini 3 Flash Preview
 * Uses random API key from pool with retry fallback
 */
export async function processWithGemini(file: FileUpload): Promise<ProcessResult> {
  let lastError: Error | null = null;

  // Try with random key first, then fallback to other keys
  const allKeys = getAllKeys();
  const firstKey = getRandomKey();

  if (!firstKey) {
    return {
      success: false,
      fileName: file.name,
      error: "No Gemini API keys configured. Please add API keys in the Settings section.",
    };
  }

  // Build ordered list: first random key, then remaining keys for retry
  const keysToTry: APIKeyWithSecret[] = [firstKey];
  for (const key of allKeys) {
    if (key.id !== firstKey.id) {
      keysToTry.push(key);
    }
  }

  // Try each key until one works
  for (const apiKey of keysToTry) {
    try {
      const result = await callGemini(file, apiKey.key);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Gemini API key ${apiKey.id.slice(0, 8)}... failed: ${lastError.message}`);
      // Continue to next key
    }
  }

  // All keys failed
  return {
    success: false,
    fileName: file.name,
    error: `All API keys failed. Last error: ${lastError?.message || "Unknown error"}`,
  };
}

/**
 * Call Gemini API with a specific key
 */
async function callGemini(file: FileUpload, apiKey: string): Promise<ProcessResult> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INVOICE_SCHEMA,
      temperature: 0.1,
      topP: 0.95,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  });

  // Build content parts
  const contentParts: any[] = [];

  // Add the file as inline data (base64)
  contentParts.push({
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  });

  // Add system prompt
  contentParts.push(SYSTEM_PROMPT);

  // Generate content
  const result = await model.generateContent(contentParts);
  const response = await result.response;
  const text = response.text();

  // Parse the JSON response
  try {
    const invoiceData = JSON.parse(text) as InvoiceData;
    return {
      success: true,
      fileName: file.name,
      invoiceData,
    };
  } catch (parseError) {
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
  }
}
