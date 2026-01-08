// ChefRoulette/netlify/functions/restaurants.js

exports.handler = async () => {
  try {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE;
    const AIRTABLE_VIEW = process.env.AIRTABLE_VIEW || "Grid view";

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Faltan variables de entorno",
          hasToken: Boolean(AIRTABLE_TOKEN),
          hasBaseId: Boolean(AIRTABLE_BASE_ID),
          hasTable: Boolean(AIRTABLE_TABLE),
          view: AIRTABLE_VIEW
        })
      };
    }

    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}` +
      `?view=${encodeURIComponent(AIRTABLE_VIEW)}&pageSize=100`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const rawText = await res.text();

    if (!res.ok) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Airtable error",
          status: res.status,
          statusText: res.statusText,
          urlUsed: url,
          details: rawText.slice(0, 800)
        })
      };
    }

    const data = JSON.parse(rawText);

    const restaurants = (data.records || [])
      .map((rec) => {
        const f = rec.fields || {};

        let image = "";
        const imgField = f["Imagen"];
        if (Array.isArray(imgField) && imgField[0]?.url) image = imgField[0].url;
        if (typeof imgField === "string") image = imgField;

        return {
          id: rec.id,
          name: String(f["Nombre"] || "").trim(),
          cuisine: String(f["Tipo"] || "").trim() || "Varios",
          zone: String(f["Zona"] || "").trim() || "Madrid",
          deliveryUrl: String(f["Link delivery"] || "").trim(),
          mapsUrl: String(f["Link ubicación"] || "").trim(),
          image
        };
      })
      .filter((r) => r.name.length > 0);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      },
      body: JSON.stringify({ restaurants })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", details: String(err) })
    };
  }
};
