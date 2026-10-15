async function checkLive() {
  const html = await fetch("https://bites-pi.vercel.app/call").then((r) => r.text());
  console.log("Call HTML length:", html.length);
  
  const scripts = [];
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  console.log("Call scripts count:", scripts.length);

  let full = "";
  for (const src of scripts) {
    const url = src.startsWith("http") ? src : `https://bites-pi.vercel.app${src}`;
    const js = await fetch(url).then((r) => r.text());
    full += "\n" + js;
  }

  console.log("Has match_queue:", full.includes("match_queue"));
  console.log("Has /api/match:", full.includes("/api/match"));
  console.log("Has peerjs:", full.includes("peerjs"));
  console.log("Has openrelay:", full.includes("openrelay"));
  console.log("Has bites-c90b7:", full.includes("bites-c90b7"));
}

checkLive().catch(console.error);
