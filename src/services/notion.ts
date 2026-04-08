import { Client } from "@notionhq/client";
import type { InvoiceData, LineItem } from "../types.ts";

// Lazy-initialized Notion client
let notionClient: Client | null = null;
let cachedDatabaseId: string | null = null;

function getClient(): Client {
  if (!notionClient) {
    const apiKey = Bun.env.NOTION_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "NOTION_API_KEY not set in environment.\n" +
        "Please add your Notion integration token to the .env file.\n" +
        "Get one at: https://www.notion.so/my-integrations"
      );
    }
    notionClient = new Client({ auth: apiKey });
  }
  return notionClient;
}

async function getDatabaseId(): Promise<string> {
  // Return cached ID if available
  if (cachedDatabaseId) {
    return cachedDatabaseId;
  }

  // Use env var if set
  const envDatabaseId = Bun.env.NOTION_DATABASE_ID;
  if (envDatabaseId && envDatabaseId.trim().length > 0) {
    cachedDatabaseId = envDatabaseId.trim();
    return cachedDatabaseId;
  }

  // Auto-create database
  const database = await createInvoiceDatabase();
  cachedDatabaseId = database.id;
  console.log(`📊 Created invoice database: ${database.id}`);
  return cachedDatabaseId;
}

/**
 * Create an invoice database in Notion under a random page
 * Returns the database ID
 */
async function createInvoiceDatabase() {
  const notion = getClient();

  // Find a suitable parent page
  let pages;
  try {
    pages = await notion.search({
      filter: {
        property: "object",
        value: "page",
      },
      page_size: 1,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) {
      throw new Error(
        "Notion API token is invalid (401 Unauthorized).\n\n" +
        "How to fix:\n" +
        "1. Go to https://www.notion.so/my-integrations\n" +
        "2. Click on your integration → 'Internal Integration' tab\n" +
        "3. Copy the token (starts with 'ntn_')\n" +
        "4. Paste it in your .env file as NOTION_API_KEY\n" +
        "5. DO NOT click 'Refresh' unless your token was exposed\n" +
        "6. Restart the server\n\n" +
        `Technical details: ${error.message}`
      );
    }
    throw error;
  }

  if (pages.results.length === 0) {
    throw new Error(
      "No pages found in your Notion workspace that are shared with this integration.\n\n" +
      "How to fix:\n" +
      "1. Open Notion and go to any page (or create a new one)\n" +
      "2. Click '•••' (three dots) in the top-right of the page\n" +
      "3. Click 'Add connections' (or 'Connect to')\n" +
      "4. Search for your integration name and select it\n" +
      "5. Restart the server"
    );
  }

  const parentPageId = pages.results[0].id;

  const database = await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: parentPageId,
    },
    title: [
      {
        type: "text",
        text: {
          content: "Invoice Processor",
        },
      },
    ],
    description: [
      {
        type: "text",
        text: {
          content: "Invoices processed by Gemini AI",
        },
      },
    ],
    initial_data_source: {
      properties: {
        "Invoice Number": {
          type: "title",
          title: {},
        },
        Date: {
          type: "date",
          date: {},
        },
        "Due Date": {
          type: "date",
          date: {},
        },
        Vendor: {
          type: "rich_text",
          rich_text: {},
        },
        Customer: {
          type: "rich_text",
          rich_text: {},
        },
        Subtotal: {
          type: "number",
          number: {
            format: "number",
          },
        },
        Tax: {
          type: "number",
          number: {
            format: "number",
          },
        },
        Total: {
          type: "number",
          number: {
            format: "number",
          },
        },
        Currency: {
          type: "select",
          select: {
            options: [
              { name: "USD" },
              { name: "EUR" },
              { name: "GBP" },
              { name: "INR" },
              { name: "JPY" },
              { name: "CAD" },
              { name: "AUD" },
              { name: "CNY" },
              { name: "Other" },
            ],
          },
        },
        Status: {
          type: "select",
          select: {
            options: [
              { name: "Pending", color: "yellow" },
              { name: "Paid", color: "green" },
              { name: "Overdue", color: "red" },
            ],
          },
        },
        "Source File": {
          type: "rich_text",
          rich_text: {},
        },
      },
    },
  });

  return database;
}

/**
 * Create a new page in the invoice database with extracted data
 */
export async function createInvoicePage(invoice: InvoiceData): Promise<string> {
  const notion = getClient();
  const databaseId = await getDatabaseId();

  // Build properties
  const properties: Record<string, any> = {
    "Invoice Number": {
      title: [
        {
          text: {
            content: invoice.invoiceNumber,
          },
        },
      ],
    },
    Date: {
      date: {
        start: invoice.date,
      },
    },
    Vendor: {
      rich_text: [
        {
          text: {
            content: invoice.vendor.name,
          },
        },
      ],
    },
    Customer: {
      rich_text: [
        {
          text: {
            content: invoice.customer.name,
          },
        },
      ],
    },
    Subtotal: {
      number: invoice.subtotal,
    },
    Tax: {
      number: invoice.tax,
    },
    Total: {
      number: invoice.total,
    },
    Currency: {
      select: {
        name: isValidCurrency(invoice.currency) ? invoice.currency.toUpperCase() : "Other",
      },
    },
    Status: {
      select: {
        name: "Pending",
      },
    },
  };

  // Add optional due date
  if (invoice.dueDate) {
    properties["Due Date"] = {
      date: {
        start: invoice.dueDate,
      },
    };
  }

  // Create the page
  const page = await notion.pages.create({
    parent: {
      type: "database_id",
      database_id: databaseId,
    },
    properties,
  });

  // Add line items as content blocks
  const blocks: any[] = [];

  // Vendor details
  if (invoice.vendor.address || invoice.vendor.email || invoice.vendor.phone) {
    const vendorDetails = [
      `**Vendor:** ${invoice.vendor.name}`,
      invoice.vendor.address ? `**Address:** ${invoice.vendor.address}` : "",
      invoice.vendor.email ? `**Email:** ${invoice.vendor.email}` : "",
      invoice.vendor.phone ? `**Phone:** ${invoice.vendor.phone}` : "",
    ].filter(Boolean);

    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: vendorDetails.map((text) => ({
          type: "text" as const,
          text: { content: text },
        })),
      },
    });
  }

  // Customer details
  if (invoice.customer.address) {
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: `**Customer:** ${invoice.customer.name} - ${invoice.customer.address}` },
          },
        ],
      },
    });
  }

  // Line items table header
  blocks.push({
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [
        {
          type: "text",
          text: { content: "Line Items" },
        },
      ],
    },
  });

  // Add each line item as a bulleted list
  for (const item of invoice.lineItems) {
    blocks.push({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `${item.description} - Qty: ${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.total.toFixed(2)}`,
            },
          },
        ],
      },
    });
  }

  // Summary section
  blocks.push({
    object: "block",
    type: "divider",
    divider: {},
  });

  blocks.push({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: `Subtotal: ${invoice.currency} ${invoice.subtotal.toFixed(2)}\n` },
        },
        {
          type: "text",
          text: { content: `Tax: ${invoice.currency} ${invoice.tax.toFixed(2)}\n` },
        },
        {
          type: "text",
          annotations: { bold: true },
          text: { content: `Total: ${invoice.currency} ${invoice.total.toFixed(2)}` },
        },
      ],
    },
  });

  // Append blocks to page
  if (blocks.length > 0) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: blocks,
    });
  }

  return page.id;
}

/**
 * Check if currency code is a common ISO code we have options for
 */
function isValidCurrency(currency: string): boolean {
  const commonCurrencies = [
    "USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD", "CNY",
    "CHF", "HKD", "SGD", "SEK", "KRW", "NOK", "NZD", "MXN",
    "BRL", "RUB", "ZAR", "TRY", "AED", "SAR", "THB", "IDR",
  ];
  return commonCurrencies.includes(currency.toUpperCase());
}
