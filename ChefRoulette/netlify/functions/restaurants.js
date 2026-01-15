function normalize(str) {
  return String(str || "").trim();
}

function makeId(name, zone, idx) {
  return `${normalize(name)}-${normalize(zone)}-${idx}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-áéíóúüñ]/gi, "")
    .slice(0, 80);
}

exports.handler = async () => {
  try {
    const sheetId = process.env.GSHEET_ID;
    const sheetName = process.env.GSHEET_NAME || "Sheet1";

    if (!sheetId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing GSHEET_ID env var" })
      };
    }

    const url = `https://opensheet.elk.sh/${sheetId}/${encodeURIComponent(sheetName)}`;

    const res = await fetch(url);
    if (!res.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Failed to fetch Google Sheet" })
      };
    }

    const rows = await res.json();

    const restaurants = rows
      .filter(r => r.Nombre && r.Tipo && r.Zona)
      .map((r, idx) => ({
        id: makeId(r.Nombre, r.Zona, idx + 1),
        name: normalize(r.Nombre),
        cuisine: normalize(r.Tipo),
        zone: normalize(r.Zona),
        deliveryUrl: normalize(r["Link delivery"]),
        mapsUrl: normalize(r["Link ubicación"]),
        image: normalize(r.Imagen)
      }));

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
      body: JSON.stringify({
        error: "Unexpected error",
        details: String(err?.message || err)
      })
    };
  }
};





