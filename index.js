const https = require("https");

const LEMON_API_KEY = process.env.LEMON_API_KEY;
const PRODUCT_ID = process.env.PRODUCT_ID || "1128122";
const PORT = process.env.PORT || 3000;

function lemonRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "api.lemonsqueezy.com",
      path,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LEMON_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

require("http").createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.method === "POST" && req.url === "/validate") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { key, instanceId } = JSON.parse(body);
        if (!key) { res.writeHead(400); res.end(JSON.stringify({ valid: false, error: "No key" })); return; }

        // If instanceId exists, just validate (already activated)
        if (instanceId) {
          const result = await lemonRequest("/v1/licenses/validate", {
            license_key: key,
            instance_id: instanceId
          });
          const valid = result.body.valid === true &&
            String(result.body.meta?.product_id) === String(PRODUCT_ID);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ valid }));
          return;
        }

        // First time: activate the license
        const result = await lemonRequest("/v1/licenses/activate", {
          license_key: key,
          instance_name: "Live Raffle Extension"
        });

        console.log("Activate response:", result.status, JSON.stringify(result.body));

        const activated = result.status === 200 &&
          result.body.activated === true &&
          String(result.body.meta?.product_id) === String(PRODUCT_ID);

        if (activated) {
          const instanceId = result.body.instance?.id;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ valid: true, instanceId }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ valid: false, error: result.body.error || "Activation failed" }));
        }

      } catch (e) {
        console.error("Error:", e);
        res.writeHead(500);
        res.end(JSON.stringify({ valid: false, error: "Server error" }));
      }
    });
    return;
  }

  res.writeHead(404); res.end("Not found");
}).listen(PORT, () => console.log(`Raffle license server running on port ${PORT}`));
