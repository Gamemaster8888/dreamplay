// netlify/functions/referrer-sign.js
const { ethers } = require("ethers");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: "" };
    }

    const buyer = (event.queryStringParameters?.buyer || "").trim();
    if (!buyer || !/^0x[a-fA-F0-9]{40}$/.test(buyer)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid buyer" }) };
    }

    const PK = process.env.REGISTRAR_PK;
    const CSV_URL = process.env.ALLOWLIST_CSV;
    const DEFAULT_REF = (process.env.DEFAULT_REFERRER || "").trim();
    const SCHEME = (process.env.SIGNING_SCHEME || "hash").toLowerCase();

    if (!PK || !CSV_URL) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing REGISTRAR_PK or ALLOWLIST_CSV" }) };
    }

    // Fetch CSV
    const csvRes = await fetch(CSV_URL);
    if (!csvRes.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to fetch CSV" }) };
    }
    const text = await csvRes.text();
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => r.split(","));
    if (!rows.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Empty allowlist CSV" }) };
    }

    // Parse header
    const header = rows[0].map(h => h.trim().toLowerCase());
    const addrIdx = header.indexOf("address");
    const refIdx = header.indexOf("referrer");
    const ddlIdx = header.indexOf("deadline_days");
    if (addrIdx === -1) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "CSV missing 'address' column" }) };
    }

    // Find buyer row
    let referrer = DEFAULT_REF || ethers.constants.AddressZero;
    let deadlineDays = 14;
    let found = false;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const addr = (cols[addrIdx] || "").trim();
      if (addr && addr.toLowerCase() === buyer.toLowerCase()) {
        found = true;
        if (refIdx >= 0) {
          const ref = (cols[refIdx] || "").trim();
          if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) referrer = ref;
        }
        if (ddlIdx >= 0) {
          const d = parseInt((cols[ddlIdx] || "").trim(), 10);
          if (!isNaN(d) && d > 0 && d < 365) deadlineDays = d;
        }
        break;
      }
    }
    if (!found) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Buyer not on allowlist" }) };
    }

    // Build payload
    const now = Math.floor(Date.now() / 1000);
    const deadline = now + deadlineDays * 86400;

    const wallet = new ethers.Wallet(PK);
    let signature;

    if (SCHEME === "typed") {
      const domain = {
        name: "DreamPlayRegistrar",
        version: "1",
        chainId: 137,
        verifyingContract: "0xF8d3395c2ff16A1881147a3Ae0fBD7C33De13Ad4",
      };
      const types = {
        Register: [
          { name: "buyer", type: "address" },
          { name: "referrer", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = { buyer, referrer, deadline };
      signature = await wallet._signTypedData(domain, types, value);
    } else {
      const hash = ethers.utils.solidityKeccak256(
        ["address","address","uint256","string"],
        [buyer, referrer, deadline, "REGISTER"]
      );
      signature = await wallet.signMessage(ethers.utils.arrayify(hash));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ referrer, deadline, signature }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || "Internal error" }) };
  }
};
