// A small pure-JS SHA-256, embedded in the report page. Browsers only offer
// crypto.subtle on https, localhost and file pages; when a report is opened some
// other way (a preview pane, an http host) the verifier falls back to this so
// it still works. The report's own tests check it against Node's crypto.
// It must stay self-contained: the report embeds it with Function.toString().
function sha256hex(str) {
  var bytes = new TextEncoder().encode(str);
  var K = [], H = [], n, d, prime;
  for (n = 2; K.length < 64; n++) {
    prime = true;
    for (d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) {
      if (H.length < 8) H.push((Math.pow(n, 0.5) * 4294967296) | 0);
      K.push((Math.pow(n, 1 / 3) * 4294967296) | 0);
    }
  }
  var len = bytes.length, total = (((len + 8) >> 6) + 1) * 16, words = new Array(total).fill(0), i, j, o;
  for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[total - 1] = len * 8;
  var W = new Array(64);
  for (o = 0; o < total; o += 16) {
    var a = H[0], b = H[1], c = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (j = 0; j < 64; j++) {
      if (j < 16) W[j] = words[o + j];
      else {
        var w15 = W[j - 15], w2 = W[j - 2];
        var s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        var s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
      }
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + dd) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
}

module.exports = { sha256hex };
