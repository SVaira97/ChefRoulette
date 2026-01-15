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

function parseGviz(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("GViz payload not found");
  const json = text.slice(start, end + 1);
  return JSON.parse(json);
}

function normKey(s) {
  return normalize(s)
    .toLowerCase()
    .replaceAll("á","a")
    .replaceAll("é","e")
    .replaceAll("í","i")
    .replaceAll("ó","o")
    .replaceAll("ú","u")
    .replaceAll("ü","u")
    .replaceAll("ñ","n")
    .replace(/\s+/g, " ")
    .trim();
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

    const res = await fetch(url, { headers: { "User-Agent": "ChefRoulette/1.0" } });
    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to fetch Google Sheet", status: res.status })
      };
    }

    const text = await res.text();
    const gviz = parseGviz(text);

    const rawCols = (gviz.table?.cols || []).map(c => normalize(c.label));
    const cols = rawCols.map(normKey);
    const rows = gviz.table?.rows || [];

    const findCol = (candidates) => {
      for (const cand of candidates) {
        const i = cols.findIndex(c => c === normKey(cand));
        if (i !== -1) return i;
      }
      return -1;
    };

    const iNombre = findCol(["Nombre", "Name"]);
    const iTipo = findCol(["Tipo", "Cocina", "Cuisine"]);
    const iZona = findCol(["Zona", "Zone", "Barrio"]);
    const iDelivery = findCol(["Link delivery", "Delivery", "Link delivery ", "Link Delivery", "URL delivery"]);
    const iUbic = findCol(["Link ubicación", "Link ubicacion", "Ubicacion", "Ubicación", "Maps", "Google Maps", "Link maps"]);
    const iImagen = findCol(["Imagen", "Image", "Foto", "Photo"]);

    if (iNombre === -1 || iTipo === -1 || iZona === -1) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing required columns. Need: Nombre/Tipo/Zona (o equivalentes)",
          detectedColumns: rawCols
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
      if (!name || !cuisine || !zone) continue;

      restaurants.push({
        id: makeId(name, zone, idx + 1),
        name,
        cuisine,
        zone,
        deliveryUrl: getCell(iDelivery),
        mapsUrl: getCell(iUbic),
        image: getCell(iImagen)
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      },
      body: JSON.stringify({ source: "gsheets", count: restaurants.length, restaurants })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected error", details: String(err?.message || err) })
    };
  }
};



