const https = require("https");

const LEMON_API_KEY = process.env.LEMON_API_KEY;
const PRODUCT_ID = process.env.PRODUCT_ID || "1128122";
const PORT = process.env.PORT || 3000;

function validateLicense(licenseKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ license_key: licenseKey });
    const options = {
      hostname: "api.lemonsqueezy.com",
      path: "/v1/licenses/validate",
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LEMON_API_KEY}`,
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

require("http").createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/validate") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { key } = JSON.parse(body);
        if (!key) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ valid: false, error: "No key provided" }));
          return;
        }

        const result = await validateLicense(key);
        const valid = result.valid === true &&
          String(result.meta?.product_id) === String(PRODUCT_ID);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ valid }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ valid: false, error: "Server error" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
}).listen(PORT, () => {
  console.log(`Raffle license server running on port ${PORT}`);
});
