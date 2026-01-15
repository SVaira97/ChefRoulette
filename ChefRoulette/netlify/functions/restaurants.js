// ChefRoulette/netlify/functions/restaurants.js

function normalize(str) {
  return String(str || "").trim();
}

function makeId(name, zone, idx) {
  const base = `${normalize(name).toLowerCase()}-${normalize(zone).toLowerCase()}-${idx}`;
  return base
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-áéíóúüñ]/gi, "")
    .slice(0, 80);
}

// Google Visualization API devuelve algo tipo:
// google.visualization.Query.setResponse({...});
function parseGviz(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("GViz payload not found");
  const json = text.slice(start, end + 1);
  return JSON.parse(json);
}

exports.handler = async () => {
  try {
    const sheetId = process.env.GSHEET_ID;
    const sheetName = process.env.GSHEET_NAME || "Sheet1";

    if (!sheetId) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing GSHEET_ID env var" })
      };
    }

    const url =
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq` +
      `?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "ChefRoulette/1.0" }
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to fetch Google Sheet", status: res.status })
      };
    }

    const text = await res.text();
    const gviz = parseGviz(text);

    const cols = (gviz.table?.cols || []).map(c => normalize(c.label));
    const rows = gviz.table?.rows || [];

    // Mapeo por nombre de columna (tu hoja)
    const colIndex = (label) => cols.findIndex(c => c.toLowerCase() === label.toLowerCase());

    const iNombre = colIndex("Nombre");
    const iTipo = colIndex("Tipo");
    const iZona = colIndex("Zona");
    const iDelivery = colIndex("Link delivery");
    const iUbic = colIndex("Link ubicación");
    const iImagen = colIndex("Imagen");

    if (iNombre === -1 || iTipo === -1 || iZona === -1) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing required columns. Need: Nombre, Tipo, Zona",
          detectedColumns: cols
        })
      };
    }

    const restaurants = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const cells = rows[idx].c || [];

      const getCell = (i) => (i >= 0 && cells[i] ? normalize(cells[i].v) : "");

      const name = getCell(iNombre);
      const cuisine = getCell(iTipo);
      const zone = getCell(iZona);

      // Saltar filas vacías
      if (!name || !cuisine || !zone) continue;

      const deliveryUrl = getCell(iDelivery);
      const mapsUrl = getCell(iUbic);
      const image = getCell(iImagen);

      restaurants.push({
        id: makeId(name, zone, idx + 1),
        name,
        cuisine,
        zone,
        deliveryUrl,
        mapsUrl,
        image
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      },
      body: JSON.stringify({
        source: "gsheets",
        count: restaurants.length,
        restaurants
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected error", details: String(err?.message || err) })
    };
  }
};


