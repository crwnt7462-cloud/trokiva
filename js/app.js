/* Colle une URL pour recevoir les e-mails (Formspree, FormSubmit…).
   Tant que c’est vide, l’inscription reste enregistrée sur cet appareil. */
const WAITLIST_ENDPOINT = "https://formspree.io/f/moejkzjn";
const STORAGE_KEY = "trokiva.waitlist.v1";

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!data || !Array.isArray(data.entries)) return { entries: [], current: null };
    return data;
  } catch {
    return { entries: [], current: null };
  }
}

function persist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function signupUrl(code) {
  const url = new URL("index.html", window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("ref", code);
  return url.toString();
}

function readRef() {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref || !/^[a-z0-9]{4,16}$/i.test(ref)) return "";
  return ref.toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function paintStars() {
  const canvas = document.getElementById("stars");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const count = 28;
    for (let i = 0; i < count; i += 1) {
      const x = width * 0.5 + (Math.random() - 0.5) * Math.min(width, 640);
      const y = height * 0.48 + (Math.random() - 0.5) * 420;
      ctx.fillStyle = `rgba(255, 210, 120, ${0.35 + Math.random() * 0.65})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  draw();
}

paintStars();

if (document.body.dataset.page === "join") {
  const emailInput = document.getElementById("email");
  const form = document.getElementById("join-form");
  const formError = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const invite = document.getElementById("invite");
  const sessionRef = readRef();

  if (sessionRef) invite.hidden = false;

  function showError(message) {
    formError.textContent = message;
    emailInput.setAttribute("aria-invalid", message ? "true" : "false");
  }

  emailInput.addEventListener("input", () => {
    if (formError.textContent) showError("");
  });

  let pending = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;

    const email = emailInput.value.trim().toLowerCase();
    if (!email) {
      showError("Indique ton e-mail.");
      emailInput.focus();
      return;
    }
    if (!validEmail(email)) {
      showError("Cet e-mail semble incomplet.");
      emailInput.focus();
      return;
    }

    showError("");
    pending = true;
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    if (WAITLIST_ENDPOINT) submitBtn.textContent = "Un instant…";

    try {
      const data = load();
      const known = data.entries.find((entry) => entry.email === email);
      const entry = known || {
        email,
        code: makeCode(),
        referredBy: sessionRef,
        createdAt: new Date().toISOString(),
      };

      if (!known && WAITLIST_ENDPOINT) {
        const response = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: entry.email,
            referral: entry.code,
            referredBy: entry.referredBy,
            message: `Liste d’attente Trokiva. Code ${entry.code}. Invitation : ${entry.referredBy || "aucune"}.`,
          }),
        });
        if (!response.ok) throw new Error("endpoint");
      }

      if (!known) data.entries.push(entry);
      data.current = entry;
      persist(data);
      location.href = "liste.html";
    } catch {
      showError("L’inscription n’a pas abouti. Réessaie dans un instant.");
      pending = false;
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });
}

if (document.body.dataset.page === "in") {
  const entry = load().current;
  if (!entry) {
    location.replace("index.html");
  } else {
    const url = signupUrl(entry.code);
    const refInput = document.getElementById("ref-link");
    const refField = document.querySelector(".ref");
    const copyBtn = document.getElementById("copy");
    const copyStatus = document.getElementById("copy-status");
    const message = "Je viens de réserver ma place sur Trokiva — l’appli pour noter, donner et échanger des livres.";

    refInput.value = url;
    document.getElementById("share-x").href =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
    document.getElementById("share-wa").href =
      `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
    document.getElementById("share-fb").href =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

    let copiedTimer = 0;

    function setCopied(copied) {
      copyBtn.classList.toggle("is-copied", copied);
      refField.classList.toggle("is-copied", copied);
      copyBtn.setAttribute("aria-label", copied ? "Lien copié" : "Copier le lien d’invitation");
      copyStatus.textContent = copied ? "Lien copié." : "";
      window.clearTimeout(copiedTimer);
      if (copied) copiedTimer = window.setTimeout(() => setCopied(false), 2200);
    }

    copyBtn.addEventListener("click", async () => {
      const value = refInput.value;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      } catch {
        refInput.focus();
        refInput.select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
        setCopied(ok);
        if (!ok) copyStatus.textContent = "Sélectionne le lien et copie-le.";
      }
    });
  }
}
